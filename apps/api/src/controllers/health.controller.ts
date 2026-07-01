import type { Request, Response } from "express";

import { getApiHealth, getDbHealth } from "../services/health.service.js";
import { ok } from "../utils/api-response.js";

export function healthController(_request: Request, response: Response) {
  response.json(ok(getApiHealth()));
}

export async function databaseHealthController(_request: Request, response: Response) {
  const health = await getDbHealth();
  response.json(ok(health));
}

