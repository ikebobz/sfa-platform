import { Router } from "express";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { resolveTerritoryFilter } from "../../common/scope";
import { toCsv, sendCsv } from "../../common/csv";
import { creditRisk } from "../ledger/ledger.routes";

export const reportsRouter = Router();

// Matches the platform's feature matrix: report export is an RSM/NSM/Admin capability.
reportsRouter.use(requireAuth, requireRole("rsm", "nsm", "admin"));

function dateFilters(req: import("express").Request) {
  return {
    from: (req.query.from as string) || undefined,
    to: (req.query.to as string) || undefined,
  };
}

reportsRouter.get(
  "/sales/export",
  asyncHandler(async (req, res) => {
    const territoryId = req.query.territoryId ? Number(req.query.territoryId) : undefined;
    const allowed = await resolveTerritoryFilter(req.user!, territoryId);
    const { from, to } = dateFilters(req);

    let query = db("sales as s")
      .join("customers as c", "c.id", "s.customer_id")
      .join("products as p", "p.id", "s.product_id")
      .join("users as u", "u.id", "s.rep_id")
      .select(
        "s.sale_date", "u.name as rep_name", "c.business_name", "p.name as product_name",
        "s.quantity", "s.unit_price", "s.revenue", "s.payment_status", "s.amount_paid"
      )
      .orderBy("s.sale_date", "desc");

    if (allowed !== null) query = allowed.length ? query.whereIn("c.territory_id", allowed) : query.whereRaw("1 = 0");
    if (from) query = query.andWhere("s.sale_date", ">=", from);
    if (to) query = query.andWhere("s.sale_date", "<=", to);

    const rows = await query;
    const csv = toCsv(rows, [
      { key: "sale_date", header: "Sale date" },
      { key: "rep_name", header: "Rep" },
      { key: "business_name", header: "Customer" },
      { key: "product_name", header: "Product" },
      { key: "quantity", header: "Quantity" },
      { key: "unit_price", header: "Unit price" },
      { key: "revenue", header: "Revenue" },
      { key: "payment_status", header: "Payment status" },
      { key: "amount_paid", header: "Amount paid" },
    ]);
    sendCsv(res, "sales-report.csv", csv);
  })
);

reportsRouter.get(
  "/expenses/export",
  asyncHandler(async (req, res) => {
    const territoryId = req.query.territoryId ? Number(req.query.territoryId) : undefined;
    const allowed = await resolveTerritoryFilter(req.user!, territoryId);
    const { from, to } = dateFilters(req);

    let query = db("expenses as e")
      .join("users as u", "u.id", "e.rep_id")
      .select(
        "e.expense_date", "u.name as rep_name", "e.fuel_amount", "e.vehicle_service_cost",
        "e.other_cost", "e.total_cost", "e.approval_status"
      )
      .orderBy("e.expense_date", "desc");

    if (allowed !== null) query = allowed.length ? query.whereIn("u.territory_id", allowed) : query.whereRaw("1 = 0");
    if (from) query = query.andWhere("e.expense_date", ">=", from);
    if (to) query = query.andWhere("e.expense_date", "<=", to);

    const rows = await query;
    const csv = toCsv(rows, [
      { key: "expense_date", header: "Date" },
      { key: "rep_name", header: "Rep" },
      { key: "fuel_amount", header: "Fuel" },
      { key: "vehicle_service_cost", header: "Vehicle service" },
      { key: "other_cost", header: "Other" },
      { key: "total_cost", header: "Total" },
      { key: "approval_status", header: "Approval status" },
    ]);
    sendCsv(res, "expenses-report.csv", csv);
  })
);

reportsRouter.get(
  "/debt-analysis/export",
  asyncHandler(async (req, res) => {
    const territoryId = req.query.territoryId ? Number(req.query.territoryId) : undefined;
    const allowed = await resolveTerritoryFilter(req.user!, territoryId);

    const latestPeriods = db("ledger_entries as le1")
      .select("le1.customer_id")
      .max("le1.period as period")
      .groupBy("le1.customer_id")
      .as("latest");

    let query = db("ledger_entries as le")
      .join(latestPeriods, function () {
        this.on("le.customer_id", "=", "latest.customer_id").andOn("le.period", "=", "latest.period");
      })
      .join("customers as c", "c.id", "le.customer_id")
      .select("c.business_name", "c.territory_id", "le.closing_balance")
      .where("le.closing_balance", ">", 0)
      .orderBy("le.closing_balance", "desc");

    if (allowed !== null) query = allowed.length ? query.whereIn("c.territory_id", allowed) : query.whereRaw("1 = 0");

    const rows = await query;
    const csv = toCsv(
      rows.map((r) => ({
        business_name: r.business_name,
        balance: Number(r.closing_balance),
        risk_level: creditRisk(Number(r.closing_balance)),
      })),
      [
        { key: "business_name", header: "Customer" },
        { key: "balance", header: "Outstanding balance" },
        { key: "risk_level", header: "Risk level" },
      ]
    );
    sendCsv(res, "debt-analysis-report.csv", csv);
  })
);

reportsRouter.get(
  "/customers/export",
  asyncHandler(async (req, res) => {
    const territoryId = req.query.territoryId ? Number(req.query.territoryId) : undefined;
    const allowed = await resolveTerritoryFilter(req.user!, territoryId);
    const status = req.query.status as string | undefined;

    let query = db("customers as c")
      .leftJoin("territories as t", "t.id", "c.territory_id")
      .select(
        "c.business_name", "c.business_type", "c.town", "c.lga", "c.state", "t.name as territory_name",
        "c.status", "c.last_visit_date", "c.last_supply_date"
      )
      .whereNull("c.deleted_at")
      .orderBy("c.business_name");

    if (allowed !== null) query = allowed.length ? query.whereIn("c.territory_id", allowed) : query.whereRaw("1 = 0");
    if (status) query = query.andWhere("c.status", status);

    const rows = await query;
    const csv = toCsv(rows, [
      { key: "business_name", header: "Business" },
      { key: "business_type", header: "Type" },
      { key: "town", header: "Town" },
      { key: "lga", header: "LGA" },
      { key: "state", header: "State" },
      { key: "territory_name", header: "Territory" },
      { key: "status", header: "Status" },
      { key: "last_visit_date", header: "Last visit" },
      { key: "last_supply_date", header: "Last supply" },
    ]);
    sendCsv(res, "customers-report.csv", csv);
  })
);
