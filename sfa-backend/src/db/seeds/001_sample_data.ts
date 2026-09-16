import type { Knex } from "knex";
import bcrypt from "bcryptjs";

/**
 * Seeds a minimal but realistic dataset for development/demo use:
 * territories, an admin + a handful of reps, products, and customers.
 * Extend this (or add a 002_ seed) to generate months of visits/sales/expenses
 * for load-testing the dashboard aggregates.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex("audit_log").del();
  await knex("incentives").del();
  await knex("stock_daily").del();
  await knex("expenses").del();
  await knex("ledger_entries").del();
  await knex("sales").del();
  await knex("visit_logs").del();
  await knex("visit_plans").del();
  await knex("customers").del();
  await knex("products").del();
  await knex("users").del();
  await knex("territories").del();

  await knex("territories").insert([
    { name: "Abuja Territory 1", region: "North Central", state: "FCT" },
    { name: "Abuja Territory 2", region: "North Central", state: "FCT" },
    { name: "Lagos Mainland", region: "South West", state: "Lagos" },
    { name: "Port Harcourt", region: "South South", state: "Rivers" },
  ]);

  // MySQL/MariaDB via knex only returns the first insert id from a batch insert,
  // so fetch the rows back explicitly to reliably get every id by name.
  const territories = await knex("territories").select("id", "name");
  const territoryIdByName = Object.fromEntries(territories.map((t) => [t.name, t.id]));

  const passwordHash = await bcrypt.hash("ChangeMe123!", 10);

  await knex("users").insert([
    {
      name: "System Admin",
      email: "admin@example.com",
      phone: "+2348000000001",
      password_hash: passwordHash,
      role: "admin",
      territory_id: null,
      status: "active",
    },
    {
      name: "Ngozi Adeyemi (NSM)",
      email: "nsm@example.com",
      phone: "+2348000000002",
      password_hash: passwordHash,
      role: "nsm",
      territory_id: null,
      status: "active",
    },
    {
      name: "Bashir Lawal (RSM - Abuja)",
      email: "rsm.abuja@example.com",
      phone: "+2348000000003",
      password_hash: passwordHash,
      role: "rsm",
      territory_id: territoryIdByName["Abuja Territory 1"],
      status: "active",
    },
    {
      name: "Batho Adobeze",
      email: "batho.adobeze@example.com",
      phone: "+2348000000004",
      password_hash: passwordHash,
      role: "rep",
      territory_id: territoryIdByName["Abuja Territory 2"],
      status: "active",
    },
    {
      name: "Chidinma Okafor",
      email: "chidinma.okafor@example.com",
      phone: "+2348000000005",
      password_hash: passwordHash,
      role: "rep",
      territory_id: territoryIdByName["Lagos Mainland"],
      status: "active",
    },
  ]);

  await knex("products").insert([
    { name: "Amoxil 500mg", category: "Antibiotics", sku: "AMX-500", unit_price: 1200 },
    { name: "Paracetamol 1g", category: "Analgesics", sku: "PCM-1G", unit_price: 350 },
    { name: "Coartem", category: "Antimalarials", sku: "CRT-STD", unit_price: 2500 },
    { name: "Vitamin C 1000mg", category: "Supplements", sku: "VTC-1000", unit_price: 900 },
    { name: "ORS Sachets (x10)", category: "Rehydration", sku: "ORS-10", unit_price: 1500 },
  ]);

  await knex("customers").insert([
    {
      business_name: "Grace Pharmacy",
      business_type: "Pharmacy",
      address: "12 Ademola Adetokunbo Cres",
      town: "Wuse 2",
      lga: "Abuja Municipal",
      state: "FCT",
      region: "North Central",
      contact_person: "Pharm. Grace Nnamdi",
      phone: "+2348011111111",
      status: "active",
      territory_id: territoryIdByName["Abuja Territory 2"],
    },
    {
      business_name: "Divine Mercy Hospital",
      business_type: "Hospital",
      address: "45 Aminu Kano Cres",
      town: "Wuse",
      lga: "Abuja Municipal",
      state: "FCT",
      region: "North Central",
      contact_person: "Mrs. Blessing Okoro",
      phone: "+2348022222222",
      status: "active",
      territory_id: territoryIdByName["Abuja Territory 2"],
    },
    {
      business_name: "Trust Patent Medicine Store",
      business_type: "Patent Medicine Store",
      address: "8 Herbert Macaulay Way",
      town: "Yaba",
      lga: "Lagos Mainland",
      state: "Lagos",
      region: "South West",
      contact_person: "Mr. Tunde Bakare",
      phone: "+2348033333333",
      status: "active",
      territory_id: territoryIdByName["Lagos Mainland"],
    },
  ]);
}
