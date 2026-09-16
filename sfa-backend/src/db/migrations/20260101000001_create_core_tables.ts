import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("territories", (t) => {
    t.bigIncrements("id").primary();
    t.string("name", 150).notNullable();
    t.string("region", 100).notNullable();
    t.string("state", 100).notNullable();
    t.timestamps(true, true);
    t.timestamp("deleted_at").nullable();
    t.index(["region"]);
  });

  await knex.schema.createTable("users", (t) => {
    t.bigIncrements("id").primary();
    t.string("name", 150).notNullable();
    t.string("email", 190).notNullable().unique();
    t.string("phone", 30).nullable();
    t.string("password_hash", 255).notNullable();
    t.enu("role", ["rep", "rsm", "nsm", "admin"]).notNullable();
    t.bigInteger("territory_id").unsigned().nullable()
      .references("id").inTable("territories").onDelete("SET NULL");
    t.enu("status", ["active", "inactive"]).notNullable().defaultTo("active");
    t.timestamps(true, true);
    t.timestamp("deleted_at").nullable();
    t.index(["role", "status"]);
    t.index(["territory_id"]);
  });

  await knex.schema.createTable("products", (t) => {
    t.bigIncrements("id").primary();
    t.string("name", 150).notNullable();
    t.string("category", 100).nullable();
    t.string("sku", 60).nullable().unique();
    t.decimal("unit_price", 12, 2).notNullable().defaultTo(0);
    t.timestamps(true, true);
    t.timestamp("deleted_at").nullable();
  });

  await knex.schema.createTable("customers", (t) => {
    t.bigIncrements("id").primary();
    t.string("business_name", 200).notNullable();
    t.string("business_type", 100).nullable(); // e.g. Pharmacy, Hospital, PMS
    t.string("address", 300).nullable();
    t.string("town", 120).nullable();
    t.string("lga", 120).nullable();
    t.string("state", 100).nullable();
    t.string("region", 100).nullable();
    t.string("contact_person", 150).nullable();
    t.string("phone", 30).nullable();
    t.string("email", 190).nullable();
    t.enu("status", ["active", "inactive"]).notNullable().defaultTo("active");
    t.bigInteger("territory_id").unsigned().nullable()
      .references("id").inTable("territories").onDelete("SET NULL");
    t.date("last_visit_date").nullable();
    t.date("last_supply_date").nullable();
    t.timestamps(true, true);
    t.timestamp("deleted_at").nullable();
    t.index(["territory_id", "status"]);
    t.index(["town", "lga", "state"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("customers");
  await knex.schema.dropTableIfExists("products");
  await knex.schema.dropTableIfExists("users");
  await knex.schema.dropTableIfExists("territories");
}
