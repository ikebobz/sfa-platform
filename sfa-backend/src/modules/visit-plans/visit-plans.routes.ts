import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";

export const visitPlansRouter = Router();

const planSchema = z.object({
  customerId: z.number().int().positive(),
  plannedDate: z.string(), // YYYY-MM-DD
  productToDetailId: z.number().int().positive().optional(),
  objective: z.string().optional(),
});

visitPlansRouter.use(requireAuth);

// Reps see only their own plans. RSM sees plans for reps in their region; NSM/Admin see all.
// Any of these may narrow further with ?repId=.
visitPlansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    let query = db("visit_plans as vp")
      .join("users as u", "u.id", "vp.rep_id")
      .join("customers as c", "c.id", "vp.customer_id")
      .select(
        "vp.id", "vp.rep_id", "u.name as rep_name", "vp.customer_id", "c.business_name",
        "vp.planned_date", "vp.product_to_detail_id", "vp.objective", "vp.status"
      )
      .orderBy("vp.planned_date", "desc");

    if (user.role === "rep") {
      query = query.where("vp.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        query = territoryIds.length ? query.whereIn("u.territory_id", territoryIds) : query.whereRaw("1 = 0");
      }
      if (req.query.repId) query = query.andWhere("vp.rep_id", Number(req.query.repId));
    }

    if (req.query.from) query = query.andWhere("vp.planned_date", ">=", req.query.from as string);
    if (req.query.to) query = query.andWhere("vp.planned_date", "<=", req.query.to as string);

    res.json(await query);
  })
);

visitPlansRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid visit plan payload", parsed.error.flatten());

    const [id] = await db("visit_plans").insert({
      rep_id: req.user!.id,
      customer_id: parsed.data.customerId,
      planned_date: parsed.data.plannedDate,
      product_to_detail_id: parsed.data.productToDetailId,
      objective: parsed.data.objective,
    });
    res.status(201).json({ id });
  })
);

visitPlansRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const statusSchema = z.object({ status: z.enum(["planned", "completed", "missed"]) });
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid status payload", parsed.error.flatten());

    const query = db("visit_plans").where({ id: req.params.id });
    if (req.user!.role === "rep") query.andWhere({ rep_id: req.user!.id });

    const count = await query.update({ status: parsed.data.status });
    if (!count) throw ApiError.notFound("Visit plan not found");
    res.status(204).send();
  })
);
