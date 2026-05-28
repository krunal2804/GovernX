const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { resequenceProjectTasks } = require('../utils/projectTaskOrder');
const { calculateAssignmentProgress } = require('../utils/assignmentProgress');
const { deriveProjectWorkflowStatus, deriveAssignmentWorkflowStatus } = require('../utils/workflowStatus');

const router = express.Router();

async function fetchProjectSummariesForAssignment(knex, assignmentId) {
    const projects = await knex('projects')
        .join('services', 'projects.service_id', 'services.id')
        .select('projects.*', 'services.name as service_name')
        .where({ assignment_id: assignmentId, 'projects.is_active': true });

    return Promise.all(
        projects.map(async (project) => {
            const taskStats = await knex('project_tasks')
                .where({ project_id: project.id })
                .select(
                    knex.raw('COUNT(*) as total'),
                    knex.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed"),
                    knex.raw("COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'skipped')) as overdue")
                )
                .first();

            const totalTasks = parseInt(taskStats.total, 10) || 0;
            const completedTasks = parseInt(taskStats.completed, 10) || 0;

            return {
                ...project,
                status: deriveProjectWorkflowStatus(totalTasks, completedTasks),
                task_total: totalTasks,
                task_completed: completedTasks,
                task_overdue: parseInt(taskStats.overdue, 10) || 0,
            };
        })
    );
}

router.get('/', authenticate, async (req, res) => {
    try {
        const { organization_id } = req.query;
        let query = db('assignments')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .select('assignments.*', 'organizations.name as organization_name')
            .where('assignments.is_active', true);

        if (organization_id) query = query.where('assignments.organization_id', organization_id);

        if (req.user && req.user.role_name === 'Client' && req.user.organization_id) {
            query = query.where('assignments.organization_id', req.user.organization_id);
        } else if (req.user && req.user.role_side === 'consulting' && req.user.hierarchy_level >= 4) {
            query = query.where(function() {
                this.where('assignments.created_by', req.user.id)
                    .orWhere('assignments.faber_poc_id', req.user.id)
                    .orWhereExists(function() {
                        this.select('id')
                            .from('assignment_team_members')
                            .whereRaw('assignment_team_members.assignment_id = assignments.id')
                            .where('assignment_team_members.user_id', req.user.id);
                    });
            });
        }

        const assignments = await query.orderBy('assignments.name');

        const enriched = await Promise.all(
            assignments.map(async (assignment) => {
                const projects = await fetchProjectSummariesForAssignment(db, assignment.id);

                return {
                    ...assignment,
                    status: deriveAssignmentWorkflowStatus(projects.map((project) => project.status)),
                    project_count: projects.length,
                    overall_progress: calculateAssignmentProgress(projects),
                };
            })
        );

        res.json(enriched);
    } catch (err) {
        console.error('Get assignments error:', err);
        res.status(500).json({ error: 'Failed to fetch assignments.' });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const assignment = await db('assignments')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .leftJoin('users as poc', 'assignments.faber_poc_id', 'poc.id')
            .leftJoin('users as creator', 'assignments.created_by', 'creator.id')
            .select(
                'assignments.*',
                'organizations.name as organization_name',
                db.raw("CONCAT(poc.first_name, ' ', poc.last_name) as faber_poc_name"),
                db.raw("CONCAT(creator.first_name, ' ', creator.last_name) as created_by_name")
            )
            .where('assignments.id', req.params.id)
            .where('assignments.is_active', true)
            .first();

        if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });

        if (req.user.role_name === 'Client' && assignment.organization_id !== req.user.organization_id) {
            return res.status(403).json({ error: 'Not authorized to view this assignment.' });
        }

        if (req.user.role_side === 'consulting' && req.user.hierarchy_level >= 4) {
            const isMember = await db('assignment_team_members')
                .where({ assignment_id: assignment.id, user_id: req.user.id })
                .first();
            if (!isMember && assignment.created_by !== req.user.id && assignment.faber_poc_id !== req.user.id) {
                return res.status(403).json({ error: 'Not authorized to view this assignment.' });
            }
        }

        const teamMember = await db('assignment_team_members')
            .where({ assignment_id: assignment.id, user_id: req.user.id })
            .first();
        assignment.my_title = teamMember?.title || 'Consultant';

        const projects = await fetchProjectSummariesForAssignment(db, assignment.id);

        // Fetch team members with user details
        const teamMembers = await db('assignment_team_members')
            .join('users', 'assignment_team_members.user_id', 'users.id')
            .where({ 'assignment_team_members.assignment_id': assignment.id })
            .select(
                'assignment_team_members.id',
                'assignment_team_members.user_id',
                'assignment_team_members.title',
                'users.first_name',
                'users.last_name',
                'users.email'
            );

        // Fetch consulting days
        const consultingDays = await db('assignment_consulting_days')
            .where({ assignment_id: assignment.id })
            .select('*')
            .orderBy('period_index');

        res.json({
            ...assignment,
            status: deriveAssignmentWorkflowStatus(projects.map((project) => project.status)),
            overall_progress: calculateAssignmentProgress(projects),
            projects,
            team_members: teamMembers,
            consulting_days: consultingDays,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch assignment.' });
    }
});

