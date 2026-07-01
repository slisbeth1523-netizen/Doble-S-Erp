import { Router } from "express";

import { versionController } from "../controllers/version.controller.js";

export const versionRouter = Router();

versionRouter.get("/version", versionController);

