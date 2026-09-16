import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth, requireRole } from "../../middleware/auth.middleware";

export const invoicesRouter = Router();

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(3),
  invoiceDate: z.string(),
  period: z.string(),
  totalAmount: z.number().nonnegative(),
});

invoicesRouter.use(requireAuth);

invoicesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await db("invoices").orderBy("invoice_date", "desc"));
  })
);

invoicesRouter.post(
  "/",
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const parsed = invoiceSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid invoice payload", parsed.error.flatten());

    const [id] = await db("invoices").insert({
      invoice_number: parsed.data.invoiceNumber,
      invoice_date: parsed.data.invoiceDate,
      period: parsed.data.period,
      total_amount: parsed.data.totalAmount,
    });
    res.status(201).json({ id });
  })
);
