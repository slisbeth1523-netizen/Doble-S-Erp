import { Router } from "express";

import { healthRouter } from "./health.routes.js";
import { versionRouter } from "./version.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(versionRouter);

