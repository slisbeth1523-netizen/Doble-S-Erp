import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { loginWithPassword, logoutUser } from "../../application/auth.service.js";
import { requireAuth } from "../auth.middleware.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (request, response) => {
    const credentials = loginSchema.parse(request.body);
    const result = await loginWithPassword(credentials.email, credentials.password);

    response.json(result);
  })
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (request, response) => {
    await logoutUser(request.user!);
    response.status(204).send();
  })
);

authRouter.get("/me", requireAuth, (request, response) => {
  response.json({ user: request.user });
});
