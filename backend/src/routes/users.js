const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { deriveProjectWorkflowStatus } = require('../utils/workflowStatus');
const multer = require('multer');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// GET /api/users
router.get('/', authenticate, async (req, res) => {
    try {
        const { role_side } = req.query;
        let query = db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .leftJoin('organizations', 'users.organization_id', 'organizations.id')
            .select(
                'users.id', 'users.first_name', 'users.last_name', 'users.email', 'users.phone',
                'users.is_active', 'users.avatar_url', 'users.organization_id',
                'roles.name as role_name', 'roles.side as role_side',
                'organizations.name as organization_name'
            )
            
        if (!req.query.include_inactive) {
            query = query.where('users.is_active', true);
        }

        if (role_side) query = query.where('roles.side', role_side);

        if (req.user.role_name === 'Client') {
            query = query.where('users.organization_id', req.user.organization_id);
        }

        const users = await query.orderBy('roles.side', 'desc').orderBy('users.first_name');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch users.' });
    }
});

// GET /api/users/:id/details — Get user details and active assignments
router.get('/:id/details', authenticate, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // ─── Authorization check ───
        // Directors & Managers (hierarchy_level <= 2) can view any user's details.
        // Everyone else (Consultants, Clients) can only view their own details.
        if (req.user.hierarchy_level > 2 && req.user.id !== userId) {
            return res.status(403).json({ error: 'You can only view your own details.' });
        }

        const user = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .leftJoin('organizations', 'users.organization_id', 'organizations.id')
            .select(
                'users.id', 'users.first_name', 'users.last_name', 'users.email', 'users.phone',
                'users.is_active', 'users.avatar_url', 'users.organization_id',
                'roles.name as role_name', 'roles.side as role_side',
                'organizations.name as organization_name'
            )
            .where('users.id', userId)
            .first();

        if (!user) return res.status(404).json({ error: 'User not found.' });

        let activeAssignments = [];

        if (user.role_side === 'client' && user.organization_id) {
            activeAssignments = await db('assignments')
                .where('organization_id', user.organization_id)
                .where('is_active', true)
                .select('id', 'name');
        } else if (user.role_side === 'consulting') {
            const memberAssignments = await db('assignments')
                .join('assignment_team_members', 'assignments.id', 'assignment_team_members.assignment_id')
                .where('assignment_team_members.user_id', userId)
                .where('assignments.is_active', true)
                .select('assignments.id', 'assignments.name');

            const pocAssignments = await db('assignments')
                .where('faber_poc_id', userId)
                .where('is_active', true)
                .select('id', 'name');
                
            const allAssignments = [...memberAssignments, ...pocAssignments];
            const uniqueAssignmentsMap = new Map();
            allAssignments.forEach(a => uniqueAssignmentsMap.set(a.id, a));
            activeAssignments = Array.from(uniqueAssignmentsMap.values());
        }

        // Fetch active projects for each active assignment
        for (let assignment of activeAssignments) {
            assignment.projects = await db('projects')
                .where('assignment_id', assignment.id)
                .where('is_active', true)
                .select('id', 'name')
                .orderBy('name');
        }

        res.json({
            ...user,
            active_assignments: activeAssignments
        });

    } catch (err) {
        console.error('Get user details error:', err);
        res.status(500).json({ error: 'Failed to fetch user details.' });
    }
});

// GET /api/users/roles
router.get('/roles', authenticate, async (req, res) => {
    try {
        const roles = await db('roles').where({ is_active: true }).orderBy('side').orderBy('hierarchy_level');
        res.json(roles);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch roles.' });
    }
});

