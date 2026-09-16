import { Request } from "express";
import { Knex } from "knex";

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function getPagination(req: Request): PaginationParams {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  return { page, pageSize };
}

/**
 * Applies limit/offset to a Knex query builder and returns both the page of
 * results and the total row count, in the shape every list endpoint should return:
 * { data, page, pageSize, total }
 */
export async function paginate<T>(
  query: Knex.QueryBuilder,
  countQuery: Knex.QueryBuilder,
  { page, pageSize }: PaginationParams
): Promise<{ data: T[]; page: number; pageSize: number; total: number }> {
  const [{ count }] = (await countQuery.count({ count: "*" })) as unknown as [{ count: number }];
  const data = (await query.limit(pageSize).offset((page - 1) * pageSize)) as T[];
  return { data, page, pageSize, total: Number(count) };
}
