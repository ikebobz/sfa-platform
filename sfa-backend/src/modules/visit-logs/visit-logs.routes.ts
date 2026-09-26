import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";

export const visitLogsRouter = Router();

// Kept as a fixed list rather than a lookup table — short, unlikely to change
// often, and validated the same way `payment_status` etc. are elsewhere in
// this codebase. Mirror this list in the frontend if you add a value here.
export const VISIT_ACTIVITY_TYPES = [
  "product_detailing",
  "sample_distribution",
  "order_placed",
  "payment_collection",
  "merchandising",
  "complaint_handling",
  "training_education",
  "relationship_building",
  "other",
] as const;

const logSchema = z.object({
  planId: z.number().int().positive().optional(),
  customerId: z.number().int().positive(),
  visitDate: z.string(), // YYYY-MM-DD
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  activities: z.array(z.enum(VISIT_ACTIVITY_TYPES)).optional().default([]),
  productsDiscussed: z.array(z.number().int().positive()).optional().default([]),
});

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

visitLogsRouter.use(requireAuth);

visitLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const user = req.user!;

    let base = db("visit_logs as vl")
      .join("customers as c", "c.id", "vl.customer_id")
      .join("users as u", "u.id", "vl.rep_id")
      .select("vl.*", "c.business_name", "u.name as rep_name");

    if (user.role === "rep") {
      base = base.where("vl.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        base = territoryIds.length ? base.whereIn("c.territory_id", territoryIds) : base.whereRaw("1 = 0");
      }
      if (req.query.repId) base = base.andWhere("vl.rep_id", Number(req.query.repId));
    }
    if (req.query.from) base = base.andWhere("vl.visit_date", ">=", req.query.from as string);
    if (req.query.to) base = base.andWhere("vl.visit_date", "<=", req.query.to as string);

    const result = await paginate(
      base.clone().orderBy("vl.visit_date", "desc"),
      base.clone(),
      { page, pageSize }
    );

    result.data = result.data.map((row: Record<string, unknown>) => ({
      ...row,
      activities: parseJsonArray(row.activities),
      products_discussed: parseJsonArray(row.products_discussed),
    }));

    res.json(result);
  })
);

visitLogsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = logSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid visit log payload", parsed.error.flatten());

    const customer = await db("customers").where({ id: parsed.data.customerId }).whereNull("deleted_at").first();
    if (!customer) throw ApiError.notFound("Customer not found");

    // Mirrors the same rule already enforced on customer creation and sale recording.
    if (req.user!.role === "rep" && customer.territory_id !== req.user!.territoryId) {
      throw ApiError.forbidden("You can only log visits for customers in your own territory");
    }

    if (parsed.data.planId) {
      const plan = await db("visit_plans").where({ id: parsed.data.planId }).first();
      if (!plan) throw ApiError.notFound("Visit plan not found");
      if (req.user!.role === "rep" && plan.rep_id !== req.user!.id) {
        throw ApiError.forbidden("You can only log a visit against your own plan");
      }
    }

    const [id] = await db.transaction(async (trx) => {
      const insertedIds = await trx("visit_logs").insert({
        plan_id: parsed.data.planId,
        rep_id: req.user!.id,
        customer_id: parsed.data.customerId,
        visit_date: parsed.data.visitDate,
        notes: parsed.data.notes,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        activities: JSON.stringify(parsed.data.activities),
        products_discussed: JSON.stringify(parsed.data.productsDiscussed),
      });

      // Mark the linked plan completed, and bump the customer's last_visit_date.
      if (parsed.data.planId) {
        await trx("visit_plans").where({ id: parsed.data.planId }).update({ status: "completed" });
      }
      await trx("customers")
        .where({ id: parsed.data.customerId })
        .update({ last_visit_date: parsed.data.visitDate });

      return insertedIds;
    });

    res.status(201).json({ id });
  })
);
