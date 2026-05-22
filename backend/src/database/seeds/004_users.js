const bcrypt = require('bcryptjs');

/**
 * Seed: Users
 * Inserts a default admin user.
 */
exports.seed = async function (knex) {
    // Clear existing users
    await knex('users').del();

    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'krunalparikh08@gmail.com';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || '123456';

    const password_hash = await bcrypt.hash(adminPassword, 10);

    await knex('users').insert([
        {
            id: 1,
            first_name: 'Krunal',
            last_name: 'Parikh',
            email: adminEmail,
            password_hash,
            role_id: 1, // Director
            is_active: true,
        }
    ]);
};
