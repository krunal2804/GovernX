const express = require('express');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const {
    ACTIVE_TASK_STATUSES,
    buildTaskLockState,
    fetchProjectTasksForOrder,
    getBlockingTask,
} = require('../utils/projectTaskOrder');
const { deriveProjectDbStatus } = require('../utils/workflowStatus');
const { verifyProjectAccess } = require('../utils/projectAccess');

const router = express.Router();

router.get('/', authenticate, async (req, res) => {
    try {
        const { project_id } = req.query;
        if (!project_id) return res.status(400).json({ error: 'project_id is required.' });

        const access = await verifyProjectAccess(project_id, req.user);
        if (access.error) return res.status(access.error.status).json({ error: access.error.message });

        const tasks = await db('project_tasks')
            .leftJoin('users', 'project_tasks.assigned_to', 'users.id')
            .leftJoin('service_tasks', 'project_tasks.service_task_id', 'service_tasks.id')
            .leftJoin('service_steps', 'service_tasks.service_step_id', 'service_steps.id')
            .select(
                'project_tasks.*',
                db.raw('COALESCE(service_steps.name, project_tasks.step_name) as step_name'),
                'users.first_name as assignee_first_name',
                'users.last_name as assignee_last_name',
                'service_steps.id as service_step_id',
                'service_tasks.sequence_order as service_task_sequence_order',
                'service_steps.sequence_order as service_step_sequence_order'
            )
            .where({ project_id })
            .orderBy('service_steps.sequence_order')
            .orderBy('service_tasks.sequence_order')
            .orderBy('project_tasks.sequence_order')
            .orderBy('project_tasks.id');

        res.json(buildTaskLockState(tasks));
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tasks.' });
    }
});

router.put('/:id', authenticate, authorize('tasks', 'can_edit'), async (req, res) => {
    try {
        const { status, assigned_to, start_date, due_date, actual_start_date, actual_end_date, remarks, skip_reason } = req.body;
        if (status !== undefined && !ACTIVE_TASK_STATUSES.includes(status)) {
            return res.status(400).json({ error: 'Invalid task status.' });
        }

        const existingTask = await db('project_tasks').where({ id: req.params.id }).first();
        if (!existingTask) return res.status(404).json({ error: 'Task not found.' });

        const access = await verifyProjectAccess(existingTask.project_id, req.user);
        if (access.error && existingTask.assigned_to !== req.user.id) {
            return res.status(access.error.status).json({ error: access.error.message });
        }

        if (status !== undefined && status !== existingTask.status && status !== 'not_started') {
            const orderedTasks = buildTaskLockState(await fetchProjectTasksForOrder(db, existingTask.project_id));
            const blockingTask = getBlockingTask(orderedTasks, req.params.id);

            if (blockingTask) {
                return res.status(409).json({
                    error: `Complete Task ${blockingTask.sequence_order} before updating this task.`,
                    blocking_task_id: blockingTask.id,
                    blocking_task_sequence: blockingTask.sequence_order,
                });
            }
        }

        const updateData = { updated_at: db.fn.now() };
        if (status !== undefined) updateData.status = status;
        if (assigned_to !== undefined) updateData.assigned_to = assigned_to;
        if (start_date !== undefined) updateData.start_date = start_date;
        if (due_date !== undefined) updateData.due_date = due_date;
        if (actual_start_date !== undefined) updateData.actual_start_date = actual_start_date;
        if (actual_end_date !== undefined) updateData.actual_end_date = actual_end_date;
        if (remarks !== undefined) updateData.remarks = remarks;

        if (status !== undefined) {
            updateData.status_updated_by_user_id = req.user.id;
            updateData.status_updated_by_name = `${req.user.first_name} ${req.user.last_name}`.trim();
            updateData.status_updated_at = db.fn.now();
        }

        if (status === 'skipped') {
            const normalizedSkipReason = String(skip_reason || '').trim();
            if (!normalizedSkipReason) {
                return res.status(400).json({ error: 'Skip reason is required.' });
            }

            updateData.skip_reason = normalizedSkipReason;
            updateData.skipped_by_user_id = req.user.id;
            updateData.skipped_by_name = `${req.user.first_name} ${req.user.last_name}`.trim();
            updateData.skipped_at = db.fn.now();
        }

        if (status !== undefined && status !== 'skipped') {
            updateData.skip_reason = null;
            updateData.skipped_by_user_id = null;
            updateData.skipped_by_name = null;
            updateData.skipped_at = null;
        }

        if (status === 'completed' && !actual_end_date) {
            updateData.actual_end_date = new Date().toISOString().split('T')[0];
        }
        if (status === 'in_progress' && !actual_start_date) {
            updateData.actual_start_date = new Date().toISOString().split('T')[0];
        }

        const [task] = await db('project_tasks').where({ id: req.params.id }).update(updateData).returning('*');

        const stats = await db('project_tasks')
            .where({ project_id: task.project_id })
            .select(
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed")
            )
            .first();

        const totalTasks = parseInt(stats.total, 10) || 0;
        const completedTasks = parseInt(stats.completed, 10) || 0;
        const progress = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(2) : 0;
        const projectStatus = deriveProjectDbStatus(totalTasks, completedTasks);

        await db('projects')
            .where({ id: task.project_id })
            .update({ progress_percentage: progress, status: projectStatus, updated_at: db.fn.now() });

        res.json(task);
    } catch (err) {
        console.error('Update task error:', err);
        res.status(500).json({ error: 'Failed to update task.' });
    }
});

router.get('/my', authenticate, async (req, res) => {
    try {
        const tasks = await db('project_tasks')
            .join('projects', 'project_tasks.project_id', 'projects.id')
            .join('assignments', 'projects.assignment_id', 'assignments.id')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .leftJoin('service_tasks', 'project_tasks.service_task_id', 'service_tasks.id')
            .leftJoin('service_steps', 'service_tasks.service_step_id', 'service_steps.id')
            .select(
                'project_tasks.*',
                db.raw('COALESCE(service_steps.name, project_tasks.step_name) as step_name'),
                'projects.name as project_name',
                'assignments.name as assignment_name',
                'organizations.name as organization_name',
                'service_steps.id as service_step_id',
                'service_tasks.sequence_order as service_task_sequence_order',
                'service_steps.sequence_order as service_step_sequence_order'
            )
            .where('project_tasks.assigned_to', req.user.id)
            .orderBy('project_tasks.project_id')
            .orderBy('service_steps.sequence_order')
            .orderBy('service_tasks.sequence_order')
            .orderBy('project_tasks.sequence_order');

        const tasksByProject = new Map();
        tasks.forEach((task) => {
            if (!tasksByProject.has(task.project_id)) {
                tasksByProject.set(task.project_id, []);
            }
            tasksByProject.get(task.project_id).push(task);
        });

        const lockedTasks = Array.from(tasksByProject.values()).flatMap((projectTasks) => buildTaskLockState(projectTasks));
        res.json(lockedTasks);
    } catch (err) {
        console.error('Fetch my tasks error:', err);
        res.status(500).json({ error: 'Failed to fetch your tasks.' });
    }
});

module.exports = router;
