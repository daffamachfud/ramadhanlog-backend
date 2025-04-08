exports.up = function(knex) {
    return knex.schema.createTable('amalan_halaqah', function(table) {
      table.increments('id').primary();
      table.uuid('amalan_id').notNullable()
        .references('id').inTable('amalan').onDelete('CASCADE');
      table.uuid('halaqah_id').notNullable()
        .references('id').inTable('halaqah').onDelete('CASCADE');
      table.string('amalan_name').notNullable();
  
      table.unique(['amalan_id', 'halaqah_id']);
      table.timestamps(true, true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable('amalan_halaqah');
  };