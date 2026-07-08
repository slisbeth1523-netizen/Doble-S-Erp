import { Router } from "express";

import { eventsRouter } from "../modules/events/api/routes/events.routes.js";
import { inventoryRouter } from "../modules/inventory/api/routes/inventory.routes.js";
import { masterDataRouter } from "../modules/master-data/api/routes/master-data.routes.js";
import { authRouter } from "../modules/security/api/routes/auth.routes.js";
import { securityRouter } from "../modules/security/api/routes/security.routes.js";
import { workflowRouter } from "../modules/workflow/api/routes/workflow.routes.js";
import { healthRouter } from "./health.routes.js";
import { versionRouter } from "./version.routes.js";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(versionRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/security", securityRouter);
apiRouter.use("/master-data", masterDataRouter);
apiRouter.use("/inventory", inventoryRouter);
apiRouter.use("/workflows", workflowRouter);
