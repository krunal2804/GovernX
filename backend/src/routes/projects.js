const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const { buildTaskLockState, resequenceProjectTasks } = require('../utils/projectTaskOrder');
const { deriveProjectWorkflowStatusFromTasks, deriveProjectWorkflowStatus } = require('../utils/workflowStatus');

const router = express.Router();
const MAX_ACTION_PLAN_TITLE_LENGTH = 150;

async function fetchProjectForActionPlanAccess(projectId, user) {
    const project = await db('projects')
        .join('assignments', 'projects.assignment_id', 'assignments.id')
        .select('projects.id', 'assignments.organization_id')
        .where('projects.id', projectId)
        .first();

    if (!project) return { error: { status: 404, message: 'Project not found.' } };

    if (user.role_name === 'Client' && project.organization_id !== user.organization_id) {
        return { error: { status: 403, message: 'Not authorized to view this project.' } };
    }

    return { project };
}

router.get('/', authenticate, async (req, res) => {
    try {
        const { assignment_id, status, service_id } = req.query;
        let query = db('projects')
            .join('assignments', 'projects.assignment_id', 'assignments.id')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .join('services', 'projects.service_id', 'services.id')
            .select(
                'projects.*',
                'assignments.name as assignment_name',
                'organizations.name as organization_name',
                'organizations.id as organization_id',
                'services.name as service_name'
            )
            .where('projects.is_active', true);

        if (assignment_id) query = query.where('projects.assignment_id', assignment_id);
        if (status) query = query.where('projects.status', status === 'active' ? 'in_progress' : status);
        if (service_id) query = query.where('projects.service_id', service_id);

        if (req.user && req.user.role_name === 'Client' && req.user.organization_id) {
            query = query.where('assignments.organization_id', req.user.organization_id);
        }

        const projects = await query.orderBy('projects.created_at', 'desc');

        const enriched = await Promise.all(
            projects.map(async (p) => {
                const taskStats = await db('project_tasks')
                    .where({ project_id: p.id })
                    .select(
                        db.raw('COUNT(*) as total'),
                        db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed"),
                        db.raw("COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'skipped')) as overdue")
                    )
                    .first();

                const totalTasks = parseInt(taskStats.total, 10) || 0;
                const completedTasks = parseInt(taskStats.completed, 10) || 0;

                return {
                    ...p,
                    status: deriveProjectWorkflowStatus(totalTasks, completedTasks),
                    task_total: totalTasks,
                    task_completed: completedTasks,
                    task_overdue: parseInt(taskStats.overdue, 10) || 0,
                };
            })
        );

        res.json(enriched);
    } catch (err) {
        console.error('Get projects error:', err);
        res.status(500).json({ error: 'Failed to fetch projects.' });
    }
});

router.get('/:id', authenticate, async (req, res) => {
    try {
        const project = await db('projects')
            .join('assignments', 'projects.assignment_id', 'assignments.id')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .join('services', 'projects.service_id', 'services.id')
            .select(
                'projects.*',
                'assignments.name as assignment_name',
                'organizations.name as organization_name',
                'organizations.id as organization_id',
                'services.name as service_name'
            )
            .where('projects.id', req.params.id)
            .first();

        if (!project) return res.status(404).json({ error: 'Project not found.' });

        if (req.user.role_name === 'Client' && project.organization_id !== req.user.organization_id) {
            return res.status(403).json({ error: 'Not authorized to view this project.' });
        }

        const tasks = await db('project_tasks')
            .leftJoin('users', 'project_tasks.assigned_to', 'users.id')
            .leftJoin('service_tasks', 'project_tasks.service_task_id', 'service_tasks.id')
            .leftJoin('service_steps', 'service_tasks.service_step_id', 'service_steps.id')
            .select(
                'project_tasks.*',
                'users.first_name as assignee_first_name',
                'users.last_name as assignee_last_name',
                'service_tasks.sequence_order as service_task_sequence_order',
                'service_steps.sequence_order as service_step_sequence_order'
            )
            .where({ project_id: project.id })
            .orderBy('service_steps.sequence_order')
            .orderBy('service_tasks.sequence_order')
            .orderBy('project_tasks.sequence_order')
            .orderBy('project_tasks.id');

        for (let task of tasks) {
            if (task.service_task_id) {
                task.documents = await db('reference_documents')
                    .join('service_task_documents', 'reference_documents.id', 'service_task_documents.document_id')
                    .where('service_task_documents.service_task_id', task.service_task_id)
                    .select('reference_documents.*');
            } else {
                task.documents = [];
            }
        }

        const members = await db('assignment_team_members')
            .join('users', 'assignment_team_members.user_id', 'users.id')
            .join('roles', 'users.role_id', 'roles.id')
            .select('assignment_team_members.user_id', 'assignment_team_members.title', 'users.first_name', 'users.last_name', 'users.email', 'roles.name as role_name', 'roles.side')
            .where('assignment_team_members.assignment_id', project.assignment_id);

        const timeline = await db('project_timeline_events')
            .leftJoin('users', 'project_timeline_events.created_by', 'users.id')
            .select('project_timeline_events.*', 'users.first_name as created_by_name')
            .where({ project_id: project.id })
            .orderBy('event_date', 'desc');

        const lockedTasks = buildTaskLockState(tasks);

        res.json({
            ...project,
            status: deriveProjectWorkflowStatusFromTasks(lockedTasks),
            tasks: lockedTasks,
            members,
            timeline,
        });
    } catch (err) {
        console.error('Get project detail error:', err);
        res.status(500).json({ error: 'Failed to fetch project.' });
    }
});

