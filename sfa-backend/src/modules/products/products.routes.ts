import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { writeAuditLog } from "../../common/audit";

export const productsRouter = Router();

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional(),
  sku: z.string().optional(),
  unitPrice: z.number().nonnegative(),
});

productsRouter.use(requireAuth);

productsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const search = (req.query.search as string) || "";
    const base = db("products").whereNull("deleted_at");
    if (search) base.andWhere("name", "like", `%${search}%`);
    const result = await paginate(base.clone().orderBy("name"), base.clone(), { page, pageSize });
    res.json(result);
  })
);

productsRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = productSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid product payload", parsed.error.flatten());

    const [id] = await db("products").insert({
      name: parsed.data.name,
      category: parsed.data.category,
      sku: parsed.data.sku,
      unit_price: parsed.data.unitPrice,
    });
    await writeAuditLog({ userId: req.user!.id, action: "create", entity: "products", entityId: id });
    res.status(201).json({ id });
  })
);

productsRouter.patch(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = productSchema.partial().safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid product payload", parsed.error.flatten());

    const updates: Record<string, unknown> = {};
    if (parsed.data.name) updates.name = parsed.data.name;
    if (parsed.data.category !== undefined) updates.category = parsed.data.category;
    if (parsed.data.sku !== undefined) updates.sku = parsed.data.sku;
    if (parsed.data.unitPrice !== undefined) updates.unit_price = parsed.data.unitPrice;

    const count = await db("products").where({ id: req.params.id }).whereNull("deleted_at").update(updates);
    if (!count) throw ApiError.notFound("Product not found");

    await writeAuditLog({
      userId: req.user!.id,
      action: "update",
      entity: "products",
      entityId: Number(req.params.id),
      changes: updates,
    });
    res.status(204).send();
  })
);

productsRouter.delete(
  "/:id",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const count = await db("products")
      .where({ id: req.params.id })
      .whereNull("deleted_at")
      .update({ deleted_at: db.fn.now() });
    if (!count) throw ApiError.notFound("Product not found");
    res.status(204).send();
  })
);
