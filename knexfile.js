const dotenv = require("dotenv");

dotenv.config(); // Load environment variables

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 5432,
    },
    migrations: {
      directory: "./src/db/migrations", // Jangan dobel 'src/db/'
    },
    seeds: {
      directory: "./src/db/seeds", // Jangan dobel 'src/db/'
    },
    pool: { min: 2, max: 10 },
  },
};
