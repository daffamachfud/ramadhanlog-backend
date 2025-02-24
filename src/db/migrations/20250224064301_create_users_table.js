exports.up = function(knex) {
    return knex.schema.createTable('users', (table) => {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.string('name', 255).notNullable();
      table.string('email', 255).unique().notNullable();
      table.text('password').notNullable();
      table.enu('role', ['tholib', 'murabbi']).notNullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('users');
  };
  