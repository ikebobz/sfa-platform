import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { writeAuditLog } from "../../common/audit";
import { visibleTerritoryIds } from "../../common/scope";

export const usersRouter = Router();

// Lightweight, name-only directory of reps a manager can see — used to populate
// "filter by rep" dropdowns without granting access to the full admin user CRUD below.
usersRouter.get(
  "/directory",
  requireAuth,
  requireRole("rsm", "nsm", "admin"),
  asyncHandler(async (req, res) => {
    const territoryIds = await visibleTerritoryIds(req.user!);
    let query = db("users")
      .select("id", "name", "territory_id")
      .where({ role: "rep" })
      .whereNull("deleted_at")
      .orderBy("name");
    if (territoryIds !== null) {
      query = territoryIds.length ? query.whereIn("territory_id", territoryIds) : query.whereRaw("1 = 0");
    }
    res.json(await query);
  })
);

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["rep", "rsm", "nsm", "admin"]),
  territoryId: z.number().int().positive().nullable().optional(),
});

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  status: z.enum(["active", "inactive"]).optional(),
});

// All routes below are Admin-only: this platform's user directory is master data.
usersRouter.use(requireAuth, requireRole("admin"));

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const base = db("users")
      .select("id", "name", "email", "phone", "role", "territory_id", "status", "created_at")
      .whereNull("deleted_at")
      .orderBy("id", "desc");
    const result = await paginate(base.clone(), db("users").whereNull("deleted_at"), { page, pageSize });
    res.json(result);
  })
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const user = await db("users")
      .select("id", "name", "email", "phone", "role", "territory_id", "status", "created_at")
      .where({ id: req.params.id })
      .whereNull("deleted_at")
      .first();
    if (!user) throw ApiError.notFound("User not found");
    res.json(user);
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid user payload", parsed.error.flatten());

    const existing = await db("users").where({ email: parsed.data.email }).first();
    if (existing) throw ApiError.conflict("A user with this email already exists");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const [id] = await db("users").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      password_hash: passwordHash,
      role: parsed.data.role,
      territory_id: parsed.data.territoryId ?? null,
    });

    await writeAuditLog({ userId: req.user!.id, action: "create", entity: "users", entityId: id });
    res.status(201).json({ id });
  })
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid user payload", parsed.error.flatten());

    const updates: Record<string, unknown> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.email) updates.email = parsed.data.email;
    if (parsed.data.phone !== undefined) updates.phone = parsed.data.phone;
    if (parsed.data.role) updates.role = parsed.data.role;
    if (parsed.data.territoryId !== undefined) updates.territory_id = parsed.data.territoryId;
    if (parsed.data.status) updates.status = parsed.data.status;

    const count = await db("users").where({ id: req.params.id }).whereNull("deleted_at").update(updates);
    if (!count) throw ApiError.notFound("User not found");

    await writeAuditLog({
      userId: req.user!.id,
      action: "update",
      entity: "users",
      entityId: Number(req.params.id),
      changes: updates,
    });
    res.status(204).send();
  })
);

// Soft delete only — never hard-delete a user with historical sales/expenses attached.
usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const count = await db("users")
      .where({ id: req.params.id })
      .whereNull("deleted_at")
      .update({ deleted_at: db.fn.now(), status: "inactive" });
    if (!count) throw ApiError.notFound("User not found");

    await writeAuditLog({
      userId: req.user!.id,
      action: "delete",
      entity: "users",
      entityId: Number(req.params.id),
    });
    res.status(204).send();
  })
);
