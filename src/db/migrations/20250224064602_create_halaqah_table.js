exports.up = function(knex) {
    return knex.schema.createTable('halaqah', (table) => {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.string('name', 255).notNullable();
      table.string('code', 255).unique().notNullable();
      table.uuid('murabbi_id').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('halaqah');
  };
  