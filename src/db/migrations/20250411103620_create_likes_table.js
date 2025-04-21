exports.up = function(knex) {
    return knex.schema.createTable("likes", function(table) {
      table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      table.uuid("post_id").notNullable().references("id").inTable("posts").onDelete("CASCADE");
      table.uuid("user_id").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
  
      table.unique(["post_id", "user_id"]); // satu like per user per post
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable("likes");
  };
  