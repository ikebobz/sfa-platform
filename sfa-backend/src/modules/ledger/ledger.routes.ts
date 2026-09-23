import { Router } from "express";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";

export const ledgerRouter = Router();

ledgerRouter.use(requireAuth);

// Configurable thresholds — move to a settings table if these need to be tunable per organisation.
export const CREDIT_RISK_THRESHOLDS = {
  goodMax: 200_000, // closing balance below this => "good"
  watchMax: 750_000, // below this => "watch", otherwise "poor"
};

export function creditRisk(closingBalance: number): "good" | "watch" | "poor" {
  if (closingBalance <= CREDIT_RISK_THRESHOLDS.goodMax) return "good";
  if (closingBalance <= CREDIT_RISK_THRESHOLDS.watchMax) return "watch";
  return "poor";
}

ledgerRouter.get(
  "/customers/:customerId",
  asyncHandler(async (req, res) => {
    const customer = await db("customers").where({ id: req.params.customerId }).first();
    if (!customer) throw ApiError.notFound("Customer not found");

    // A rep may only view ledgers for customers in their own territory; RSM likewise
    // restricted to their region. Mirrors the same rule used for sales/visit writes.
    const territoryIds = await visibleTerritoryIds(req.user!);
    if (territoryIds !== null && !territoryIds.includes(customer.territory_id)) {
      throw ApiError.forbidden("This customer is outside your visible territory scope");
    }

    const entries = await db("ledger_entries")
      .where({ customer_id: req.params.customerId })
      .orderBy("period", "desc");

    const latest = entries[0];
    res.json({
      customerId: Number(req.params.customerId),
      businessName: customer.business_name,
      currentBalance: latest ? Number(latest.closing_balance) : 0,
      riskLevel: latest ? creditRisk(Number(latest.closing_balance)) : "good",
      history: entries,
    });
  })
);

// Debt Analysis equivalent: every customer with an outstanding balance, ranked worst-first.
ledgerRouter.get(
  "/debt-analysis",
  asyncHandler(async (req, res) => {
    const requestedTerritoryId = req.query.territoryId ? Number(req.query.territoryId) : undefined;
    const territoryIds = await visibleTerritoryIds(req.user!);

    if (requestedTerritoryId && territoryIds !== null && !territoryIds.includes(requestedTerritoryId)) {
      throw ApiError.forbidden("Territory is outside your visible scope");
    }
    const allowed = requestedTerritoryId ? [requestedTerritoryId] : territoryIds;

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
      .select("c.id as customer_id", "c.business_name", "c.territory_id", "le.closing_balance")
      .where("le.closing_balance", ">", 0)
      .orderBy("le.closing_balance", "desc");

    if (allowed !== null) query = allowed.length ? query.whereIn("c.territory_id", allowed) : query.whereRaw("1 = 0");

    const rows = await query;
    res.json(
      rows.map((r) => ({
        customerId: r.customer_id,
        businessName: r.business_name,
        territoryId: r.territory_id,
        balance: Number(r.closing_balance),
        riskLevel: creditRisk(Number(r.closing_balance)),
      }))
    );
  })
);
