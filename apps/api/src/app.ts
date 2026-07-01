import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { requestContextMiddleware } from "./middlewares/request-context.middleware.js";
import { apiRouter } from "./routes/index.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(requestContextMiddleware);
  app.use(env.apiPrefix, apiRouter);
  app.use(errorMiddleware);

  return app;
}