// POST /api/users — Create a new user (Director/Manager only)
router.post('/', authenticate, async (req, res) => {
    try {
        // Only Director (hierarchy_level 1) and Manager (hierarchy_level 2) can create users
        if (req.user.hierarchy_level > 2) {
            return res.status(403).json({ error: 'You do not have permission to create users.' });
        }

        const { first_name, last_name, email, password, role_id, phone } = req.body;

        if (!first_name || !last_name || !email || !password || !role_id) {
            return res.status(400).json({ error: 'first_name, last_name, email, password, and role_id are required.' });
        }

        // ─── Privilege escalation prevention ───
        // Verify the target role exists and that the requesting user
        // cannot assign a role with equal or higher privilege than their own.
        const targetRole = await db('roles').where({ id: role_id }).first();
        if (!targetRole) {
            return res.status(400).json({ error: 'Invalid role selected.' });
        }
        // hierarchy_level 1 = Director (most privileged). A Manager (level 2)
        // should only be able to create users at level 3+ (less privileged).
        // Directors (level 1) can create any role.
        if (req.user.hierarchy_level !== 1 && targetRole.hierarchy_level <= req.user.hierarchy_level) {
            return res.status(403).json({ error: 'You cannot assign a role with equal or higher privilege than your own.' });
        }

        const existing = await db('users').where({ email, is_active: true }).first();
        if (existing) {
            return res.status(409).json({ error: 'Email already registered.' });
        }

        const password_hash = await bcrypt.hash(password, 10);

        const [user] = await db('users')
            .insert({
                first_name,
                last_name,
                email,
                password_hash,
                role_id,
                phone: phone || null,
                organization_id: null,
            })
            .returning(['id', 'first_name', 'last_name', 'email', 'role_id']);

        // Fetch the role name for the response
        const role = await db('roles').where({ id: role_id }).first();

        res.status(201).json({
            ...user,
            role_name: role ? role.name : null,
            role_side: role ? role.side : null,
        });
    } catch (err) {
        console.error('Create user error:', err);
        if (err.code === '23505') {
            return res.status(409).json({ error: 'This email is already in use by an active or deleted account.' });
        }
        res.status(500).json({ error: 'Failed to create user.' });
    }
});

// GET /api/users/sample-excel — Download a sample Excel template
router.get('/sample-excel', authenticate, (req, res) => {
    const samplePath = path.resolve(__dirname, '../assets/samples/sample_users.xlsx');
    if (!fs.existsSync(samplePath)) {
        return res.status(404).json({ error: 'Sample file not found on server.' });
    }
    return res.download(samplePath, 'sample_users.xlsx');
});

