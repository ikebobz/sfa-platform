import knexLib, { Knex } from "knex";

// Loaded via require rather than `import` so this resolves knexfile.js correctly
// under both ts-node-dev (development) and the compiled dist/ build (production),
// without TypeScript trying to pull a root-level file outside rootDir into the build.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require("../../knexfile") as Record<string, Knex.Config>;

const environment = process.env.NODE_ENV || "development";
const config = knexConfig[environment];

export const db: Knex = knexLib(config);
