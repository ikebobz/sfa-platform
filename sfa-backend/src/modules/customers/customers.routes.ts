import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { writeAuditLog } from "../../common/audit";

export const customersRouter = Router();

const customerSchema = z.object({
  businessName: z.string().min(2),
  businessType: z.string().optional(),
  address: z.string().optional(),
  town: z.string().optional(),
  lga: z.string().optional(),
  state: z.string().optional(),
  region: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  territoryId: z.number().int().positive(),
});

customersRouter.use(requireAuth);

/**
 * Applies role-based visibility:
 * - admin / nsm: all customers
 * - rsm: all customers whose territory is in the same region as the RSM's home territory
 * - rep: only customers in the rep's own territory
 *
 * Returns { query } — a plain object wrapping the builder, not the builder itself.
 * This matters: a Knex query builder is "thenable" (it implements .then(), which
 * runs the query), so an `async function` that directly `return`s a builder gets
 * that builder auto-adopted by the async function's own promise machinery —
 * the query executes immediately and the caller's `await` resolves to the
 * *rows*, not the builder, silently breaking every later `.where(...)`/`.clone()`
 * call. Wrapping it in `{ query }` avoids that entirely, since a plain object
 * isn't thenable.
 */
async function scopeToRole(query: ReturnType<typeof db>, user: NonNullable<Express.Request["user"]>) {
  if (user.role === "admin" || user.role === "nsm") return { query };

  if (user.role === "rsm") {
    const home = await db("territories").where({ id: user.territoryId }).first();
    if (!home) return { query: query.whereRaw("1 = 0") };
    return {
      query: query.whereIn(
        "customers.territory_id",
        db("territories").select("id").where({ region: home.region })
      ),
    };
  }

  // rep
  return { query: query.where("customers.territory_id", user.territoryId) };
}

customersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const search = (req.query.search as string) || "";
    const status = req.query.status as string | undefined;
    const territoryId = req.query.territoryId ? Number(req.query.territoryId) : undefined;

    let base = db("customers").whereNull("deleted_at");
    if (search) base = base.andWhere("business_name", "like", `%${search}%`);
    if (status) base = base.andWhere({ status });
    ({ query: base } = await scopeToRole(base, req.user!));
    // Applied after scopeToRole so a manager can narrow further, but never outside their allowed scope.
    if (territoryId) base = base.andWhere("customers.territory_id", territoryId);

    const result = await paginate(base.clone().orderBy("business_name"), base.clone(), { page, pageSize });
    res.json(result);
  })
);

customersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    let query = db("customers").where({ id: req.params.id }).whereNull("deleted_at");
    ({ query } = await scopeToRole(query, req.user!));
    const customer = await query.first();
    if (!customer) throw ApiError.notFound("Customer not found");
    res.json(customer);
  })
);

// Only reps add customers — this is deliberately not open to admin/RSM/NSM.
// The territory database is meant to be built by the person actually meeting
// these businesses in the field, not entered secondhand by management.
customersRouter.post(
  "/",
  requireRole("rep"),
  asyncHandler(async (req, res) => {
    const parsed = customerSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid customer payload", parsed.error.flatten());

    // A rep may only add customers into their own territory.
    if (parsed.data.territoryId !== req.user!.territoryId) {
      throw ApiError.forbidden("You can only add customers within your own territory");
    }

    const [id] = await db("customers").insert({
      business_name: parsed.data.businessName,
      business_type: parsed.data.businessType,
      address: parsed.data.address,
      town: parsed.data.town,
      lga: parsed.data.lga,
      state: parsed.data.state,
      region: parsed.data.region,
      contact_person: parsed.data.contactPerson,
      phone: parsed.data.phone,
      email: parsed.data.email,
      territory_id: parsed.data.territoryId,
    });

    await writeAuditLog({ userId: req.user!.id, action: "create", entity: "customers", entityId: id });
    res.status(201).json({ id });
  })
);

customersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = customerSchema.partial().safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid customer payload", parsed.error.flatten());

    let scoped = db("customers").where({ id: req.params.id }).whereNull("deleted_at");
    ({ query: scoped } = await scopeToRole(scoped, req.user!));
    const existing = await scoped.first();
    if (!existing) throw ApiError.notFound("Customer not found");

    const updates: Record<string, unknown> = {};
    for (const [key, col] of [
      ["businessName", "business_name"],
      ["businessType", "business_type"],
      ["address", "address"],
      ["town", "town"],
      ["lga", "lga"],
      ["state", "state"],
      ["region", "region"],
      ["contactPerson", "contact_person"],
      ["phone", "phone"],
      ["email", "email"],
      ["territoryId", "territory_id"],
    ] as const) {
      const val = (parsed.data as Record<string, unknown>)[key];
      if (val !== undefined) updates[col] = val;
    }

    await db("customers").where({ id: req.params.id }).update(updates);
    await writeAuditLog({
      userId: req.user!.id,
      action: "update",
      entity: "customers",
      entityId: Number(req.params.id),
      changes: updates,
    });
    res.status(204).send();
  })
);
