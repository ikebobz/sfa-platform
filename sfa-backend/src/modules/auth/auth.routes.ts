import { Router } from "express";
import { db } from "../../config/db";
import { asyncHandler } from "../../common/http";
import { ApiError } from "../../common/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { loginSchema, refreshSchema } from "./auth.schema";
import * as authService from "./auth.service";

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid credentials payload", parsed.error.flatten());

    const result = await authService.login(parsed.data.email, parsed.data.password);
    res.json(result);
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const parsed = refreshSchema.safeParse(req.body);
    if (!parsed.success) throw ApiError.badRequest("Invalid refresh payload", parsed.error.flatten());

    const result = await authService.refresh(parsed.data.refreshToken);
    res.json(result);
  })
);

// Logout is stateless (JWT) in this scaffold — the client simply discards tokens.
// If you need server-side revocation, add a refresh-token table/blocklist here.
authRouter.post("/logout", requireAuth, asyncHandler(async (_req, res) => {
  res.status(204).send();
}));

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db("users")
      .select("id", "name", "email", "phone", "role", "territory_id", "status")
      .where({ id: req.user!.id })
      .first();
    if (!user) throw ApiError.notFound("User not found");
    res.json(user);
  })
);
