import { Knex } from "knex";
import { db } from "../config/db";

export async function writeAuditLog(
  params: {
    userId: number | null;
    action: string; // e.g. "create", "update", "delete", "approve"
    entity: string; // e.g. "expenses", "sales", "users"
    entityId: number | null;
    changes?: unknown;
  },
  trx?: Knex
) {
  const conn = trx || db;
  await conn("audit_log").insert({
    user_id: params.userId,
    action: params.action,
    entity: params.entity,
    entity_id: params.entityId,
    changes: params.changes ? JSON.stringify(params.changes) : null,
  });
}