router.post('/', authenticate, authorize('projects', 'can_create'), async (req, res) => {
    try {
        const { assignment_id, service_id, name, description, project_code, start_date } = req.body;
        if (!assignment_id || !service_id || !name) {
            return res.status(400).json({ error: 'assignment_id, service_id, and name are required.' });
        }

        const [project] = await db('projects')
            .insert({ assignment_id, service_id, name, description, project_code, start_date, created_by: req.user.id })
            .returning('*');

        const serviceSteps = await db('service_steps')
            .where({ service_id, is_active: true })
            .orderBy('sequence_order');

        if (serviceSteps.length > 0) {
            const stepIds = serviceSteps.map(s => s.id);
            const serviceTasks = await db('service_tasks')
                .join('service_steps', 'service_tasks.service_step_id', 'service_steps.id')
                .whereIn('service_tasks.service_step_id', stepIds)
                .where({ 'service_tasks.is_active': true })
                .select('service_tasks.*', 'service_steps.sequence_order as step_sequence_order')
                .orderBy('service_steps.sequence_order')
                .orderBy('service_tasks.sequence_order')
                .orderBy('service_tasks.id');

            if (serviceTasks.length > 0) {
                const projectTasks = serviceTasks.map((st, index) => {
                    const stepName = serviceSteps.find(s => s.id === st.service_step_id)?.name || null;

                    let taskStart = null;
                    let taskDue = null;
                    if (start_date && st.default_duration_days) {
                        taskStart = start_date;
                        const due = new Date(start_date);
                        due.setDate(due.getDate() + st.default_duration_days);
                        taskDue = due.toISOString().split('T')[0];
                    }
                    return {
                        project_id: project.id,
                        service_task_id: st.id,
                        step_name: stepName,
                        name: st.name,
                        description: st.description,
                        sequence_order: index + 1,
                        is_mandatory: st.is_mandatory,
                        start_date: taskStart,
                        due_date: taskDue,
                    };
                });

                await db('project_tasks').insert(projectTasks);
                await resequenceProjectTasks(db, project.id);
            }
        }

        await db('project_members').insert({
            project_id: project.id,
            user_id: req.user.id,
            role_id: req.user.role_id,
            is_primary: true,
        });

        await db('project_timeline_events').insert({
            project_id: project.id,
            event_type: 'milestone',
            title: 'Project Created',
            description: `Project "${name}" was created.`,
            created_by: req.user.id,
        });

        res.status(201).json(project);
    } catch (err) {
        console.error('Create project error:', err);
        res.status(500).json({ error: 'Failed to create project.' });
    }
});

router.put('/:id', authenticate, authorize('projects', 'can_edit'), async (req, res) => {
    try {
        const { name, description, start_date } = req.body;
        const [project] = await db('projects')
            .where({ id: req.params.id })
            .update({ name, description, start_date, updated_at: db.fn.now() })
            .returning('*');
        if (!project) return res.status(404).json({ error: 'Project not found.' });
        res.json(project);
    } catch (err) {
        res.status(500).json({ error: 'Failed to update project.' });
    }
});

