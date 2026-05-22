/**
 * Seed: Permissions
 * Sets up role-based access control for each module.
 */
exports.seed = async function (knex) {
    await knex('permissions').del();

    const modules = [
        'dashboard',
        'organizations',
        'assignments',
        'projects',
        'tasks',
        'reports',
        'users',
        'services',
        'settings',
    ];

    const permissions = [];

    // Role IDs from roles seed
    const DIRECTOR = 1;
    const MANAGER = 2;
    const SENIOR_CONSULTANT = 4;
    const CONSULTANT = 5;
    const SPONSOR = 6;
    const PROJECT_COORDINATOR = 7;
    const PROJECT_LEADER = 8;
    const CLIENT = 9;

    // Director — full access to everything
    modules.forEach((mod) => {
        permissions.push({
            role_id: DIRECTOR,
            module: mod,
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: true,
        });
    });

    // Manager — full access except settings delete
    modules.forEach((mod) => {
        permissions.push({
            role_id: MANAGER,
            module: mod,
            can_view: true,
            can_create: true,
            can_edit: true,
            can_delete: mod !== 'settings',
        });
    });

    // Senior Consultant — manage tasks, view projects & reports
    modules.forEach((mod) => {
        if (mod === 'tasks') {
            permissions.push({
                role_id: SENIOR_CONSULTANT,
                module: mod,
                can_view: true,
                can_create: true,
                can_edit: true,
                can_delete: false,
            });
        } else if (['dashboard', 'projects', 'reports'].includes(mod)) {
            permissions.push({
                role_id: SENIOR_CONSULTANT,
                module: mod,
                can_view: true,
                can_create: false,
                can_edit: false,
                can_delete: false,
            });
        }
    });

    // Consultant — edit assigned tasks, view projects
    modules.forEach((mod) => {
        if (mod === 'tasks') {
            permissions.push({
                role_id: CONSULTANT,
                module: mod,
                can_view: true,
                can_create: false,
                can_edit: true,
                can_delete: false,
            });
        } else if (['dashboard', 'projects'].includes(mod)) {
            permissions.push({
                role_id: CONSULTANT,
                module: mod,
                can_view: true,
                can_create: false,
                can_edit: false,
                can_delete: false,
            });
        }
    });

    // Sponsor — view dashboard, projects, reports
    ['dashboard', 'projects', 'reports'].forEach((mod) => {
        permissions.push({
            role_id: SPONSOR,
            module: mod,
            can_view: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
        });
    });

    // Project Coordinator — view dashboard, projects, tasks, reports
    ['dashboard', 'projects', 'tasks', 'reports'].forEach((mod) => {
        permissions.push({
            role_id: PROJECT_COORDINATOR,
            module: mod,
            can_view: true,
            can_create: false,
            can_edit: mod === 'tasks',
            can_delete: false,
        });
    });

    // Project Leader — view & edit tasks, view projects & reports
    ['dashboard', 'projects', 'tasks', 'reports'].forEach((mod) => {
        permissions.push({
            role_id: PROJECT_LEADER,
            module: mod,
            can_view: true,
            can_create: false,
            can_edit: mod === 'tasks',
            can_delete: false,
        });
    });

    // Client - view dashboard & projects
    ['dashboard', 'projects'].forEach((mod) => {
        permissions.push({
            role_id: CLIENT,
            module: mod,
            can_view: true,
            can_create: false,
            can_edit: false,
            can_delete: false,
        });
    });

    await knex('permissions').insert(permissions);
};