// POST /api/users/bulk/validate — Validate an Excel file and return data + errors for frontend review
router.post('/bulk/validate', authenticate, upload.single('file'), async (req, res) => {
    try {
        if (req.user.hierarchy_level > 2) {
            return res.status(403).json({ error: 'You do not have permission to create users.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (rows.length === 0) {
            return res.status(400).json({ error: 'The Excel file is empty or has no data rows.' });
        }

        const allRoles = await db('roles').where({ is_active: true });
        const existingUsers = await db('users').select('email', 'is_active');
        const activeEmails = new Set(existingUsers.filter(u => u.is_active).map(u => u.email.toLowerCase()));
        const inactiveEmails = new Set(existingUsers.filter(u => !u.is_active).map(u => u.email.toLowerCase()));

        const validatedRows = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const firstName = String(row['First Name'] || '').trim();
            const lastName = String(row['Last Name'] || '').trim();
            const email = String(row['Email'] || '').trim();
            const password = String(row['Password'] || '').trim();
            const roleName = String(row['Role'] || '').trim();
            const phone = String(row['Phone'] || '').trim();

            const rowErrors = [];
            const rowWarnings = [];

            if (!firstName) rowErrors.push('First Name is required');
            if (!lastName) rowErrors.push('Last Name is required');
            if (!email) rowErrors.push('Email is required');
            if (!password) rowErrors.push('Password is required');
            if (!roleName) rowErrors.push('Role is required');

            if (password && password.length < 6) {
                rowErrors.push('Password must be at least 6 characters');
            }

            if (email) {
                if (activeEmails.has(email.toLowerCase())) {
                    rowErrors.push('Email already exists');
                } else if (inactiveEmails.has(email.toLowerCase())) {
                    rowWarnings.push('User previously existed. They will be restored with these details.');
                }
            }

            if (roleName) {
                const matchedRole = allRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
                if (!matchedRole) {
                    rowErrors.push(`Invalid role: ${roleName}`);
                }
            }

            validatedRows.push({
                id: Date.now() + i, // temporary ID for frontend tracking
                first_name: firstName,
                last_name: lastName,
                email: email,
                // Note: Password is sent back because the frontend needs it for inline editing
                // and re-submission to /bulk/confirm. Data originates from the user's own Excel file.
                password: password,
                role_name: roleName,
                phone: phone,
                errors: rowErrors,
                warnings: rowWarnings
            });
            
            // Note: We don't add to existingEmails here because the user might fix duplicates in the frontend table
        }

        res.json({ rows: validatedRows });
    } catch (err) {
        console.error('Bulk validate error:', err);
        res.status(500).json({ error: `Failed to validate file: ${err.message}` });
    }
});

// POST /api/users/bulk/confirm — Accept validated/edited JSON data and insert
router.post('/bulk/confirm', authenticate, async (req, res) => {
    try {
        if (req.user.hierarchy_level > 2) {
            return res.status(403).json({ error: 'You do not have permission to create users.' });
        }

        const { users } = req.body;
        if (!users || !Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ error: 'No user data provided.' });
        }

        const allRoles = await db('roles').where({ is_active: true });
        const existingUsers = await db('users').select('id', 'email', 'is_active');
        const activeEmails = new Set(existingUsers.filter(u => u.is_active).map(u => u.email.toLowerCase()));
        const inactiveUsersMap = new Map();
        existingUsers.filter(u => !u.is_active).forEach(u => inactiveUsersMap.set(u.email.toLowerCase(), u));

        const createdUsers = [];
        const errors = [];
        let created = 0;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const rowNum = i + 1;
            
            const firstName = (user.first_name || '').trim();
            const lastName = (user.last_name || '').trim();
            const email = (user.email || '').trim();
            const password = (user.password || '').trim();
            const roleName = (user.role_name || '').trim();
            const phone = (user.phone || '').trim();

            const missing = [];
            if (!firstName) missing.push('First Name');
            if (!lastName) missing.push('Last Name');
            if (!email) missing.push('Email');
            if (!password) missing.push('Password');
            if (!roleName) missing.push('Role');

            if (missing.length > 0) {
                errors.push(`Row ${rowNum}: Missing fields — ${missing.join(', ')}`);
                continue;
            }

            if (password.length < 6) {
                errors.push(`Row ${rowNum}: Password must be at least 6 characters`);
                continue;
            }

            if (activeEmails.has(email.toLowerCase())) {
                errors.push(`Row ${rowNum}: Email "${email}" already exists`);
                continue;
            }

            const matchedRole = allRoles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
            if (!matchedRole) {
                errors.push(`Row ${rowNum}: Role "${roleName}" not found`);
                continue;
            }

            // ─── Privilege escalation prevention ───
            if (req.user.hierarchy_level !== 1 && matchedRole.hierarchy_level <= req.user.hierarchy_level) {
                errors.push(`Row ${rowNum}: You cannot assign the "${matchedRole.name}" role (equal or higher privilege than your own).`);
                continue;
            }

            const password_hash = await bcrypt.hash(password, 10);
            const inactiveUser = inactiveUsersMap.get(email.toLowerCase());

            if (inactiveUser) {
                // Restore user
                await db('users').where({ id: inactiveUser.id }).update({
                    first_name: firstName,
                    last_name: lastName,
                    password_hash,
                    role_id: matchedRole.id,
                    phone: phone || null,
                    is_active: true
                });

                createdUsers.push({
                    id: inactiveUser.id,
                    first_name: firstName,
                    last_name: lastName,
                    email: email,
                    role_id: matchedRole.id,
                    role_name: matchedRole.name,
                    role_side: matchedRole.side,
                });
            } else {
                // Insert new user
                const [newUser] = await db('users')
                    .insert({
                        first_name: firstName,
                        last_name: lastName,
                        email,
                        password_hash,
                        role_id: matchedRole.id,
                        phone: phone || null,
                        organization_id: null,
                    })
                    .returning(['id', 'first_name', 'last_name', 'email', 'role_id']);

                createdUsers.push({
                    ...newUser,
                    role_name: matchedRole.name,
                    role_side: matchedRole.side,
                });
            }

            activeEmails.add(email.toLowerCase());
            created++;
        }

        res.json({ created, errors, users: createdUsers });
    } catch (err) {
        console.error('Bulk confirm error:', err);
        let errMsg = err.message;
        if (err.code === '23505') {
            errMsg = 'An email already belongs to a registered or deleted user. Please ensure all emails are unique.';
        }
        res.status(500).json({ error: `Failed to confirm upload: ${errMsg}` });
    }
});

