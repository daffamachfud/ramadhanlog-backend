exports.up = function(knex) {
    return knex.schema.createTable('amalan_harian', (table) => {
      table.uuid('id').defaultTo(knex.raw('uuid_generate_v4()')).primary();
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('amalan_id').notNullable().references('id').inTable('amalan').onDelete('CASCADE');
      table.date('tanggal').notNullable();
      table.boolean('status').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('amalan_harian');
  };
  