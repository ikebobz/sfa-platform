import { db } from "../config/db";
import { AuthUser } from "../middleware/auth.middleware";
import { ApiError } from "./api-error";

/**
 * Returns the territory ids this user is allowed to see:
 * - admin / nsm: null, meaning "unrestricted" (caller should skip filtering)
 * - rsm: every territory in the same region as their home territory
 * - rep: just their own territory (or [] if they have none assigned)
 */
export async function visibleTerritoryIds(user: AuthUser): Promise<number[] | null> {
  if (user.role === "admin" || user.role === "nsm") return null;

  if (user.role === "rsm") {
    const home = await db("territories").where({ id: user.territoryId }).first();
    if (!home) return [];
    const rows = await db("territories").select("id").where({ region: home.region });
    return rows.map((r) => r.id as number);
  }

  return user.territoryId ? [user.territoryId] : [];
}

/**
 * Resolves an optional, explicitly-requested territoryId against what the user is
 * allowed to see. Throws 403 if they asked for something outside their scope.
 * Returns a concrete list to filter by, or null for "unrestricted" (admin/nsm,
 * no explicit request).
 */
export async function resolveTerritoryFilter(
  user: AuthUser,
  requestedTerritoryId?: number
): Promise<number[] | null> {
  const allowed = await visibleTerritoryIds(user);
  if (requestedTerritoryId) {
    if (allowed !== null && !allowed.includes(requestedTerritoryId)) {
      throw ApiError.forbidden("Territory is outside your visible scope");
    }
    return [requestedTerritoryId];
  }
  return allowed;
}
