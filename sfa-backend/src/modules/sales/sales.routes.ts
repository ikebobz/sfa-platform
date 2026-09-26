import { Router } from "express";
import { z } from "zod";
import { Knex } from "knex";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { visibleTerritoryIds } from "../../common/scope";
import { adjustStockBalance } from "../stock/stock.service";

export const salesRouter = Router();

const saleSchema = z.object({
  visitId: z.number().int().positive().optional(),
  customerId: z.number().int().positive(),
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive().optional(), // falls back to the product's catalog price
  paymentStatus: z.enum(["full_payment", "part_payment", "credit"]),
  amountPaid: z.number().nonnegative().optional(),
  saleDate: z.string(), // YYYY-MM-DD
});

function firstOfMonth(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Upserts the customer's ledger row for the sale's period, carrying the
 * previous period's closing balance forward as this period's opening balance
 * the first time a period row is created.
 */
async function applyToLedger(
  trx: Knex,
  customerId: number,
  saleDate: string,
  revenue: number,
  amountPaid: number
) {
  const period = firstOfMonth(saleDate);
  const existing = await trx("ledger_entries").where({ customer_id: customerId, period }).first();

  if (existing) {
    const salesTotal = Number(existing.sales_total) + revenue;
    const paymentsTotal = Number(existing.payments_total) + amountPaid;
    const closingBalance = Number(existing.opening_balance) + salesTotal - paymentsTotal;
    await trx("ledger_entries").where({ id: existing.id }).update({
      sales_total: salesTotal,
      payments_total: paymentsTotal,
      closing_balance: closingBalance,
    });
    return;
  }

  const previous = await trx("ledger_entries")
    .where({ customer_id: customerId })
    .andWhere("period", "<", period)
    .orderBy("period", "desc")
    .first();
  const openingBalance = previous ? Number(previous.closing_balance) : 0;
  const closingBalance = openingBalance + revenue - amountPaid;

  await trx("ledger_entries").insert({
    customer_id: customerId,
    period,
    opening_balance: openingBalance,
    sales_total: revenue,
    payments_total: amountPaid,
    closing_balance: closingBalance,
  });
}

/** Upserts today's stock_daily row for the rep, incrementing sales and product quantities. */
async function applyToStockDaily(
  trx: Knex,
  repId: number,
  saleDate: string,
  revenue: number,
  productId: number,
  quantity: number
) {
  const existing = await trx("stock_daily").where({ rep_id: repId, log_date: saleDate }).first();

  if (!existing) {
    await trx("stock_daily").insert({
      rep_id: repId,
      log_date: saleDate,
      sales_total: revenue,
      product_quantities: JSON.stringify({ [productId]: quantity }),
    });
    return;
  }

  const quantities: Record<string, number> =
    typeof existing.product_quantities === "string"
      ? JSON.parse(existing.product_quantities)
      : existing.product_quantities || {};
  quantities[productId] = (quantities[productId] || 0) + quantity;

  await trx("stock_daily").where({ id: existing.id }).update({
    sales_total: Number(existing.sales_total) + revenue,
    product_quantities: JSON.stringify(quantities),
  });
}

salesRouter.use(requireAuth);

salesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const user = req.user!;
    const productId = Number(req.query.productId) || undefined;
    const customerId = Number(req.query.customerId) || undefined;

    let base = db("sales as s")
      .join("customers as c", "c.id", "s.customer_id")
      .join("products as p", "p.id", "s.product_id")
      .join("users as u", "u.id", "s.rep_id")
      .select("s.*", "c.business_name", "p.name as product_name", "u.name as rep_name");

    if (user.role === "rep") {
      base = base.where("s.rep_id", user.id);
    } else {
      const territoryIds = await visibleTerritoryIds(user);
      if (territoryIds !== null) {
        base = territoryIds.length ? base.whereIn("c.territory_id", territoryIds) : base.whereRaw("1 = 0");
      }
      if (req.query.repId) base = base.andWhere("s.rep_id", Number(req.query.repId));
    }
    if (customerId) base = base.andWhere("s.customer_id", customerId);
    if (productId) base = base.andWhere("s.product_id", productId);
    if (req.query.from) base = base.andWhere("s.sale_date", ">=", req.query.from as string);
    if (req.query.to) base = base.andWhere("s.sale_date", "<=", req.query.to as string);

    const result = await paginate(base.clone().orderBy("s.sale_date", "desc"), base.clone(), { page, pageSize });
    res.json(result);
  })
);

salesRouter.post(
  "/",
  requireRole("rep"),
  asyncHandler(async (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid sale payload", parsed.error.flatten());
    const data = parsed.data;

    const product = await db("products").where({ id: data.productId }).whereNull("deleted_at").first();
    if (!product) throw ApiError.notFound("Product not found");

    const customer = await db("customers").where({ id: data.customerId }).whereNull("deleted_at").first();
    if (!customer) throw ApiError.notFound("Customer not found");

    // A rep may only record sales against customers in their own territory — mirrors the
    // same rule already enforced on customer creation in customers.routes.ts.
    if (req.user!.role === "rep" && customer.territory_id !== req.user!.territoryId) {
      throw ApiError.forbidden("You can only record sales for customers in your own territory");
    }

    const unitPrice = data.unitPrice ?? Number(product.unit_price);
    const revenue = unitPrice * data.quantity;
    const amountPaid =
      data.paymentStatus === "full_payment"
        ? revenue
        : data.paymentStatus === "credit"
        ? 0
        : data.amountPaid ?? 0;

    if (data.paymentStatus === "part_payment" && amountPaid >= revenue) {
      throw ApiError.badRequest("Part payment must be less than the sale revenue");
    }

    // Sale creation, ledger update, stock roll-up, and balance depletion must succeed or fail
    // together — if there isn't enough stock on hand, adjustStockBalance throws and the whole
    // sale (including the ledger/stock_daily writes above it) rolls back.
    const result = await db.transaction(async (trx) => {
      const [id] = await trx("sales").insert({
        visit_id: data.visitId,
        customer_id: data.customerId,
        product_id: data.productId,
        rep_id: req.user!.id,
        quantity: data.quantity,
        unit_price: unitPrice,
        revenue,
        payment_status: data.paymentStatus,
        amount_paid: amountPaid,
        sale_date: data.saleDate,
      });

      await applyToLedger(trx, data.customerId, data.saleDate, revenue, amountPaid);
      await applyToStockDaily(trx, req.user!.id, data.saleDate, revenue, data.productId, data.quantity);
      const remainingStock = await adjustStockBalance(trx, req.user!.id, data.productId, -data.quantity);
      await trx("customers").where({ id: data.customerId }).update({ last_supply_date: data.saleDate });

      return { id, remainingStock };
    });

    res.status(201).json({ id: result.id, revenue, amountPaid, remainingStock: result.remainingStock });
  })
);
