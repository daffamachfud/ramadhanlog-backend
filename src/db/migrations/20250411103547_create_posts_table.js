exports.up = function(knex) {
    return knex.schema.createTable("posts", function(table) {
      table.uuid("id").primary().defaultTo(knex.raw("uuid_generate_v4()"));
      table.uuid("user_id").notNullable(); // relasi ke user
      table.string("author_name").notNullable();
      table.string("title").notNullable();
      table.text("content").notNullable();
      table.enum("status", ["published", "draft"]).defaultTo("published");
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  };
  
  exports.down = function(knex) {
    return knex.schema.dropTable("posts");
  };
  