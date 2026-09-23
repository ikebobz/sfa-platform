import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../../config/db";
import { env } from "../../config/env";
import { ApiError } from "../../common/api-error";
import { Role } from "../../middleware/auth.middleware";

interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: Role;
  territory_id: number | null;
  status: "active" | "inactive";
}

function signTokens(user: UserRow) {
  const payload = { id: user.id, role: user.role, territoryId: user.territory_id };
  const accessToken = jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions["expiresIn"],
  });
  const refreshToken = jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
  return { accessToken, refreshToken };
}

export async function login(email: string, password: string) {
  const user = await db<UserRow>("users").where({ email }).whereNull("deleted_at").first();
  if (!user) throw ApiError.unauthorized("Invalid email or password");
  if (user.status !== "active") throw ApiError.forbidden("Account is inactive");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw ApiError.unauthorized("Invalid email or password");

  const tokens = signTokens(user);
  return {
    ...tokens,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      territoryId: user.territory_id,
    },
  };
}

export async function refresh(refreshToken: string) {
  let payload: { id: number };
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret) as { id: number };
  } catch {
    throw ApiError.unauthorized("Invalid or expired refresh token");
  }

  const user = await db<UserRow>("users").where({ id: payload.id }).whereNull("deleted_at").first();
  if (!user || user.status !== "active") throw ApiError.unauthorized("Account no longer active");

  return signTokens(user);
}