router.post('/', authenticate, authorize('assignments', 'can_create'), async (req, res) => {
    try {
        const {
            organization_id, name, location, description, start_date, projects,
            faber_poc_id, top_management_name, top_management_designation, top_management_mobile, top_management_email,
            client_poc_name, client_poc_designation, client_poc_mobile, client_poc_email,
            logistics_poc_name, logistics_poc_designation, logistics_poc_mobile, logistics_poc_email, logistics_arrangements,
            conf_data_sharing, conf_aae_communication, special_instructions,
            schedule_type, team_members, consulting_days
        } = req.body;
        if (!organization_id || !name) return res.status(400).json({ error: 'organization_id and name are required.' });

        const assignment = await db.transaction(async (trx) => {
            const [newAssignment] = await trx('assignments')
                .insert({
                    organization_id, name, location, description,
                    start_date: start_date || null,
                    faber_poc_id: faber_poc_id || null,
                    top_management_name, top_management_designation, top_management_mobile, top_management_email,
                    client_poc_name, client_poc_designation, client_poc_mobile, client_poc_email,
                    logistics_poc_name, logistics_poc_designation, logistics_poc_mobile, logistics_poc_email,
                    logistics_arrangements: logistics_arrangements ? JSON.stringify(logistics_arrangements) : '{}',
                    conf_data_sharing: !!conf_data_sharing,
                    conf_aae_communication: !!conf_aae_communication,
                    special_instructions: special_instructions || null,
                    schedule_type: schedule_type || 'month',
                    created_by: req.user.id
                })
                .returning('*');

            if (projects && Array.isArray(projects) && projects.length > 0) {
                for (const proj of projects) {
                    if (!proj.name || !proj.service_id) continue;

                    const [newProject] = await trx('projects')
                        .insert({
                            assignment_id: newAssignment.id,
                            service_id: proj.service_id,
                            name: proj.name,
                            description: proj.description || null,
                            project_code: proj.project_code || null,
                            start_date: proj.start_date || null,
                            created_by: req.user.id
                        })
                        .returning('*');

                    const serviceSteps = await trx('service_steps')
                        .where({ service_id: proj.service_id, is_active: true })
                        .orderBy('sequence_order');

                    if (serviceSteps.length > 0) {
                        const stepIds = serviceSteps.map((step) => step.id);
                        const serviceTasks = await trx('service_tasks')
                            .join('service_steps', 'service_tasks.service_step_id', 'service_steps.id')
                            .whereIn('service_tasks.service_step_id', stepIds)
                            .where({ 'service_tasks.is_active': true })
                            .select('service_tasks.*', 'service_steps.sequence_order as step_sequence_order')
                            .orderBy('service_steps.sequence_order')
                            .orderBy('service_tasks.sequence_order')
                            .orderBy('service_tasks.id');

                        if (serviceTasks.length > 0) {
                            const projectTasks = serviceTasks.map((serviceTask, index) => {
                                const stepName = serviceSteps.find((step) => step.id === serviceTask.service_step_id)?.name || null;

                                let taskStart = null;
                                let taskDue = null;
                                if (proj.start_date && serviceTask.default_duration_days) {
                                    taskStart = proj.start_date;
                                    const due = new Date(proj.start_date);
                                    due.setDate(due.getDate() + serviceTask.default_duration_days);
                                    taskDue = due.toISOString().split('T')[0];
                                }
                                return {
                                    project_id: newProject.id,
                                    service_task_id: serviceTask.id,
                                    step_name: stepName,
                                    name: serviceTask.name,
                                    description: serviceTask.description,
                                    sequence_order: index + 1,
                                    is_mandatory: serviceTask.is_mandatory,
                                    start_date: taskStart,
                                    due_date: taskDue,
                                };
                            });
                            await trx('project_tasks').insert(projectTasks);
                            await resequenceProjectTasks(trx, newProject.id);
                        }
                    }

                    await trx('project_members').insert({
                        project_id: newProject.id,
                        user_id: req.user.id,
                        role_id: req.user.role_id,
                        is_primary: true,
                    });

                    await trx('project_timeline_events').insert({
                        project_id: newProject.id,
                        event_type: 'milestone',
                        title: 'Project Created',
                        description: `Project "${proj.name}" was created during assignment creation.`,
                        created_by: req.user.id,
                    });
                }
            }

            if (team_members && Array.isArray(team_members) && team_members.length > 0) {
                for (const member of team_members) {
                    const [tm] = await trx('assignment_team_members')
                        .insert({
                            assignment_id: newAssignment.id,
                            user_id: member.user_id,
                            title: member.title || null
                        })
                        .returning('*');

                    if (consulting_days && Array.isArray(consulting_days)) {
                        const memberDays = consulting_days
                            .filter((day) => String(day.user_id) === String(member.user_id))
                            .map((day) => ({
                                assignment_id: newAssignment.id,
                                team_member_id: tm.id,
                                period_label: day.period_label,
                                period_index: day.period_index,
                                days: day.days || 0
                            }));
                        if (memberDays.length > 0) {
                            await trx('assignment_consulting_days').insert(memberDays);
                        }
                    }

                    await trx('notifications').insert({
                        user_id: member.user_id,
                        title: 'New Assignment Added',
                        message: `You have been added to the team for "${newAssignment.name}"`,
                        type: 'general',
                        reference_type: 'assignment',
                        reference_id: newAssignment.id,
                        is_read: false
                    });
                }
            }

            return newAssignment;
        });

        res.status(201).json(assignment);
    } catch (err) {
        console.error('Create assignment error:', err);
        res.status(500).json({ error: 'Failed to create assignment and projects: ' + err.message });
    }
});

