exports.up = function (knex) {
    return knex.schema.alterTable("amalan_harian", function (table) {
      table.string("hijri_date", 30).nullable().index(); // Bisa null, panjang maksimal 30 karakter
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.alterTable("amalan_harian", function (table) {
      table.dropColumn("hijri_date");
    });
  };
  