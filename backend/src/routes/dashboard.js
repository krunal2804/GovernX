const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { calculateAssignmentProgress } = require('../utils/assignmentProgress');
const { deriveProjectWorkflowStatus, deriveAssignmentWorkflowStatus } = require('../utils/workflowStatus');

const router = express.Router();

router.get('/stats', authenticate, async (req, res) => {
    try {
        if (req.user.hierarchy_level >= 4) {
            return res.status(403).json({ error: 'Not authorized to view global statistics.' });
        }

        const [orgCount] = await db('organizations').where({ is_active: true }).count();
        const [assignmentCount] = await db('assignments').where({ is_active: true }).count();
        const [projectCount] = await db('projects').where({ is_active: true }).count();
        const [userCount] = await db('users').where({ is_active: true }).count();

        const projectStatuses = await db('projects')
            .where({ is_active: true })
            .groupBy('status')
            .select('status', db.raw('COUNT(*) as count'));

        const [taskStats] = await db('project_tasks')
            .select(
                db.raw('COUNT(*) as total'),
                db.raw("COUNT(*) FILTER (WHERE status = 'completed') as completed"),
                db.raw("COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress"),
                db.raw("COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'skipped')) as overdue"),
                db.raw("COUNT(*) FILTER (WHERE status = 'not_started') as not_started")
            );

        const recentProjects = await db('projects')
            .join('assignments', 'projects.assignment_id', 'assignments.id')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .join('services', 'projects.service_id', 'services.id')
            .select(
                'projects.id', 'projects.name', 'projects.status', 'projects.progress_percentage',
                'projects.start_date',
                'organizations.name as organization_name',
                'assignments.name as assignment_name',
                'services.name as service_name'
            )
            .where('projects.is_active', true)
            .orderBy('projects.created_at', 'desc')
            .limit(5);

        res.json({
            counts: {
                organizations: parseInt(orgCount.count, 10),
                assignments: parseInt(assignmentCount.count, 10),
                projects: parseInt(projectCount.count, 10),
                users: parseInt(userCount.count, 10),
            },
            projectStatuses,
            taskStats: {
                total: parseInt(taskStats.total, 10),
                completed: parseInt(taskStats.completed, 10),
                in_progress: parseInt(taskStats.in_progress, 10),
                overdue: parseInt(taskStats.overdue, 10),
                not_started: parseInt(taskStats.not_started, 10),
            },
            recentProjects,
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
    }
});

router.get('/my-portal', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;

        const teamMemberships = await db('assignment_team_members')
            .where({ user_id: userId })
            .select('assignment_id', 'title');

        if (teamMemberships.length === 0) {
            return res.json({
                assignments: [], announcements: [],
                counts: { assignments: 0, projects: 0, active_projects: 0 },
                taskStats: { total: 0, completed: 0, in_progress: 0, overdue: 0, not_started: 0 },
                projectStatuses: [],
            });
        }

        const assignmentIds = teamMemberships.map((membership) => membership.assignment_id);
        const titleByAssignment = {};
        teamMemberships.forEach((membership) => { titleByAssignment[membership.assignment_id] = membership.title; });

        const assignments = await db('assignments')
            .join('organizations', 'assignments.organization_id', 'organizations.id')
            .leftJoin('users as poc', 'assignments.faber_poc_id', 'poc.id')
            .whereIn('assignments.id', assignmentIds)
            .where('assignments.is_active', true)
            .select(
                'assignments.*',
                'organizations.name as organization_name',
                db.raw("CONCAT(poc.first_name, ' ', poc.last_name) as faber_poc_name")
            )
            .orderBy('assignments.created_at', 'desc');

        const enrichedAssignments = await Promise.all(
            assignments.map(async (assignment) => {
                const projects = await db('projects')
                    .join('services', 'projects.service_id', 'services.id')
                    .select('projects.*', 'services.name as service_name')
                    .where({ assignment_id: assignment.id, 'projects.is_active': true });

                const enrichedProjects = await Promise.all(
                    projects.map(async (project) => {
                        const taskStats = await db('project_tasks')
                            .where({ project_id: project.id })
                            .select(
                                db.raw('COUNT(*) as total'),
                                db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed"),
                                db.raw("COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress"),
                                db.raw("COUNT(*) FILTER (WHERE status = 'not_started') as not_started"),
                                db.raw("COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'skipped')) as overdue")
                            )
                            .first();

                        const totalTasks = parseInt(taskStats.total, 10) || 0;
                        const completedTasks = parseInt(taskStats.completed, 10) || 0;

                        return {
                            ...project,
                            status: deriveProjectWorkflowStatus(totalTasks, completedTasks),
                            task_total: totalTasks,
                            task_completed: completedTasks,
                            task_in_progress: parseInt(taskStats.in_progress, 10) || 0,
                            task_not_started: parseInt(taskStats.not_started, 10) || 0,
                            task_overdue: parseInt(taskStats.overdue, 10) || 0,
                        };
                    })
                );

                return {
                    ...assignment,
                    status: deriveAssignmentWorkflowStatus(enrichedProjects.map((project) => project.status)),
                    my_title: titleByAssignment[assignment.id] || '',
                    overall_progress: calculateAssignmentProgress(enrichedProjects),
                    projects: enrichedProjects,
                };
            })
        );

        const allProjects = enrichedAssignments.flatMap((assignment) => assignment.projects);
        const activeProjects = allProjects.filter((project) => project.status === 'active' || project.status === 'not_started');

        const taskStats = allProjects.reduce((acc, project) => ({
            total: acc.total + project.task_total,
            completed: acc.completed + project.task_completed,
            in_progress: acc.in_progress + project.task_in_progress,
            not_started: acc.not_started + project.task_not_started,
            overdue: acc.overdue + project.task_overdue,
        }), { total: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0 });

        const statusMap = {};
        allProjects.forEach((project) => {
            statusMap[project.status] = (statusMap[project.status] || 0) + 1;
        });
        const projectStatuses = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

        res.json({
            assignments: enrichedAssignments,
            counts: {
                assignments: enrichedAssignments.length,
                projects: allProjects.length,
                active_projects: activeProjects.length,
            },
            taskStats,
            projectStatuses,
        });
    } catch (err) {
        console.error('My portal error:', err);
        res.status(500).json({ error: 'Failed to fetch portal data.' });
    }
});

