exports.up = function(knex) {
    return knex.schema.createTable("comments", function(table) {
      table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      table.uuid("post_id").notNullable().references("id").inTable("posts").onDelete("CASCADE");
      table.uuid("user_id").notNullable();
      table.string("author_name").notNullable();
      table.text("content").notNullable();
      table.uuid("parent_id").nullable().references("id").inTable("comments").onDelete("CASCADE"); // nested
      table.timestamp("created_at").defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable("comments");
  };
  