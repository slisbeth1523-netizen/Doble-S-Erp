import { Router } from "express";

import { databaseHealthController, healthController } from "../controllers/health.controller.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const healthRouter = Router();

healthRouter.get("/health", healthController);
healthRouter.get("/health/db", asyncHandler(databaseHealthController));
