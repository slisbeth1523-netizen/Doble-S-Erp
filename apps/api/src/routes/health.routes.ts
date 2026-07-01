import { Router } from "express";

import { databaseHealthController, healthController } from "../controllers/health.controller.js";

export const healthRouter = Router();

healthRouter.get("/health", healthController);
healthRouter.get("/health/db", databaseHealthController);

