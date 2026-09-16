import { Router } from "express";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { requireAuth } from "../../middleware/auth.middleware";

export const stockRouter = Router();

stockRouter.use(requireAuth);

// stock_daily rows are written automatically by the sales and expenses modules;
// this endpoint is read-only by design.
stockRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const repId = req.user!.role === "rep" ? req.user!.id : Number(req.query.repId) || undefined;

    let query = db("stock_daily").orderBy("log_date", "desc");
    if (repId) query = query.where({ rep_id: repId });
    if (req.query.from) query = query.andWhere("log_date", ">=", req.query.from as string);
    if (req.query.to) query = query.andWhere("log_date", "<=", req.query.to as string);

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
