import { Router } from "express";

import { accountsReceivableRouter } from "../modules/accounts-receivable/api/routes/accounts-receivable.routes.js";
import { accountsPayableRouter } from "../modules/accounts-payable/api/routes/accounts-payable.routes.js";
import { accountingRouter } from "../modules/accounting/api/routes/accounting.routes.js";
import { eventsRouter } from "../modules/events/api/routes/events.routes.js";
import { inventoryRouter } from "../modules/inventory/api/routes/inventory.routes.js";
import { masterDataRouter } from "../modules/master-data/api/routes/master-data.routes.js";
import { purchasingRouter } from "../modules/purchasing/api/routes/purchasing.routes.js";
import { salesRouter } from "../modules/sales/api/routes/sales.routes.js";
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
apiRouter.use("/purchasing", purchasingRouter);
apiRouter.use("/sales", salesRouter);
apiRouter.use("/accounts-payable", accountsPayableRouter);
apiRouter.use("/accounts-receivable", accountsReceivableRouter);
apiRouter.use("/accounting", accountingRouter);
apiRouter.use("/workflows", workflowRouter);
