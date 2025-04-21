exports.up = function(knex) {
    return knex.schema.createTable("post_media", function(table) {
      table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      table.uuid("post_id").notNullable().references("id").inTable("posts").onDelete("CASCADE");
      table.enum("media_type", ["image", "video", "link"]).notNullable();
      table.string("url").notNullable();
      table.string("caption");
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable("post_media");
  };
  