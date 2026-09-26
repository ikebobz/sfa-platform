import { Request, Router } from "express";
import { Knex } from "knex";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";
import { resolvePeriodBounds, PeriodType } from "../../common/period";

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

    // New customers added within the same from/to window as everything else on
    // this dashboard (sales, visits) — so a manager can see "how many new
    // businesses did we actually onboard this period", not just the running total.
    let newCustomersQuery = customerQuery.clone();
    if (filters.from) newCustomersQuery = newCustomersQuery.andWhere("customers.created_at", ">=", filters.from);
    if (filters.to) newCustomersQuery = newCustomersQuery.andWhere("customers.created_at", "<=", `${filters.to} 23:59:59`);
    const [{ total: newCustomers }] = (await newCustomersQuery.count({ total: "*" })) as unknown as [
      { total: number }
    ];

    let salesQuery = scopeByTerritory(db("sales as s").join("customers as c", "c.id", "s.customer_id"), "c.territory_id");
    if (filters.from) salesQuery = salesQuery.andWhere("s.sale_date", ">=", filters.from);
    if (filters.to) salesQuery = salesQuery.andWhere("s.sale_date", "<=", filters.to);

    const [{ totalRevenue }] = (await salesQuery
      .clone()
      .sum({ totalRevenue: "s.revenue" })) as unknown as [{ totalRevenue: number | null }];
    const [{ salesCount }] = (await salesQuery
      .clone()
      .count({ salesCount: "s.id" })) as unknown as [{ salesCount: number }];

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
        newCustomersInPeriod: Number(newCustomers),
        activeRatio,
        verdict: activeRatio >= 0.7 ? "GOOD TERRITORY DATABASE" : "POOR TERRITORY DATABASE — GROW COVERAGE",
      },
      visits: { totalVisits: Number(totalVisits) },
      revenue: {
        total: Number(totalRevenue) || 0,
        salesCount: Number(salesCount) || 0,
        topProducts,
        topCustomers,
        bottomCustomers,
      },
      expenses: { total: Number(totalExpenses) || 0 },
      debt: { total: Number(totalDebt) || 0 },
    });
  })
);

const periodTypeSchema = z.enum(["day", "week", "month", "quarter"]);

/**
 * New customers actually onboarded so far this day/week/month/quarter, per
 * rep, against that rep's target for the same period type (their own
 * override if one is set, else the metric+period-type default, else no
 * target at all — shown as "not set" rather than silently treated as 0).
 *
 * Scoped the same way as everything else: a rep sees only themself, an RSM
 * sees their region's reps, NSM/admin see everyone (or a chosen territory).
 */
dashboardRouter.get(
  "/rep-targets",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const parsedPeriod = periodTypeSchema.safeParse(req.query.periodType || "month");
    if (!parsedPeriod.success) throw ApiError.badRequest("periodType must be one of day, week, month, quarter");
    const periodType: PeriodType = parsedPeriod.data;
    const { start, end } = resolvePeriodBounds(periodType);

    const territoryIdParam = req.query.territoryId ? Number(req.query.territoryId) : undefined;
    const allowed = await visibleTerritoryIds(user);
    if (territoryIdParam && allowed !== null && !allowed.includes(territoryIdParam)) {
      throw ApiError.forbidden("Territory is outside your visible scope");
    }
    const territoryFilter: number[] | null = territoryIdParam ? [territoryIdParam] : allowed;

    // Which reps are in view: just the caller if they're a rep, otherwise every
    // rep whose territory falls within territoryFilter (or every rep, if null).
    let repsQuery = db("users").select("id", "name", "territory_id").where({ role: "rep" }).whereNull("deleted_at");
    if (user.role === "rep") {
      repsQuery = repsQuery.andWhere({ id: user.id });
    } else if (territoryFilter !== null) {
      repsQuery = territoryFilter.length ? repsQuery.whereIn("territory_id", territoryFilter) : repsQuery.whereRaw("1 = 0");
    }
    const reps = await repsQuery.orderBy("name");
    if (reps.length === 0) {
      return res.json({ periodType, periodStart: start, periodEnd: end, rows: [] });
    }
    const repIds = reps.map((r) => r.id);

    const [newCustomerCountsByTerritory, targetRows] = await Promise.all([
      db("customers")
        .select("territory_id")
        .count({ count: "*" })
        .whereNull("deleted_at")
        .whereNotNull("territory_id")
        .andWhere("created_at", ">=", start)
        .andWhere("created_at", "<=", `${end} 23:59:59`)
        .groupBy("territory_id"),
      db("targets").where({ metric: "new_customers", period_type: periodType }).whereIn("rep_id", [...repIds, null] as unknown as number[]),
    ]);

    // Customers are attributed to a territory, not to the individual rep who
    // added them (there's no created_by column on customers) — so "new
    // customers for this rep" is really "new customers in this rep's
    // territory". That's the correct number under this app's usual one-rep-
    // per-territory model, but if a territory is ever assigned more than one
    // rep, each of them would see the same, whole-territory count here rather
    // than their individual share. Adding a `created_by_rep_id` column to
    // `customers` would resolve this properly if that ever becomes a real
    // scenario — not needed for the current territory model.
    const countByTerritory = new Map(newCustomerCountsByTerritory.map((r) => [r.territory_id as number, Number(r.count)]));
    const countByRep = new Map(reps.map((rep) => [rep.id, rep.territory_id !== null ? countByTerritory.get(rep.territory_id) ?? 0 : 0]));

    const overrideByRep = new Map(
      targetRows.filter((t) => t.rep_id !== null).map((t) => [t.rep_id as number, Number(t.target_value)])
    );
    const defaultTarget = targetRows.find((t) => t.rep_id === null)?.target_value ?? null;

    const rows = reps.map((rep) => {
      const target = overrideByRep.has(rep.id) ? overrideByRep.get(rep.id)! : defaultTarget;
      const actual = countByRep.get(rep.id) ?? 0;
      const attainmentPct = target ? Math.round((actual / target) * 100) : null;
      const status: "good" | "watch" | "poor" | "no_target" =
        target === null ? "no_target" : attainmentPct! >= 100 ? "good" : attainmentPct! >= 60 ? "watch" : "poor";

      return {
        repId: rep.id,
        repName: rep.name,
        target,
        actual,
        attainmentPct,
        status,
        isOverride: overrideByRep.has(rep.id),
      };
    });

    res.json({
      periodType,
      periodStart: start,
      periodEnd: end,
      defaultTarget,
      rows,
    });
  })
);