router.delete('/:id', authenticate, authorize('projects', 'can_delete'), async (req, res) => {
    try {
        await db('projects').where({ id: req.params.id }).update({ is_active: false });
        res.json({ message: 'Project deactivated.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete project.' });
    }
});

// ==========================================
// PROJECT ACTION PLANS
// ==========================================

// GET /api/projects/:id/action-plans
router.get('/:id/action-plans', authenticate, async (req, res) => {
    try {
        const access = await fetchProjectForActionPlanAccess(req.params.id, req.user);
        if (access.error) return res.status(access.error.status).json({ error: access.error.message });

        const plans = await db('project_action_plans')
            .leftJoin('users', 'project_action_plans.sent_by', 'users.id')
            .where('project_action_plans.project_id', req.params.id)
            .select(
                'project_action_plans.id',
                'project_action_plans.title',
                'project_action_plans.status',
                'project_action_plans.sent_at',
                'project_action_plans.notes',
                'project_action_plans.action_plan_template_id',
                db.raw("CONCAT(users.first_name, ' ', users.last_name) as sent_by_name"),
                db.raw(`
                    COALESCE(
                        (SELECT SUM(p.score_out_of_5) 
                         FROM project_action_plan_particulars p
                         JOIN project_action_plan_categories c ON p.project_action_plan_category_id = c.id
                         WHERE c.project_action_plan_id = project_action_plans.id) * 100.0 / 
                        NULLIF((SELECT COUNT(p.id) * 5 
                                FROM project_action_plan_particulars p
                                JOIN project_action_plan_categories c ON p.project_action_plan_category_id = c.id
                                WHERE c.project_action_plan_id = project_action_plans.id), 0),
                        0
                    ) as overall_percentage
                `)
            )
            .orderBy('project_action_plans.sent_at', 'desc')
            .orderBy('project_action_plans.id', 'desc');

        res.json(plans);
    } catch (err) {
        console.error('Get project action plans error:', err);
        res.status(500).json({ error: 'Failed to fetch project action plans.' });
    }
});

// POST /api/projects/:id/action-plans/send
router.post('/:id/action-plans/send', authenticate, async (req, res) => {
    try {
        if (req.user.role_name === 'Client') {
            return res.status(403).json({ error: 'Client users cannot send action plans.' });
        }

        const access = await fetchProjectForActionPlanAccess(req.params.id, req.user);
        if (access.error) return res.status(access.error.status).json({ error: access.error.message });

        const actionPlanTemplateId = Number.parseInt(req.body.action_plan_template_id, 10);
        const title = String(req.body.title || '').trim();
        const notes = req.body.notes ? String(req.body.notes).trim() : null;

        if (!Number.isInteger(actionPlanTemplateId) || actionPlanTemplateId < 1) {
            return res.status(400).json({ error: 'action_plan_template_id is required.' });
        }
        if (!title) return res.status(400).json({ error: 'title is required.' });
        if (title.length > MAX_ACTION_PLAN_TITLE_LENGTH) {
            return res.status(400).json({ error: `title must be <= ${MAX_ACTION_PLAN_TITLE_LENGTH} characters.` });
        }

        const template = await db('action_plans').where({ id: actionPlanTemplateId }).first();
        if (!template) return res.status(404).json({ error: 'Action plan template not found.' });

        const templateCategories = await db('action_plan_categories')
            .where({ action_plan_id: template.id })
            .orderBy('sequence_order')
            .orderBy('id');

        if (templateCategories.length === 0) {
            return res.status(400).json({ error: 'Selected action plan template has no categories.' });
        }

        await db.transaction(async (trx) => {
            const [projectActionPlan] = await trx('project_action_plans')
                .insert({
                    project_id: req.params.id,
                    action_plan_template_id: actionPlanTemplateId,
                    title,
                    status: 'sent',
                    notes,
                    sent_at: db.fn.now(),
                    sent_by: req.user.id,
                })
                .returning('*');

            for (const category of templateCategories) {
                const [newCategory] = await trx('project_action_plan_categories')
                    .insert({
                        project_action_plan_id: projectActionPlan.id,
                        name: category.name,
                        sequence_order: category.sequence_order,
                    })
                    .returning('*');

                const particulars = await trx('action_plan_particulars')
                    .where({ action_plan_category_id: category.id })
                    .orderBy('sequence_order')
                    .orderBy('id');

                for (const particular of particulars) {
                    await trx('project_action_plan_particulars').insert({
                        project_action_plan_category_id: newCategory.id,
                        name: particular.name,
                        sequence_order: particular.sequence_order,
                    });
                }
            }
        });

        res.status(201).json({ message: 'Action plan sent successfully.' });
    } catch (err) {
        console.error('Send project action plan error:', err);
        res.status(500).json({ error: 'Failed to send action plan.' });
    }
});

