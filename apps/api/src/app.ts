import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { auditRequest } from "./modules/audit/application/audit-request.middleware.js";
import { coreRouter } from "./modules/core/api/routes/core.routes.js";
import { authRouter } from "./modules/security/api/routes/auth.routes.js";
import { securityRouter } from "./modules/security/api/routes/security.routes.js";
import { config } from "./shared/config/config.js";
import { errorHandler } from "./shared/http/error-handler.middleware.js";
import { notFoundHandler } from "./shared/http/not-found.middleware.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 120,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(auditRequest);

  app.get("/health", (_request, response) => {
    response.json({
      app: "Doble S ERP API",
      status: "ok",
      environment: config.nodeEnv
    });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/security", securityRouter);
  app.use("/api/core", coreRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
