/**
 * Integration test for the sales module's core guarantee: creating a sale
 * atomically updates the customer's ledger and the rep's daily stock roll-up.
 *
 * Requires a running MariaDB instance reachable via the DB_* env vars
 * (e.g. `docker compose up -d mariadb` then `npm run migrate` on a test DB)
 * before running `npm test`.
 */
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../../app";
import { db } from "../../config/db";

const app = createApp();

async function seedMinimal() {
  const [territoryId] = await db("territories").insert({
    name: "Test Territory",
    region: "Test Region",
    state: "Test State",
  });

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const [repId] = await db("users").insert({
    name: "Test Rep",
    email: `rep-${Date.now()}@example.com`,
    password_hash: passwordHash,
    role: "rep",
    territory_id: territoryId,
  });

  const [customerId] = await db("customers").insert({
    business_name: "Test Pharmacy",
    territory_id: territoryId,
    status: "active",
  });

  const [productId] = await db("products").insert({
    name: "Test Product",
    unit_price: 1000,
  });

  return { territoryId, repId, customerId, productId };
}

describe("POST /api/v1/sales", () => {
  afterAll(async () => {
    await db.destroy();
  });

  it("creates a sale and atomically updates ledger and stock_daily", async () => {
    const { repId, customerId, productId } = await seedMinimal();

    // Directly craft a token the same way the auth service would, to isolate this test
    // from the login flow. In a full suite, prefer hitting /auth/login instead.
    const jwt = require("jsonwebtoken");
    const { env } = require("../../config/env");
    const token = jwt.sign(
      { id: repId, role: "rep", territoryId: null },
      env.jwt.accessSecret,
      { expiresIn: "15m" }
    );

    const saleDate = "2026-09-01";
    const res = await request(app)
      .post("/api/v1/sales")
      .set("Authorization", `Bearer ${token}`)
      .send({
        customerId,
        productId,
        quantity: 5,
        paymentStatus: "part_payment",
        amountPaid: 3000,
        saleDate,
      });

    expect(res.status).toBe(201);
    expect(res.body.revenue).toBe(5000); // 5 x unit_price(1000)

    const ledger = await db("ledger_entries").where({ customer_id: customerId }).first();
    expect(ledger).toBeTruthy();
    expect(Number(ledger.sales_total)).toBe(5000);
    expect(Number(ledger.payments_total)).toBe(3000);
    expect(Number(ledger.closing_balance)).toBe(2000); // 5000 - 3000

    const stock = await db("stock_daily").where({ rep_id: repId, log_date: saleDate }).first();
    expect(stock).toBeTruthy();
    expect(Number(stock.sales_total)).toBe(5000);

    const customer = await db("customers").where({ id: customerId }).first();
    expect(customer.last_supply_date).toBeTruthy();
  });
});
