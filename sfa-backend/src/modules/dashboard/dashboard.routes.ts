import { Request, Router } from "express";
import { Knex } from "knex";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);

interface Filters {
  territoryId?: number;
  from?: string;
  to?: string;
}

function readFilters(req: Request): Filters {
  return {
    territoryId: req.query.territoryId ? Number(req.query.territoryId) : undefined,
    from: (req.query.from as string) || undefined,
    to: (req.query.to as string) || undefined,
  };
}

/**
 * Single aggregate endpoint replicating the original Excel Dashboard tab:
 * database size, visit coverage, revenue, top products/customers, expense status.
 * Reps are implicitly scoped to their own territory; RSM/NSM/Admin may narrow with
 * ?territoryId=, but never outside what visibleTerritoryIds() allows them to see —
 * and critically, the *default* "all territories" view for an RSM is their own
 * region, not the whole company (this endpoint previously ignored territory
 * scoping entirely for expenses/debt, and for every metric once no explicit
 * ?territoryId= was passed).
 */
dashboardRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const filters = readFilters(req);
    const user = req.user!;
    const allowed = await visibleTerritoryIds(user);

    if (filters.territoryId && allowed !== null && !allowed.includes(filters.territoryId)) {
      throw ApiError.forbidden("Territory is outside your visible scope");
    }
    // null = unrestricted (admin/nsm with no explicit filter); otherwise a concrete list to scope every query by.
    const territoryFilter: number[] | null = filters.territoryId
      ? [filters.territoryId]
      : allowed;

    function scopeByTerritory(query: Knex.QueryBuilder, column: string): Knex.QueryBuilder {
      if (territoryFilter === null) return query;
      return territoryFilter.length ? query.whereIn(column, territoryFilter) : query.whereRaw("1 = 0");
    }

    let customerQuery = db("customers").whereNull("deleted_at");
    customerQuery = scopeByTerritory(customerQuery, "territory_id");

    const [{ total: totalCustomers }] = (await customerQuery
      .clone()
      .count({ total: "*" })) as unknown as [{ total: number }];
    const [{ total: activeCustomers }] = (await customerQuery
      .clone()
      .andWhere({ status: "active" })
      .count({ total: "*" })) as unknown as [{ total: number }];

    let salesQuery = scopeByTerritory(db("sales as s").join("customers as c", "c.id", "s.customer_id"), "c.territory_id");
    if (filters.from) salesQuery = salesQuery.andWhere("s.sale_date", ">=", filters.from);
    if (filters.to) salesQuery = salesQuery.andWhere("s.sale_date", "<=", filters.to);

    const [{ totalRevenue }] = (await salesQuery
      .clone()
      .sum({ totalRevenue: "s.revenue" })) as unknown as [{ totalRevenue: number | null }];

    const topProducts = await salesQuery
      .clone()
      .join("products as p", "p.id", "s.product_id")
      .select("p.id", "p.name")
      .sum({ revenue: "s.revenue" })
      .groupBy("p.id", "p.name")
      .orderBy("revenue", "desc")
      .limit(10);

    const topCustomers = await salesQuery
      .clone()
      .select("c.id", "c.business_name")
      .sum({ revenue: "s.revenue" })
      .groupBy("c.id", "c.business_name")
      .orderBy("revenue", "desc")
      .limit(30);

    const bottomCustomers = await salesQuery
      .clone()
      .select("c.id", "c.business_name")
      .sum({ revenue: "s.revenue" })
      .groupBy("c.id", "c.business_name")
      .orderBy("revenue", "asc")
      .limit(30);

    let visitQuery = scopeByTerritory(
      db("visit_logs as vl").join("customers as c", "c.id", "vl.customer_id"),
      "c.territory_id"
    );
    if (filters.from) visitQuery = visitQuery.andWhere("vl.visit_date", ">=", filters.from);
    if (filters.to) visitQuery = visitQuery.andWhere("vl.visit_date", "<=", filters.to);
    const [{ totalVisits }] = (await visitQuery
      .clone()
      .count({ totalVisits: "*" })) as unknown as [{ totalVisits: number }];

    // Expenses are attributed to a rep, not a customer, so scope via the rep's territory.
    let expenseQuery = scopeByTerritory(
      db("expenses as e").join("users as u", "u.id", "e.rep_id"),
      "u.territory_id"
    );
    if (filters.from) expenseQuery = expenseQuery.andWhere("e.expense_date", ">=", filters.from);
    if (filters.to) expenseQuery = expenseQuery.andWhere("e.expense_date", "<=", filters.to);
    const [{ totalExpenses }] = (await expenseQuery
      .clone()
      .sum({ totalExpenses: "e.total_cost" })) as unknown as [{ totalExpenses: number | null }];

    let debtQuery = scopeByTerritory(
      db("ledger_entries as le").join("customers as c", "c.id", "le.customer_id"),
      "c.territory_id"
    );
    const [{ totalDebt }] = (await debtQuery
      .clone()
      .sum({ totalDebt: "le.closing_balance" })) as unknown as [{ totalDebt: number | null }];

    const activeRatio = totalCustomers ? Number(activeCustomers) / Number(totalCustomers) : 0;

    res.json({
      filters: { territoryId: filters.territoryId, from: filters.from, to: filters.to },
      database: {
        totalCustomers: Number(totalCustomers),
        activeCustomers: Number(activeCustomers),
        activeRatio,
        verdict: activeRatio >= 0.7 ? "GOOD TERRITORY DATABASE" : "POOR TERRITORY DATABASE — GROW COVERAGE",
      },
      visits: { totalVisits: Number(totalVisits) },
      revenue: { total: Number(totalRevenue) || 0, topProducts, topCustomers, bottomCustomers },
      expenses: { total: Number(totalExpenses) || 0 },
      debt: { total: Number(totalDebt) || 0 },
    });
  })
);
