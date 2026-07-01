import type { Request, Response } from "express";

import { getApiHealth, getDbHealth } from "../services/health.service.js";
import { sendFailure, sendSuccess } from "../utils/responseBuilder.js";

export function healthController(_request: Request, response: Response) {
  sendSuccess(response, getApiHealth());
}

export async function databaseHealthController(_request: Request, response: Response) {
  const health = await getDbHealth();

  if (!health.connected) {
    sendFailure(response, "Database unavailable", health, 503);
    return;
  }

  sendSuccess(response, health);
}
