import type { Request, Response } from "express";

import { sendSuccess } from "../utils/responseBuilder.js";

export function versionController(_request: Request, response: Response) {
  sendSuccess(response, {
    name: "Doble S ERP API",
    version: "0.1.0"
  });
}
