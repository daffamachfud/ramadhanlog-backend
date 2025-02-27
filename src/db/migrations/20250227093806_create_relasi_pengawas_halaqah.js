exports.up = function(knex) {
    return knex.schema.createTable('relasi_pengawas_halaqah', (table) => {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.uuid('pengawas_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('halaqah_id').notNullable().references('id').inTable('halaqah').onDelete('CASCADE');
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
};
  
exports.down = function(knex) {
    return knex.schema.dropTable('relasi_pengawas_halaqah');
};