router.get('/client-portal', authenticate, async (req, res) => {
    try {
        const organizationId = req.user.organization_id;

        if (!organizationId) {
            return res.json({
                assignments: [], announcements: [],
                counts: { assignments: 0, projects: 0, active_projects: 0 },
                taskStats: { total: 0, completed: 0, in_progress: 0, overdue: 0, not_started: 0 },
                projectStatuses: [],
            });
        }

        const assignments = await db('assignments')
            .where({ organization_id: organizationId, is_active: true })
            .select('*')
            .orderBy('created_at', 'desc');

        const assignmentIds = assignments.map(a => a.id);

        let enrichedAssignments = [];
        if (assignmentIds.length > 0) {
            enrichedAssignments = await Promise.all(
                assignments.map(async (assignment) => {
                    const projects = await db('projects')
                        .join('services', 'projects.service_id', 'services.id')
                        .select('projects.*', 'services.name as service_name')
                        .where({ assignment_id: assignment.id, 'projects.is_active': true });

                    const enrichedProjects = await Promise.all(
                        projects.map(async (project) => {
                            const taskStats = await db('project_tasks')
                                .where({ project_id: project.id })
                                .select(
                                    db.raw('COUNT(*) as total'),
                                    db.raw("COUNT(*) FILTER (WHERE status IN ('completed', 'skipped')) as completed"),
                                    db.raw("COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress"),
                                    db.raw("COUNT(*) FILTER (WHERE status = 'not_started') as not_started"),
                                    db.raw("COUNT(*) FILTER (WHERE due_date < NOW() AND status NOT IN ('completed', 'skipped')) as overdue")
                                )
                                .first();

                            const totalTasks = parseInt(taskStats.total, 10) || 0;
                            const completedTasks = parseInt(taskStats.completed, 10) || 0;

                            return {
                                ...project,
                                status: deriveProjectWorkflowStatus(totalTasks, completedTasks),
                                task_total: totalTasks,
                                task_completed: completedTasks,
                                task_in_progress: parseInt(taskStats.in_progress, 10) || 0,
                                task_not_started: parseInt(taskStats.not_started, 10) || 0,
                                task_overdue: parseInt(taskStats.overdue, 10) || 0,
                            };
                        })
                    );

                    return {
                        ...assignment,
                        status: deriveAssignmentWorkflowStatus(enrichedProjects.map((project) => project.status)),
                        overall_progress: calculateAssignmentProgress(enrichedProjects),
                        projects: enrichedProjects,
                    };
                })
            );
        }

        const allProjects = enrichedAssignments.flatMap((assignment) => assignment.projects);
        const activeProjects = allProjects.filter((project) => project.status === 'active' || project.status === 'not_started');

        const taskStats = allProjects.reduce((acc, project) => ({
            total: acc.total + project.task_total,
            completed: acc.completed + project.task_completed,
            in_progress: acc.in_progress + project.task_in_progress,
            not_started: acc.not_started + project.task_not_started,
            overdue: acc.overdue + project.task_overdue,
        }), { total: 0, completed: 0, in_progress: 0, not_started: 0, overdue: 0 });

        const statusMap = {};
        allProjects.forEach((project) => {
            statusMap[project.status] = (statusMap[project.status] || 0) + 1;
        });
        const projectStatuses = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

        res.json({
            assignments: enrichedAssignments,
            counts: {
                assignments: enrichedAssignments.length,
                projects: allProjects.length,
                active_projects: activeProjects.length,
            },
            taskStats,
            projectStatuses,
        });
    } catch (err) {
        console.error('Client portal error:', err);
        res.status(500).json({ error: 'Failed to fetch portal data.' });
    }
});

module.exports = router;
