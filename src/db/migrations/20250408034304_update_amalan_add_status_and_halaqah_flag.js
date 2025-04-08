exports.up = function(knex) {
    return knex.schema.alterTable('amalan', function(table) {
      table.enum('status', ['active', 'inactive', 'archived'])
        .notNullable()
        .defaultTo('active');
  
      table.boolean('is_for_all_halaqah')
        .notNullable()
        .defaultTo(true);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('amalan', function(table) {
      table.dropColumn('status');
      table.dropColumn('is_for_all_halaqah');
    });
  };