import { Request, Router } from "express";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { requireAuth } from "../../middleware/auth.middleware";

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
 * Reps are implicitly scoped to their own territory; RSM/NSM/Admin may pass ?territoryId=.
 */
dashboardRouter.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const filters = readFilters(req);
    const territoryId = req.user!.role === "rep" ? req.user!.territoryId ?? undefined : filters.territoryId;

    const customerQuery = db("customers").whereNull("deleted_at");
    if (territoryId) customerQuery.andWhere({ territory_id: territoryId });

    const [{ total: totalCustomers }] = (await customerQuery
      .clone()
      .count({ total: "*" })) as unknown as [{ total: number }];
    const [{ total: activeCustomers }] = (await customerQuery
      .clone()
      .andWhere({ status: "active" })
      .count({ total: "*" })) as unknown as [{ total: number }];

    let salesQuery = db("sales as s").join("customers as c", "c.id", "s.customer_id");
    if (territoryId) salesQuery = salesQuery.andWhere("c.territory_id", territoryId);
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

    let visitQuery = db("visit_logs as vl").join("customers as c", "c.id", "vl.customer_id");
    if (territoryId) visitQuery = visitQuery.andWhere("c.territory_id", territoryId);
    if (filters.from) visitQuery = visitQuery.andWhere("vl.visit_date", ">=", filters.from);
    if (filters.to) visitQuery = visitQuery.andWhere("vl.visit_date", "<=", filters.to);
    const [{ totalVisits }] = (await visitQuery
      .clone()
      .count({ totalVisits: "*" })) as unknown as [{ totalVisits: number }];

    let expenseQuery = db("expenses");
    if (filters.from) expenseQuery = expenseQuery.andWhere("expense_date", ">=", filters.from);
    if (filters.to) expenseQuery = expenseQuery.andWhere("expense_date", "<=", filters.to);
    const [{ totalExpenses }] = (await expenseQuery
      .clone()
      .sum({ totalExpenses: "total_cost" })) as unknown as [{ totalExpenses: number | null }];

    const [{ totalDebt }] = (await db("ledger_entries")
      .sum({ totalDebt: "closing_balance" })) as unknown as [{ totalDebt: number | null }];

    const activeRatio = totalCustomers ? Number(activeCustomers) / Number(totalCustomers) : 0;

    res.json({
      filters: { territoryId, from: filters.from, to: filters.to },
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
