import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("stock_balances", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("product_id").unsigned().notNullable()
      .references("id").inTable("products").onDelete("RESTRICT");
    t.integer("quantity_on_hand").notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.unique(["rep_id", "product_id"]);
  });

  await knex.schema.createTable("stock_receipts", (t) => {
    t.bigIncrements("id").primary();
    t.bigInteger("rep_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("product_id").unsigned().notNullable()
      .references("id").inTable("products").onDelete("RESTRICT");
    t.integer("quantity").unsigned().notNullable();
    t.date("received_date").notNullable();
    t.text("notes").nullable();
    t.timestamp("created_at").defaultTo(knex.fn.now());
    t.index(["rep_id", "received_date"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("stock_receipts");
  await knex.schema.dropTableIfExists("stock_balances");
}
