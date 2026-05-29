const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { calculateAssignmentProgress } = require('../utils/assignmentProgress');
const { deriveProjectWorkflowStatus, deriveAssignmentWorkflowStatus } = require('../utils/workflowStatus');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const query = db('organizations')
            .select('organizations.*')
            .where('organizations.is_active', true)
            .orderBy('organizations.name');

        if (req.user.role_name === 'Client') {
            query.where('organizations.id', req.user.organization_id);
        }

        if (req.user.role_side === 'consulting' && req.user.hierarchy_level >= 4) {
            query.whereIn('organizations.id', function() {
                this.select('assignments.organization_id')
                    .from('assignments')
                    .join('assignment_team_members', 'assignments.id', 'assignment_team_members.assignment_id')
                    .where('assignment_team_members.user_id', req.user.id);
            });
        }

        const orgs = await query;

        const enriched = await Promise.all(
            orgs.map(async (org) => {
                const [{ count: assignmentCount }] = await db('assignments').where({ organization_id: org.id, is_active: true }).count();
                const [{ count: projectCount }] = await db('projects')
                    .join('assignments', 'projects.assignment_id', 'assignments.id')
                    .where({ 'assignments.organization_id': org.id, 'projects.is_active': true })
                    .count();
                return { ...org, assignment_count: parseInt(assignmentCount, 10), project_count: parseInt(projectCount, 10) };
            })
        );

        res.json(enriched);
    } catch (err) {
        console.error('Get orgs error:', err);
        res.status(500).json({ error: 'Failed to fetch organizations.' });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const org = await db('organizations').where({ id: req.params.id }).first();
        if (!org) return res.status(404).json({ error: 'Organization not found.' });

        if (req.user.role_name === 'Client' && org.id !== req.user.organization_id) {
            return res.status(403).json({ error: 'Not authorized to view this organization.' });
        }

        if (req.user.role_side === 'consulting' && req.user.hierarchy_level >= 4) {
            const hasAccess = await db('assignments')
                .join('assignment_team_members', 'assignments.id', 'assignment_team_members.assignment_id')
                .where('assignments.organization_id', org.id)
                .andWhere('assignment_team_members.user_id', req.user.id)
                .first();
            if (!hasAccess) {
                return res.status(403).json({ error: 'Not authorized to view this organization.' });
            }
        }

        const assignments = await db('assignments').where({ organization_id: org.id, is_active: true });

        const enriched = await Promise.all(
            assignments.map(async (assignment) => {
                const projects = await db('projects').where({ assignment_id: assignment.id, is_active: true }).select('id', 'progress_percentage');
                const projectIds = projects.map((project) => project.id);

                let totalTasks = 0;
                let completedTasks = 0;
                let projectStatuses = [];

                if (projectIds.length > 0) {
                    const projectTaskStats = await Promise.all(
                        projectIds.map(async (projectId) => {
                            const stats = await db('project_tasks')
                                .where({ project_id: projectId })
                                .select(
                                    db.raw('COUNT(*) as total'),
                                    db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed")
                                )
                                .first();

                            const taskTotal = parseInt(stats.total, 10) || 0;
                            const taskCompleted = parseInt(stats.completed, 10) || 0;
                            totalTasks += taskTotal;
                            completedTasks += taskCompleted;
                            projectStatuses.push(deriveProjectWorkflowStatus(taskTotal, taskCompleted));
                        })
                    );
                    void projectTaskStats;
                }

                return {
                    ...assignment,
                    status: deriveAssignmentWorkflowStatus(projectStatuses),
                    project_count: projects.length,
                    total_tasks: totalTasks,
                    completed_tasks: completedTasks,
                    progress_percentage: calculateAssignmentProgress(projects),
                };
            })
        );

        res.json({ ...org, assignments: enriched });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch organization.' });
    }
});

router.post('/', authenticate, authorize('organizations', 'can_create'), async (req, res) => {
    try {
        const { name, industry, website, address, city, state, country, pincode, phone, email, password } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required.' });
        if (!email) return res.status(400).json({ error: 'Email is required.' });
        if (!password) return res.status(400).json({ error: 'Password is required for client login.' });

        const result = await db.transaction(async (trx) => {
            const [org] = await trx('organizations')
                .insert({ name, industry, website, address, city, state, country, pincode, phone, email })
                .returning('*');

            // Auto-provision a user account for the new client
            const existingUser = await trx('users').where({ email }).first();
            if (!existingUser) {
                let clientRole = await trx('roles').where({ name: 'Client' }).first();
                if (clientRole) {
                    const bcrypt = require('bcryptjs');
                    const password_hash = await bcrypt.hash(password, 10);
                    await trx('users').insert({
                        first_name: name,
                        last_name: 'POC',
                        email: email,
                        phone: phone || null,
                        password_hash,
                        role_id: clientRole.id,
                        organization_id: org.id
                    });
                }
            }

            return org;
        });

        res.status(201).json(result);
    } catch (err) {
        console.error('Create org error:', err);
        res.status(500).json({ error: 'Failed to create organization.' });
    }
});

router.put('/:id', authenticate, authorize('organizations', 'can_edit'), async (req, res) => {
    try {
        const { name, industry, website, address, city, state, country, pincode, phone, email } = req.body;
        const [org] = await db('organizations').where({ id: req.params.id }).update({ name, industry, website, address, city, state, country, pincode, phone, email, updated_at: db.fn.now() }).returning('*');
        if (!org) return res.status(404).json({ error: 'Organization not found.' });
        res.json(org);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update organization.' });
    }
});

router.delete('/:id', authenticate, authorize('organizations', 'can_delete'), async (req, res) => {
    try {
        await db.transaction(async (trx) => {
            await trx('organizations').where({ id: req.params.id }).update({ is_active: false });

            const assignments = await trx('assignments').where({ organization_id: req.params.id }).select('id');
            if (assignments.length > 0) {
                const assignmentIds = assignments.map((assignment) => assignment.id);
                await trx('assignments').whereIn('id', assignmentIds).update({ is_active: false });
                await trx('projects').whereIn('assignment_id', assignmentIds).update({ is_active: false });
            }
        });
        res.json({ message: 'Organization and related assignments/projects deactivated.' });
    } catch (err) {
        console.error('Cascading delete org error:', err);
        res.status(500).json({ error: 'Failed to delete organization.' });
    }
});

module.exports = router;
