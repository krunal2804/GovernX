exports.up = async function (knex) {
    await knex.schema.alterTable('reference_documents', (table) => {
        table.string('file_url', 1000).nullable().alter();
    });
};

exports.down = async function (knex) {
    await knex('reference_documents').whereNull('file_url').update({ file_url: '' });
    await knex.schema.alterTable('reference_documents', (table) => {
        table.string('file_url', 1000).notNullable().alter();
    });
};

