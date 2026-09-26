import { Knex } from "knex";
import { ApiError } from "../../common/api-error";

/**
 * Adjusts a rep's on-hand quantity for a product by `delta` (positive to add
 * stock received from the office, negative to deplete stock as a sale is
 * recorded). Always run inside the same DB transaction as the event that
 * triggered it (a receipt insert or a sale insert) so the balance never
 * drifts out of sync with its source records.
 *
 * Throws a 400 if a negative delta would take the balance below zero — a rep
 * cannot sell more units of a product than they currently have on hand. If a
 * rep legitimately needs to sell before their balance is corrected (e.g. a
 * data-entry backlog), an admin can log a correcting receipt first.
 */
export async function adjustStockBalance(
  trx: Knex,
  repId: number,
  productId: number,
  delta: number
): Promise<number> {
  const existing = await trx("stock_balances").where({ rep_id: repId, product_id: productId }).first();
  const currentQty = existing ? Number(existing.quantity_on_hand) : 0;
  const newQty = currentQty + delta;

  if (newQty < 0) {
    throw ApiError.badRequest(
      `Insufficient stock: only ${currentQty} unit(s) on hand for this product, cannot deduct ${-delta}.`
    );
  }

  if (existing) {
    await trx("stock_balances").where({ id: existing.id }).update({ quantity_on_hand: newQty });
  } else {
    await trx("stock_balances").insert({ rep_id: repId, product_id: productId, quantity_on_hand: newQty });
  }

  return newQty;
}
