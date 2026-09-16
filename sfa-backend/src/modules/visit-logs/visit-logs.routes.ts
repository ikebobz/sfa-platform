import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth } from "../../middleware/auth.middleware";

export const visitLogsRouter = Router();

const logSchema = z.object({
  planId: z.number().int().positive().optional(),
  customerId: z.number().int().positive(),
  visitDate: z.string(), // YYYY-MM-DD
  notes: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

visitLogsRouter.use(requireAuth);

visitLogsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const repId = req.user!.role === "rep" ? req.user!.id : Number(req.query.repId) || undefined;

    let base = db("visit_logs as vl")
      .join("customers as c", "c.id", "vl.customer_id")
      .select("vl.*", "c.business_name");
    if (repId) base = base.where("vl.rep_id", repId);

    const result = await paginate(
      base.clone().orderBy("vl.visit_date", "desc"),
      base.clone(),
      { page, pageSize }
    );
    res.json(result);
  })
);

visitLogsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = logSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid visit log payload", parsed.error.flatten());

    const [id] = await db.transaction(async (trx) => {
      const insertedIds = await trx("visit_logs").insert({
        plan_id: parsed.data.planId,
        rep_id: req.user!.id,
        customer_id: parsed.data.customerId,
        visit_date: parsed.data.visitDate,
        notes: parsed.data.notes,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
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
