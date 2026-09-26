import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { writeAuditLog } from "../../common/audit";

export const targetsRouter = Router();

// Only "new_customers" is implemented today — see the migration's comment for
// how this extends to other metrics later.
const METRICS = ["new_customers"] as const;
const PERIOD_TYPES = ["day", "week", "month", "quarter"] as const;

const upsertSchema = z.object({
  metric: z.enum(METRICS).default("new_customers"),
  periodType: z.enum(PERIOD_TYPES),
  targetValue: z.number().int().nonnegative(),
  repId: z.number().int().positive().nullable().optional(), // omitted/null = the default target
});

targetsRouter.use(requireAuth, requireRole("admin", "nsm"));

targetsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    let query = db("targets as t")
      .leftJoin("users as u", "u.id", "t.rep_id")
      .select("t.id", "t.metric", "t.period_type", "t.rep_id", "u.name as rep_name", "t.target_value")
      .orderBy(["t.metric", "t.period_type", "t.rep_id"]);

    if (req.query.periodType) query = query.andWhere("t.period_type", req.query.periodType as string);
    if (req.query.metric) query = query.andWhere("t.metric", req.query.metric as string);

    res.json(await query);
  })
);

// Upsert by (metric, period_type, rep_id) — done as an explicit find-then-write
// rather than relying on a DB-level upsert, since rep_id can be NULL (the
// default target) and NULL isn't reliably usable in an ON DUPLICATE KEY clause
// the same way across DB engines.
targetsRouter.put(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = upsertSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid target payload", parsed.error.flatten());
    const { metric, periodType, targetValue, repId } = parsed.data;
    const normalizedRepId = repId ?? null;

    if (normalizedRepId) {
      const rep = await db("users").where({ id: normalizedRepId, role: "rep" }).whereNull("deleted_at").first();
      if (!rep) throw ApiError.notFound("Rep not found");
    }

    const existing = await db("targets")
      .where({ metric, period_type: periodType })
      .andWhere(normalizedRepId ? { rep_id: normalizedRepId } : {})
      .modify((qb) => {
        if (!normalizedRepId) qb.whereNull("rep_id");
      })
      .first();

    let id: number;
    if (existing) {
      await db("targets").where({ id: existing.id }).update({ target_value: targetValue });
      id = existing.id;
    } else {
      const [insertedId] = await db("targets").insert({
        metric,
        period_type: periodType,
        rep_id: normalizedRepId,
        target_value: targetValue,
      });
      id = insertedId;
    }

    await writeAuditLog({
      userId: req.user!.id,
      action: existing ? "update" : "create",
      entity: "targets",
      entityId: id,
      changes: { metric, periodType, targetValue, repId: normalizedRepId },
    });

    res.json({ id, metric, periodType, targetValue, repId: normalizedRepId });
  })
);

targetsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const count = await db("targets").where({ id: req.params.id }).del();
    if (!count) throw ApiError.notFound("Target not found");

    await writeAuditLog({
      userId: req.user!.id,
      action: "delete",
      entity: "targets",
      entityId: Number(req.params.id),
    });
    res.status(204).send();
  })
);
