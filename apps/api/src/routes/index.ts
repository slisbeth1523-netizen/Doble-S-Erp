import { Router } from "express";

import { masterDataRouter } from "../modules/master-data/api/routes/master-data.routes.js";
import { securityRouter } from "../modules/security/api/routes/security.routes.js";
import { healthRouter } from "./health.routes.js";
import { versionRouter } from "./version.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(versionRouter);
apiRouter.use("/security", securityRouter);
apiRouter.use("/master-data", masterDataRouter);
