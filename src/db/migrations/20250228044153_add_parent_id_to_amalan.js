exports.up = function(knex) {
    return knex.schema.alterTable('amalan', (table) => {
      table.uuid('parent_id').nullable().references('id').inTable('amalan').onDelete('CASCADE');
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('amalan', (table) => {
      table.dropColumn('parent_id');
    });
  };
  