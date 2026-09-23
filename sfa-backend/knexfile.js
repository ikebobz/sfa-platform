require("dotenv").config();

const base = {
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
};

// In production the TypeScript migrations/seeds under src/db have already been
// compiled to dist/db by `npm run build`, and the production image intentionally
// has no ts-node/typescript installed (npm install --omit=dev) — so point knex
// at the compiled .js output there. In development, run directly against the
// .ts source via ts-node (a devDependency), so a new migration file is picked
// up immediately without a rebuild.
const isProd = process.env.NODE_ENV === "production";

const config = {
  ...base,
  migrations: {
    directory: isProd ? "./dist/db/migrations" : "./src/db/migrations",
    extension: isProd ? "js" : "ts",
    tableName: "knex_migrations",
  },
  seeds: {
    directory: isProd ? "./dist/db/seeds" : "./src/db/seeds",
    extension: isProd ? "js" : "ts",
  },
};

module.exports = {
  development: config,
  staging: config,
  production: config,
};
