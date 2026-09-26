import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("visit_logs", (t) => {
    // Array of activity-type strings carried out during the visit (see the
    // fixed VISIT_ACTIVITY_TYPES list in visit-logs.routes.ts) — e.g.
    // ["product_detailing", "sample_distribution"]. Kept as JSON rather than
    // a child table, same pattern already used by stock_daily.product_quantities:
    // this data is always read/written as a whole alongside its parent visit,
    // never queried or filtered on independently.
    t.json("activities").nullable();
    // Product ids actually discussed/detailed during the visit — distinct
    // from an actual sale (tracked separately in the `sales` table); a rep
    // can detail a product without selling it on the same visit.
    t.json("products_discussed").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("visit_logs", (t) => {
    t.dropColumn("activities");
    t.dropColumn("products_discussed");
  });
}
