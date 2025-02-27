exports.up = function (knex) {
    return knex.schema.alterTable("halaqah", function (table) {
      table.uuid("pengawas_id").nullable().references("id").inTable("users").onDelete("SET NULL");
      table.string("code_pengawas").unique().nullable();
    });
  };
  
  exports.down = function (knex) {
    return knex.schema.alterTable("halaqah", function (table) {
      table.dropColumn("pengawas_id");
      table.dropColumn("code_pengawas");
    });
  };