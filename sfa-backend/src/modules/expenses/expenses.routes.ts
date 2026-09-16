import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { getPagination, paginate } from "../../common/pagination";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";
import { writeAuditLog } from "../../common/audit";

export const expensesRouter = Router();

// Move to a per-territory settings table if the limit should vary by region/rep grade.
const MONTHLY_EXPENSE_LIMIT = 100_000;

const expenseSchema = z.object({
  expenseDate: z.string(),
  fuelAmount: z.number().nonnegative().default(0),
  litres: z.number().nonnegative().optional(),
  odometerKm: z.number().nonnegative().optional(),
  vehicleServiceCost: z.number().nonnegative().default(0),
  otherCost: z.number().nonnegative().default(0),
  receiptPhotoUrl: z.string().url().optional(),
});

expensesRouter.use(requireAuth);

expensesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = getPagination(req);
    const repId = req.user!.role === "rep" ? req.user!.id : Number(req.query.repId) || undefined;
    const status = req.query.status as string | undefined;

    let base = db("expenses");
    if (repId) base = base.where({ rep_id: repId });
    if (status) base = base.andWhere({ approval_status: status });

    const result = await paginate(base.clone().orderBy("expense_date", "desc"), base.clone(), {
      page,
      pageSize,
    });
    res.json(result);
  })
);

expensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = expenseSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid expense payload", parsed.error.flatten());
    const d = parsed.data;
    const total = d.fuelAmount + d.vehicleServiceCost + d.otherCost;

    const [id] = await db.transaction(async (trx) => {
      const insertedId = await trx("expenses").insert({
        rep_id: req.user!.id,
        expense_date: d.expenseDate,
        fuel_amount: d.fuelAmount,
        litres: d.litres,
        odometer_km: d.odometerKm,
        vehicle_service_cost: d.vehicleServiceCost,
        other_cost: d.otherCost,
        total_cost: total,
        receipt_photo_url: d.receiptPhotoUrl,
      });

      const existingStock = await trx("stock_daily")
        .where({ rep_id: req.user!.id, log_date: d.expenseDate })
        .first();
      if (existingStock) {
        await trx("stock_daily")
          .where({ id: existingStock.id })
          .update({ expense_total: Number(existingStock.expense_total) + total });
      } else {
        await trx("stock_daily").insert({
          rep_id: req.user!.id,
          log_date: d.expenseDate,
          expense_total: total,
        });
      }

      return insertedId;
    });

    // Flag (not block) spend over the monthly limit so the response can surface a warning to the rep.
    const period = d.expenseDate.slice(0, 7);
    const [{ monthTotal }] = (await db("expenses")
      .where({ rep_id: req.user!.id })
      .andWhereRaw("DATE_FORMAT(expense_date, '%Y-%m') = ?", [period])
      .sum({ monthTotal: "total_cost" })) as unknown as [{ monthTotal: number }];

    res.status(201).json({
      id,
      totalCost: total,
      monthToDateTotal: Number(monthTotal),
      overLimit: Number(monthTotal) > MONTHLY_EXPENSE_LIMIT,
      limit: MONTHLY_EXPENSE_LIMIT,
    });
  })
);

expensesRouter.patch(
  "/:id/decision",
  requireRole("rsm", "admin"),
  asyncHandler(async (req, res) => {
    const schema = z.object({ decision: z.enum(["approved", "rejected"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid decision payload", parsed.error.flatten());

    const count = await db("expenses").where({ id: req.params.id }).update({
      approval_status: parsed.data.decision,
      approved_by: req.user!.id,
    });
    if (!count) throw ApiError.notFound("Expense not found");

    await writeAuditLog({
      userId: req.user!.id,
      action: parsed.data.decision,
      entity: "expenses",
      entityId: Number(req.params.id),
    });
    res.status(204).send();
  })
);
