exports.up = function(knex) {
    return knex.schema.alterTable('amalan', (table) => {
      table.enum('type', ['checklist', 'dropdown']).notNullable().defaultTo('checklist');
      table.text('options').nullable();
      table.integer('order_number').notNullable().defaultTo(0);
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('amalan', (table) => {
      table.dropColumn('type');
      table.dropColumn('options');
      table.dropColumn('order_number');
    });
  };