router.put('/:id', authenticate, authorize('assignments', 'can_edit'), async (req, res) => {
    try {
        const {
            name, location, description, start_date,
            faber_poc_id, top_management_name, top_management_designation, top_management_mobile, top_management_email,
            client_poc_name, client_poc_designation, client_poc_mobile, client_poc_email,
            logistics_poc_name, logistics_poc_designation, logistics_poc_mobile, logistics_poc_email, logistics_arrangements,
            conf_data_sharing, conf_aae_communication, special_instructions,
            schedule_type, team_members, consulting_days
        } = req.body;

        const result = await db.transaction(async (trx) => {
            const [assignment] = await trx('assignments')
                .where({ id: req.params.id })
                .update({
                    name, location, description,
                    start_date: start_date || null,
                    faber_poc_id: faber_poc_id || null,
                    top_management_name, top_management_designation, top_management_mobile, top_management_email,
                    client_poc_name, client_poc_designation, client_poc_mobile, client_poc_email,
                    logistics_poc_name, logistics_poc_designation, logistics_poc_mobile, logistics_poc_email,
                    logistics_arrangements: logistics_arrangements ? JSON.stringify(logistics_arrangements) : '{}',
                    conf_data_sharing: !!conf_data_sharing,
                    conf_aae_communication: !!conf_aae_communication,
                    special_instructions: special_instructions || null,
                    schedule_type: schedule_type || 'month',
                    updated_at: trx.fn.now()
                })
                .returning('*');
            if (!assignment) return null;

            await trx('assignment_consulting_days').where({ assignment_id: req.params.id }).del();
            await trx('assignment_team_members').where({ assignment_id: req.params.id }).del();

            if (team_members && Array.isArray(team_members) && team_members.length > 0) {
                for (const member of team_members) {
                    const [tm] = await trx('assignment_team_members')
                        .insert({
                            assignment_id: assignment.id,
                            user_id: member.user_id,
                            title: member.title || null
                        })
                        .returning('*');

                    if (consulting_days && Array.isArray(consulting_days)) {
                        const memberDays = consulting_days
                            .filter((day) => String(day.user_id) === String(member.user_id))
                            .map((day) => ({
                                assignment_id: assignment.id,
                                team_member_id: tm.id,
                                period_label: day.period_label,
                                period_index: day.period_index,
                                days: day.days || 0
                            }));
                        if (memberDays.length > 0) {
                            await trx('assignment_consulting_days').insert(memberDays);
                        }
                    }

                    await trx('notifications').insert({
                        user_id: member.user_id,
                        title: 'Assignment Updated',
                        message: `The assignment "${assignment.name}" has been updated and you are on the team.`,
                        type: 'general',
                        reference_type: 'assignment',
                        reference_id: assignment.id,
                        is_read: false
                    });
                }
            }
            return assignment;
        });

        if (!result) return res.status(404).json({ error: 'Assignment not found.' });
        res.json(result);
    } catch (err) {
        console.error('Update assignment error:', err);
        res.status(500).json({ error: 'Failed to update assignment: ' + err.message });
    }
});

router.delete('/:id', authenticate, authorize('assignments', 'can_delete'), async (req, res) => {
    try {
        await db.transaction(async (trx) => {
            await trx('assignments').where({ id: req.params.id }).update({ is_active: false });
            await trx('projects').where({ assignment_id: req.params.id }).update({ is_active: false });
            await trx('notifications').where({ reference_type: 'assignment', reference_id: req.params.id }).del();
        });
        res.json({ message: 'Assignment and related projects deactivated.' });
    } catch (err) {
        console.error('Cascading delete assignment error:', err);
        res.status(500).json({ error: 'Failed to delete assignment.' });
    }
});

module.exports = router;
