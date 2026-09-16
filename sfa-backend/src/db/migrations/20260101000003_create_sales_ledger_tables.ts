import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("sales", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("visit_id").unsigned().nullable()
      .references("id").inTable("visit_logs").onDelete("SET NULL");
    t.bigInteger("customer_id").unsigned().notNullable()
      .references("id").inTable("customers").onDelete("CASCADE");
    t.bigInteger("product_id").unsigned().notNullable()
      .references("id").inTable("products").onDelete("RESTRICT");
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("RESTRICT");
    t.integer("quantity").unsigned().notNullable();
    t.decimal("unit_price", 12, 2).notNullable();
    t.decimal("revenue", 14, 2).notNullable();
    t.enu("payment_status", ["full_payment", "part_payment", "credit"]).notNullable();
    t.decimal("amount_paid", 14, 2).notNullable().defaultTo(0);
    t.date("sale_date").notNullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["customer_id", "sale_date"]);
    t.index(["rep_id", "sale_date"]);
    t.index(["product_id"]);
  });

  await knex.schema.createTable("ledger_entries", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("customer_id").unsigned().notNullable()
      .references("id").inTable("customers").onDelete("CASCADE");
    t.date("period").notNullable(); // first day of the month this entry covers
    t.decimal("opening_balance", 14, 2).notNullable().defaultTo(0);
    t.decimal("sales_total", 14, 2).notNullable().defaultTo(0);
    t.decimal("payments_total", 14, 2).notNullable().defaultTo(0);
    t.decimal("closing_balance", 14, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.unique(["customer_id", "period"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("ledger_entries");
  await knex.schema.dropTableIfExists("sales");
}
