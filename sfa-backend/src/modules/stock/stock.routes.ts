import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";
import { adjustStockBalance } from "./stock.service";

export const stockRouter = Router();

const receiptSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  receivedDate: z.string(), // YYYY-MM-DD
  notes: z.string().optional(),
});

stockRouter.use(requireAuth);

// stock_daily rows are written automatically by the sales and expenses modules;
// this endpoint is read-only by design.
stockRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    let query = db("stock_daily as sd")
      .join("users as u", "u.id", "sd.rep_id")
      .select("sd.*", "u.name as rep_name")
      .orderBy("sd.log_date", "desc");

    if (user.role === "rep") {
      query = query.where("sd.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        query = territoryIds.length ? query.whereIn("u.territory_id", territoryIds) : query.whereRaw("1 = 0");
      }
      if (req.query.repId) query = query.andWhere("sd.rep_id", Number(req.query.repId));
    }
    if (req.query.from) query = query.andWhere("sd.log_date", ">=", req.query.from as string);
    if (req.query.to) query = query.andWhere("sd.log_date", "<=", req.query.to as string);

    const rows = await query;
    res.json(
      rows.map((r) => ({
        ...r,
        product_quantities:
          typeof r.product_quantities === "string"
            ? JSON.parse(r.product_quantities)
            : r.product_quantities,
      }))
    );
  })
);

// Current on-hand stock per product, per rep. Rep-owned data — same territory/
// region scoping pattern as every other list endpoint in this app.
stockRouter.get(
  "/balances",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    let query = db("stock_balances as sb")
      .join("users as u", "u.id", "sb.rep_id")
      .join("products as p", "p.id", "sb.product_id")
      .select("sb.rep_id", "u.name as rep_name", "sb.product_id", "p.name as product_name", "sb.quantity_on_hand")
      .orderBy(["u.name", "p.name"]);

    if (user.role === "rep") {
      query = query.where("sb.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        query = territoryIds.length ? query.whereIn("u.territory_id", territoryIds) : query.whereRaw("1 = 0");
      }
      if (req.query.repId) query = query.andWhere("sb.rep_id", Number(req.query.repId));
    }

    res.json(await query);
  })
);

// History of stock received from the office. Same scoping as balances.
stockRouter.get(
  "/receipts",
  asyncHandler(async (req, res) => {
    const user = req.user!;

    let query = db("stock_receipts as sr")
      .join("users as u", "u.id", "sr.rep_id")
      .join("products as p", "p.id", "sr.product_id")
      .select("sr.*", "u.name as rep_name", "p.name as product_name")
      .orderBy("sr.received_date", "desc");

    if (user.role === "rep") {
      query = query.where("sr.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        query = territoryIds.length ? query.whereIn("u.territory_id", territoryIds) : query.whereRaw("1 = 0");
      }
      if (req.query.repId) query = query.andWhere("sr.rep_id", Number(req.query.repId));
    }
    if (req.query.from) query = query.andWhere("sr.received_date", ">=", req.query.from as string);
    if (req.query.to) query = query.andWhere("sr.received_date", "<=", req.query.to as string);

    res.json(await query);
  })
);

// A rep logs stock they've physically received from the office. Deliberately
// rep-only: this is the rep confirming what arrived in their hands, not the
// office pushing an allocation — if a "dispatch" workflow initiated by the
// office is needed later, that's a separate endpoint, not a role broadening
// of this one.
stockRouter.post(
  "/receipts",
  requireRole("rep"),
  asyncHandler(async (req, res) => {
    const parsed = receiptSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid stock receipt payload", parsed.error.flatten());
    const data = parsed.data;

    const product = await db("products").where({ id: data.productId }).whereNull("deleted_at").first();
    if (!product) throw ApiError.notFound("Product not found");

    const result = await db.transaction(async (trx) => {
      const [id] = await trx("stock_receipts").insert({
        rep_id: req.user!.id,
        product_id: data.productId,
        quantity: data.quantity,
        received_date: data.receivedDate,
        notes: data.notes,
      });
      const balance = await adjustStockBalance(trx, req.user!.id, data.productId, data.quantity);
      return { id, balance };
    });

    res.status(201).json({ id: result.id, quantityOnHand: result.balance });
  })
);
