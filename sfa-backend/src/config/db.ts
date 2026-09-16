import knexLib, { Knex } from "knex";
import knexConfig from "../../knexfile";

const environment = process.env.NODE_ENV || "development";
const config = (knexConfig as Record<string, Knex.Config>)[environment];

export const db: Knex = knexLib(config);