// GET /api/users/:id/deletion-check — Check if user has unfinished projects/assignments
router.get('/:id/deletion-check', authenticate, async (req, res) => {
    try {
        if (req.user.hierarchy_level > 2) {
            return res.status(403).json({ error: 'Not authorized to check deletion constraints.' });
        }

        const userId = req.params.id;

        const userToDelete = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .select('users.*', 'roles.side as role_side')
            .where('users.id', userId)
            .first();

        if (!userToDelete) return res.status(404).json({ error: 'User not found.' });

        const unfinishedProjects = [];
        const unfinishedAssignments = [];

        if (userToDelete.role_side === 'client' && userToDelete.organization_id) {
            const orgAssignments = await db('assignments')
                .where('organization_id', userToDelete.organization_id)
                .where('is_active', true);

            for (const assignment of orgAssignments) {
                const projects = await db('projects').where('assignment_id', assignment.id).where('is_active', true);
                let allCompleted = true;
                if (projects.length === 0) allCompleted = false;
                
                for (const project of projects) {
                    const taskStats = await db('project_tasks')
                        .where({ project_id: project.id })
                        .select(
                            db.raw('COUNT(*) as total'),
                            db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed")
                        )
                        .first();
                    const total = parseInt(taskStats.total, 10) || 0;
                    const completed = parseInt(taskStats.completed, 10) || 0;
                    const status = deriveProjectWorkflowStatus(total, completed);
                    if (status !== 'completed') {
                        allCompleted = false;
                    }
                }

                if (!allCompleted) {
                    unfinishedAssignments.push(assignment.name);
                }
            }
        } else {
            const directProjects = await db('project_members')
                .join('projects', 'project_members.project_id', 'projects.id')
                .select('projects.id', 'projects.name')
                .where('project_members.user_id', userId)
                .where('projects.is_active', true);

            const assignmentProjects = await db('assignment_team_members')
                .join('projects', 'assignment_team_members.assignment_id', 'projects.assignment_id')
                .select('projects.id', 'projects.name')
                .where('assignment_team_members.user_id', userId)
                .where('projects.is_active', true);

            const pocProjects = await db('assignments')
                .join('projects', 'assignments.id', 'projects.assignment_id')
                .select('projects.id', 'projects.name')
                .where('assignments.faber_poc_id', userId)
                .where('projects.is_active', true);

            const allUserProjects = [...directProjects, ...assignmentProjects, ...pocProjects];
            const uniqueProjects = Array.from(new Set(allUserProjects.map(p => p.id)))
                .map(id => allUserProjects.find(p => p.id === id));

            for (const project of uniqueProjects) {
                const taskStats = await db('project_tasks')
                    .where({ project_id: project.id })
                    .select(
                        db.raw('COUNT(*) as total'),
                        db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed")
                    )
                    .first();

                const total = parseInt(taskStats.total, 10) || 0;
                const completed = parseInt(taskStats.completed, 10) || 0;

                const status = deriveProjectWorkflowStatus(total, completed);
                if (status !== 'completed') {
                    unfinishedProjects.push(project.name);
                }
            }
        }

        res.json({ unfinished_projects: unfinishedProjects, unfinished_assignments: unfinishedAssignments });
    } catch (err) {
        console.error('Deletion check error:', err);
        res.status(500).json({ error: 'Failed to check deletion status.' });
    }
});

