import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("targets", (t) => {
    t.bigIncrements("id").primary();
    // Extensible on purpose: only "new_customers" is validated/used today, but
    // the same table can carry a "visits" or "sales_revenue" target later
    // without a schema change — just widen the zod enum in targets.routes.ts.
    t.string("metric", 50).notNullable().defaultTo("new_customers");
    t.enu("period_type", ["day", "week", "month", "quarter"]).notNullable();
    // NULL = the default target applied to any rep without their own override.
    // A regular (non-partial) unique index still allows multiple NULL rep_id
    // rows on MariaDB, so the one-default-per-metric+period rule is enforced
    // in application code (find-then-upsert in targets.routes.ts), not here.
    t.bigInteger("rep_id").unsigned().nullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.integer("target_value").unsigned().notNullable();
    t.timestamps(true, true);
    t.unique(["metric", "period_type", "rep_id"]);
    t.index(["metric", "period_type"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("targets");
}
