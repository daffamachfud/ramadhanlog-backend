exports.up = function(knex) {
    return knex.schema.createTable('amalan', (table) => {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.string('name', 255).notNullable();
      table.text('description').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('amalan');
  };
  