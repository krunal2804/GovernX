const db = require('../database/db');

/**
 * Verifies if the user has access to a specific project.
 * Handles row-level access checks for Clients and Consultants.
 * 
 * @param {string|number} projectId - The ID of the project to check.
 * @param {Object} user - The authenticated user object (req.user).
 * @returns {Promise<{error?: {status: number, message: string}, project?: Object}>}
 */
async function verifyProjectAccess(projectId, user) {
    const project = await db('projects')
        .join('assignments', 'projects.assignment_id', 'assignments.id')
        .select('projects.id', 'assignments.organization_id')
        .where('projects.id', projectId)
        .first();

    if (!project) return { error: { status: 404, message: 'Project not found.' } };

    if (user.role_name === 'Client' && project.organization_id !== user.organization_id) {
        return { error: { status: 403, message: 'Not authorized to access this project.' } };
    }

    if (user.role_side === 'consulting' && user.hierarchy_level >= 4) {
        const isMember = await db('project_members')
            .where({ project_id: projectId, user_id: user.id })
            .first();
        const pDetails = await db('projects').where('id', projectId).select('created_by').first();
        if (!isMember && pDetails?.created_by !== user.id) {
            return { error: { status: 403, message: 'Not authorized to access this project.' } };
        }
    }

    return { project };
}

module.exports = { verifyProjectAccess };