// GET /api/projects/:id/action-plans/:planId
router.get('/:id/action-plans/:planId', authenticate, async (req, res) => {
    try {
        const access = await fetchProjectForActionPlanAccess(req.params.id, req.user);
        if (access.error) return res.status(access.error.status).json({ error: access.error.message });

        const plan = await db('project_action_plans')
            .leftJoin('users', 'project_action_plans.sent_by', 'users.id')
            .where({
                'project_action_plans.id': req.params.planId,
                'project_action_plans.project_id': req.params.id,
            })
            .select(
                'project_action_plans.*',
                db.raw("CONCAT(users.first_name, ' ', users.last_name) as sent_by_name")
            )
            .first();

        if (!plan) return res.status(404).json({ error: 'Project action plan not found.' });

        const categories = await db('project_action_plan_categories')
            .where({ project_action_plan_id: plan.id })
            .orderBy('sequence_order')
            .orderBy('id');

        for (const category of categories) {
            category.particulars = await db('project_action_plan_particulars')
                .leftJoin('users', 'project_action_plan_particulars.score_updated_by', 'users.id')
                .where('project_action_plan_particulars.project_action_plan_category_id', category.id)
                .select(
                    'project_action_plan_particulars.*',
                    db.raw("CONCAT(users.first_name, ' ', users.last_name) as score_updated_by_name")
                )
                .orderBy('project_action_plan_particulars.sequence_order')
                .orderBy('project_action_plan_particulars.id');
        }

        res.json({ ...plan, categories });
    } catch (err) {
        console.error('Get project action plan detail error:', err);
        res.status(500).json({ error: 'Failed to fetch project action plan detail.' });
    }
});

// PUT /api/projects/:id/action-plans/:planId/particulars/:particularId/score
router.put('/:id/action-plans/:planId/particulars/:particularId/score', authenticate, async (req, res) => {
    try {
        if (req.user.role_name === 'Client') {
            return res.status(403).json({ error: 'Client users cannot score action plan particulars.' });
        }

        const access = await fetchProjectForActionPlanAccess(req.params.id, req.user);
        if (access.error) return res.status(access.error.status).json({ error: access.error.message });

        const rawScore = req.body.score_out_of_5;
        const score = Number.parseInt(rawScore, 10);
        if (!Number.isInteger(score) || score < 0 || score > 5) {
            return res.status(400).json({ error: 'score_out_of_5 must be an integer between 0 and 5.' });
        }

        const plan = await db('project_action_plans')
            .where({ id: req.params.planId, project_id: req.params.id })
            .first();
        if (!plan) return res.status(404).json({ error: 'Project action plan not found.' });

        const particular = await db('project_action_plan_particulars')
            .join('project_action_plan_categories', 'project_action_plan_particulars.project_action_plan_category_id', 'project_action_plan_categories.id')
            .where('project_action_plan_particulars.id', req.params.particularId)
            .andWhere('project_action_plan_categories.project_action_plan_id', req.params.planId)
            .select('project_action_plan_particulars.id')
            .first();

        if (!particular) {
            return res.status(404).json({ error: 'Particular not found in this project action plan.' });
        }

        const [updated] = await db('project_action_plan_particulars')
            .where({ id: req.params.particularId })
            .update({
                score_out_of_5: score,
                score_updated_by: req.user.id,
                score_updated_at: db.fn.now(),
                updated_at: db.fn.now(),
            })
            .returning('*');

        res.json(updated);
    } catch (err) {
        console.error('Update action plan score error:', err);
        res.status(500).json({ error: 'Failed to update score.' });
    }
});

module.exports = router;
