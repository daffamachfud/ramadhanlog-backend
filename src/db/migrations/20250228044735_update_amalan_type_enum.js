exports.up = function(knex) {
    return knex.schema.alterTable('amalan', (table) => {
      table.dropColumn('type');
    }).then(() => {
      return knex.schema.alterTable('amalan', (table) => {
        table.enum('type', ['checklist', 'dropdown', 'kategori']).notNullable().defaultTo('checklist');
      });
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('amalan', (table) => {
      table.dropColumn('type');
    }).then(() => {
      return knex.schema.alterTable('amalan', (table) => {
        table.enum('type', ['checklist', 'dropdown']).notNullable().defaultTo('checklist');
      });
    });
  };
  