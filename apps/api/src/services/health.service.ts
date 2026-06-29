import { getDatabaseHealth } from "../repositories/health.repository.js";

export function getApiHealth() {
  return {
    status: "ok",
    service: "doble-s-erp-api",
    timestamp: new Date().toISOString()
  };
}

export async function getDbHealth() {
  return getDatabaseHealth();
}

