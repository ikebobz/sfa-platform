import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("visit_plans", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("customer_id").unsigned().notNullable()
      .references("id").inTable("customers").onDelete("CASCADE");
    t.date("planned_date").notNullable();
    t.bigInteger("product_to_detail_id").unsigned().nullable()
      .references("id").inTable("products").onDelete("SET NULL");
    t.text("objective").nullable();
    t.enu("status", ["planned", "completed", "missed"]).notNullable().defaultTo("planned");
    t.timestamps(true, true);
    t.index(["rep_id", "planned_date"]);
  });

  await knex.schema.createTable("visit_logs", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("plan_id").unsigned().nullable()
      .references("id").inTable("visit_plans").onDelete("SET NULL");
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("customer_id").unsigned().notNullable()
      .references("id").inTable("customers").onDelete("CASCADE");
    t.date("visit_date").notNullable();
    t.text("notes").nullable();
    t.decimal("latitude", 10, 7).nullable();
    t.decimal("longitude", 10, 7).nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["rep_id", "visit_date"]);
    t.index(["customer_id", "visit_date"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("visit_logs");
  await knex.schema.dropTableIfExists("visit_plans");
}
