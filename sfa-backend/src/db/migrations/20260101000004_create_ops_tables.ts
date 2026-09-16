import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("expenses", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.date("expense_date").notNullable();
    t.decimal("fuel_amount", 10, 2).notNullable().defaultTo(0);
    t.decimal("litres", 8, 2).nullable();
    t.decimal("odometer_km", 10, 2).nullable();
    t.decimal("vehicle_service_cost", 10, 2).notNullable().defaultTo(0);
    t.decimal("other_cost", 10, 2).notNullable().defaultTo(0);
    t.decimal("total_cost", 10, 2).notNullable().defaultTo(0);
    t.string("receipt_photo_url", 500).nullable();
    t.enu("approval_status", ["pending", "approved", "rejected"]).notNullable().defaultTo("pending");
    t.bigInteger("approved_by").unsigned().nullable()
      .references("id").inTable("users").onDelete("SET NULL");
    t.timestamps(true, true);
    t.index(["rep_id", "expense_date"]);
    t.index(["approval_status"]);
  });

  await knex.schema.createTable("stock_daily", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.date("log_date").notNullable();
    t.integer("visited_count").unsigned().notNullable().defaultTo(0);
    t.integer("active_customers_count").unsigned().notNullable().defaultTo(0);
    t.decimal("sales_total", 14, 2).notNullable().defaultTo(0);
    t.decimal("debt_total", 14, 2).notNullable().defaultTo(0);
    t.decimal("expense_total", 12, 2).notNullable().defaultTo(0);
    t.json("product_quantities").nullable(); // { [productId]: qty }
    t.timestamps(true, true);
    t.unique(["rep_id", "log_date"]);
  });

  await knex.schema.createTable("incentives", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.date("period").notNullable(); // first day of the month/period
    t.bigInteger("product_id").unsigned().nullable()
      .references("id").inTable("products").onDelete("SET NULL");
    t.decimal("metric_value", 14, 2).notNullable().defaultTo(0);
    t.enu("status", ["pending", "qualified", "paid"]).notNullable().defaultTo("pending");
    t.decimal("amount_rep", 12, 2).notNullable().defaultTo(0);
    t.decimal("amount_rsm", 12, 2).notNullable().defaultTo(0);
    t.decimal("amount_nsm", 12, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.index(["rep_id", "period"]);
  });

  await knex.schema.createTable("invoices", (t) => {
    t.bigIncrements("id").primary();
    t.string("invoice_number", 50).notNullable().unique();
    t.date("invoice_date").notNullable();
    t.date("period").notNullable();
    t.decimal("total_amount", 14, 2).notNullable().defaultTo(0);
    t.enu("status", ["draft", "issued", "paid"]).notNullable().defaultTo("draft");
    t.timestamps(true, true);
  });

  await knex.schema.createTable("audit_log", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("user_id").unsigned().nullable()
      .references("id").inTable("users").onDelete("SET NULL");
    t.string("action", 100).notNullable();
    t.string("entity", 100).notNullable();
    t.bigInteger("entity_id").unsigned().nullable();
    t.json("changes").nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["entity", "entity_id"]);
    t.index(["user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("audit_log");
  await knex.schema.dropTableIfExists("invoices");
  await knex.schema.dropTableIfExists("incentives");
  await knex.schema.dropTableIfExists("stock_daily");
  await knex.schema.dropTableIfExists("expenses");
}
