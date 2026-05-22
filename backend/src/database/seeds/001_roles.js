/**
 * Seed: Roles
 * Inserts all consulting and client roles with hierarchy levels.
 */
exports.seed = async function (knex) {
    // Clear existing roles
    await knex('roles').del();

    await knex('roles').insert([
        // Consulting side roles (hierarchy: 1 = highest)
        {
            id: 1,
            name: 'Director',
            side: 'consulting',
            hierarchy_level: 1,
            description: 'Top-level leadership overseeing all operations',
        },
        {
            id: 2,
            name: 'Manager',
            side: 'consulting',
            hierarchy_level: 2,
            description: 'Manages teams and client relationships',
        },
        {
            id: 4,
            name: 'Senior Consultant',
            side: 'consulting',
            hierarchy_level: 4,
            description: 'Experienced consultant leading project execution',
        },
        {
            id: 5,
            name: 'Consultant',
            side: 'consulting',
            hierarchy_level: 5,
            description: 'Consultant executing project tasks',
        },

        // Client side roles
        {
            id: 6,
            name: 'Sponsor',
            side: 'client',
            hierarchy_level: 1,
            description: 'Client executive sponsoring the project',
        },
        {
            id: 7,
            name: 'Project Coordinator',
            side: 'client',
            hierarchy_level: 2,
            description: 'Client-side coordinator managing project logistics',
        },
        {
            id: 8,
            name: 'Project Leader',
            side: 'client',
            hierarchy_level: 3,
            description: 'Client-side leader driving project progress',
        },
        {
            id: 9,
            name: 'Client',
            side: 'client',
            hierarchy_level: 9,
            description: 'Client accessing the portal',
        },
    ]);
};
