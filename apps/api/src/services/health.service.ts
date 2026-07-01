import { getDatabaseHealth } from "../repositories/health.repository.js";
import { clock } from "../utils/clock.js";

export function getApiHealth() {
  return {
    status: "ok",
    service: "doble-s-erp-api",
    timestamp: clock.isoNow()
  };
}

export async function getDbHealth() {
  return getDatabaseHealth();
}
