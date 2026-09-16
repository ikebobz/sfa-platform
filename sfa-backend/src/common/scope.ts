import { db } from "../config/db";
import { AuthUser } from "../middleware/auth.middleware";

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
