import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { writeAuditLog } from "../../common/audit";

export const territoriesRouter = Router();

const territorySchema = z.object({
  name: z.string().min(2),
  region: z.string().min(2),
  state: z.string().min(2),
});

territoriesRouter.use(requireAuth);

territoriesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rows = await db("territories").whereNull("deleted_at").orderBy("name");
    res.json(rows);
  })
);

territoriesRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = territorySchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid territory payload", parsed.error.flatten());

    const [id] = await db("territories").insert(parsed.data);
    await writeAuditLog({ userId: req.user!.id, action: "create", entity: "territories", entityId: id });
    res.status(201).json({ id });
  })
);

territoriesRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = territorySchema.partial().safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid territory payload", parsed.error.flatten());

    const count = await db("territories").where({ id: req.params.id }).whereNull("deleted_at").update(parsed.data);
    if (!count) throw ApiError.notFound("Territory not found");

    await writeAuditLog({
      userId: req.user!.id,
      action: "update",
      entity: "territories",
      entityId: Number(req.params.id),
      changes: parsed.data,
    });
    res.status(204).send();
  })
);

territoriesRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const count = await db("territories")
      .where({ id: req.params.id })
      .whereNull("deleted_at")
      .update({ deleted_at: db.fn.now() });
    if (!count) throw ApiError.notFound("Territory not found");
    res.status(204).send();
  })
);
