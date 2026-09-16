import "dotenv/config";
import type { Knex } from "knex";

const base: Knex.Config = {
  client: "mysql2",
  connection: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "sfa_user",
    password: process.env.DB_PASSWORD || "change_me",
    database: process.env.DB_NAME || "sfa_platform",
    charset: "utf8mb4",
  },
  pool: { min: 2, max: 10 },
  migrations: {
    directory: "./src/db/migrations",
    extension: "ts",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: "./src/db/seeds",
    extension: "ts",
  },
};

const config: { [key: string]: Knex.Config } = {
  development: base,
  staging: base,
  production: base,
};

export default config;
