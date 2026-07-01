import type { Request, Response } from "express";

import { ok } from "../utils/api-response.js";

export function versionController(_request: Request, response: Response) {
  response.json(
    ok({
      name: "Doble S ERP API",
      version: "0.1.0"
    })
  );
}

