exports.up = async function (knex) {
    await knex.schema.createTable('project_ccts', (table) => {
        table.increments('id').primary();
        table.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.integer('cct_id').unsigned().nullable().references('id').inTable('ccts').onDelete('SET NULL');
        table.string('title', 150).notNullable();
        table.string('status', 30).notNullable().defaultTo('sent');
        table.text('notes').nullable();
        table.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());
        table.integer('sent_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        table.timestamps(true, true);
    });

    await knex.schema.createTable('project_cct_categories', (table) => {
        table.increments('id').primary();
        table.integer('project_cct_id').unsigned().notNullable().references('id').inTable('project_ccts').onDelete('CASCADE');
        table.string('name', 255).nullable();
        table.integer('sequence_order').notNullable().defaultTo(0);
        table.timestamps(true, true);
    });

    await knex.schema.createTable('project_cct_particulars', (table) => {
        table.increments('id').primary();
        table.integer('project_cct_category_id').unsigned().notNullable().references('id').inTable('project_cct_categories').onDelete('CASCADE');
        table.string('name', 255).notNullable();
        table.integer('sequence_order').notNullable().defaultTo(0);
        table.integer('score_out_of_5').nullable();
        table.integer('score_updated_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
        table.timestamp('score_updated_at').nullable();
        table.timestamps(true, true);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('project_cct_particulars');
    await knex.schema.dropTableIfExists('project_cct_categories');
    await knex.schema.dropTableIfExists('project_ccts');
};
