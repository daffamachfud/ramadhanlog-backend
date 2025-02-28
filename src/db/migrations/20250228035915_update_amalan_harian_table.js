exports.up = function(knex) {
    return knex.schema.alterTable('amalan_harian', (table) => {
      table.string('nilai').nullable(); // Menyimpan hasil input dropdown
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.alterTable('amalan_harian', (table) => {
      table.dropColumn('nilai');
    });
  };