// DELETE /api/users/:id — Delete a user (Soft delete)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        if (req.user.hierarchy_level > 2) {
            return res.status(403).json({ error: 'You do not have permission to delete users.' });
        }

        const userId = req.params.id;
        const force = req.query.force === 'true';

        // Fetch the user to determine role side and organization
        const userToDelete = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .select('users.*', 'roles.side as role_side')
            .where('users.id', userId)
            .first();

        if (!userToDelete) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const unfinishedProjects = [];
        const unfinishedAssignments = [];

        if (userToDelete.role_side === 'client' && userToDelete.organization_id) {
            // Find assignments for this client's organization
            const orgAssignments = await db('assignments')
                .where('organization_id', userToDelete.organization_id)
                .where('is_active', true);

            for (const assignment of orgAssignments) {
                const projects = await db('projects').where('assignment_id', assignment.id).where('is_active', true);
                let allCompleted = true;
                if (projects.length === 0) allCompleted = false; // Assignment with no projects is active
                
                for (const project of projects) {
                    const taskStats = await db('project_tasks')
                        .where({ project_id: project.id })
                        .select(
                            db.raw('COUNT(*) as total'),
                            db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed")
                        )
                        .first();
                    const total = parseInt(taskStats.total, 10) || 0;
                    const completed = parseInt(taskStats.completed, 10) || 0;
                    const status = deriveProjectWorkflowStatus(total, completed);
                    if (status !== 'completed') {
                        allCompleted = false;
                    }
                }

                if (!allCompleted) {
                    unfinishedAssignments.push(assignment.name);
                }
            }
        } else {
            // Find projects for consulting users
            const directProjects = await db('project_members')
                .join('projects', 'project_members.project_id', 'projects.id')
                .select('projects.id', 'projects.name')
                .where('project_members.user_id', userId)
                .where('projects.is_active', true);

            const assignmentProjects = await db('assignment_team_members')
                .join('projects', 'assignment_team_members.assignment_id', 'projects.assignment_id')
                .select('projects.id', 'projects.name')
                .where('assignment_team_members.user_id', userId)
                .where('projects.is_active', true);

            const pocProjects = await db('assignments')
                .join('projects', 'assignments.id', 'projects.assignment_id')
                .select('projects.id', 'projects.name')
                .where('assignments.faber_poc_id', userId)
                .where('projects.is_active', true);

            const allUserProjects = [...directProjects, ...assignmentProjects, ...pocProjects];
            const uniqueProjects = Array.from(new Set(allUserProjects.map(p => p.id)))
                .map(id => allUserProjects.find(p => p.id === id));

            for (const project of uniqueProjects) {
                const taskStats = await db('project_tasks')
                    .where({ project_id: project.id })
                    .select(
                        db.raw('COUNT(*) as total'),
                        db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed")
                    )
                    .first();

                const total = parseInt(taskStats.total, 10) || 0;
                const completed = parseInt(taskStats.completed, 10) || 0;

                const status = deriveProjectWorkflowStatus(total, completed);
                if (status !== 'completed') {
                    unfinishedProjects.push(project.name);
                }
            }
        }

        if (unfinishedProjects.length > 0 && !force) {
            return res.status(409).json({
                error: 'User is assigned to unfinished projects.',
                unfinished_projects: unfinishedProjects
            });
        }

        if (unfinishedAssignments.length > 0 && !force) {
            return res.status(409).json({
                error: 'Client organization has unfinished assignments.',
                unfinished_assignments: unfinishedAssignments
            });
        }

        // Soft delete the user
        await db('users').where({ id: userId }).update({ is_active: false });

        res.json({ message: 'User deleted successfully.' });
    } catch (err) {
        console.error('Delete user error:', err);
        if (err.code === '23503') {
            return res.status(409).json({ error: 'Cannot permanently delete this user because they are still referenced in completed projects or assignments in the database.' });
        }
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

module.exports = router;

// PUT /api/users/:id/restore — Restore a soft-deleted user and update their info
router.put('/:id/restore', authenticate, async (req, res) => {
    try {
        if (req.user.hierarchy_level > 2) {
            return res.status(403).json({ error: 'You do not have permission to restore users.' });
        }

        const userId = req.params.id;
        const { first_name, last_name, role_id, phone, organization_id } = req.body;

        const updateData = { is_active: true };
        if (first_name) updateData.first_name = first_name;
        if (last_name) updateData.last_name = last_name;
        if (role_id) updateData.role_id = role_id;
        if (phone !== undefined) updateData.phone = phone;
        if (organization_id !== undefined) updateData.organization_id = organization_id;

        await db('users').where({ id: userId }).update(updateData);
        
        const restoredUser = await db('users')
            .join('roles', 'users.role_id', 'roles.id')
            .leftJoin('organizations', 'users.organization_id', 'organizations.id')
            .select(
                'users.id', 'users.first_name', 'users.last_name', 'users.email', 'users.phone',
                'users.is_active', 'users.avatar_url', 'users.organization_id',
                'roles.name as role_name', 'roles.side as role_side',
                'organizations.name as organization_name'
            )
            .where('users.id', userId)
            .first();

        res.json({ message: 'User restored successfully.', user: restoredUser });
    } catch (err) {
        console.error('Restore user error:', err);
        res.status(500).json({ error: 'Failed to restore user.' });
    }
});
