exports.up = async function (knex) {
    await knex.schema.createTable('ccts', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable().unique();
        table.text('description').nullable();
        table.timestamps(true, true);
    });

    await knex.schema.createTable('cct_categories', (table) => {
        table.increments('id').primary();
        table.integer('cct_id').unsigned().notNullable().references('id').inTable('ccts').onDelete('CASCADE');
        table.string('name', 255).nullable();
        table.text('description').nullable();
        table.integer('sequence_order').defaultTo(0);
        table.timestamps(true, true);
    });

    await knex.schema.createTable('cct_particulars', (table) => {
        table.increments('id').primary();
        table.integer('cct_category_id').unsigned().notNullable().references('id').inTable('cct_categories').onDelete('CASCADE');
        table.string('name', 255).notNullable();
        table.text('description').nullable();
        table.integer('sequence_order').defaultTo(0);
        table.timestamps(true, true);
    });
};

exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('cct_particulars');
    await knex.schema.dropTableIfExists('cct_categories');
    await knex.schema.dropTableIfExists('ccts');
};
