import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";

export const incentivesRouter = Router();

// Move these to a configurable settings/targets table once real payout rules are confirmed.
const INCENTIVE_RULES = {
  qualifyingRevenue: 500_000, // rep must hit this much revenue in the period to qualify
  repPayout: 25_000,
  rsmPayoutPerQualifyingRep: 5_000,
  nsmPayoutPerQualifyingRep: 2_000,
};

incentivesRouter.use(requireAuth);

incentivesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    let query = db("incentives as i")
      .join("users as u", "u.id", "i.rep_id")
      .leftJoin("products as p", "p.id", "i.product_id")
      .select("i.*", "u.name as rep_name", "p.name as product_name")
      .orderBy("i.period", "desc");

    if (user.role === "rep") {
      query = query.where("i.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        query = territoryIds.length ? query.whereIn("u.territory_id", territoryIds) : query.whereRaw("1 = 0");
      }
      if (req.query.repId) query = query.andWhere("i.rep_id", Number(req.query.repId));
    }
    if (req.query.period) query = query.andWhere("i.period", req.query.period as string);

    res.json(await query);
  })
);

/**
 * Recalculates incentive qualification/payout for a given period (YYYY-MM-01)
 * from actual sales revenue per rep, and upserts the `incentives` table.
 * Admin/NSM only — this is a deliberate, auditable action, not an automatic trigger.
 */
incentivesRouter.post(
  "/recalculate",
  requireRole("admin", "nsm"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ period: z.string() }); // first day of the month, e.g. "2026-09-01"
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid period payload", parsed.error.flatten());
    const period = parsed.data.period;
    const periodPrefix = period.slice(0, 7); // YYYY-MM

    const revenueByRep = (await db("sales")
      .select("rep_id")
      .sum({ revenue: "revenue" })
      .whereRaw("DATE_FORMAT(sale_date, '%Y-%m') = ?", [periodPrefix])
      .groupBy("rep_id")) as Array<{ rep_id: number; revenue: number | string }>;

    const results = await db.transaction(async (trx) => {
      const rows = [];
      for (const row of revenueByRep) {
        const revenue = Number(row.revenue);
        const qualifies = revenue >= INCENTIVE_RULES.qualifyingRevenue;

        const existing = await trx("incentives").where({ rep_id: row.rep_id, period }).first();
        const payload = {
          rep_id: row.rep_id,
          period,
          metric_value: revenue,
          status: qualifies ? "qualified" : "pending",
          amount_rep: qualifies ? INCENTIVE_RULES.repPayout : 0,
          amount_rsm: qualifies ? INCENTIVE_RULES.rsmPayoutPerQualifyingRep : 0,
          amount_nsm: qualifies ? INCENTIVE_RULES.nsmPayoutPerQualifyingRep : 0,
        };

        if (existing) {
          await trx("incentives").where({ id: existing.id }).update(payload);
        } else {
          await trx("incentives").insert(payload);
        }
        rows.push(payload);
      }
      return rows;
    });

    res.json({ period, recalculated: results.length, results });
  })
);
