import { apiConfigurationMessage, apiUrl } from "./apiConfig.js";
import { clearDemoSession, getDemoSession } from "./demoAuthClient.js";

export { apiConfigurationMessage, apiUrl };

async function buildHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const session = await getDemoSession();

  if (session?.accessToken && !nextHeaders.has("authorization")) {
    nextHeaders.set("authorization", `Bearer ${session.accessToken}`);
  }

  if (session?.user.tenantId && !nextHeaders.has("x-tenant-id")) {
    nextHeaders.set("x-tenant-id", session.user.tenantId);
  }

  if (session?.user.companyId && !nextHeaders.has("x-company-id")) {
    nextHeaders.set("x-company-id", session.user.companyId);
  }

  return nextHeaders;
}

export async function apiFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: await buildHeaders(init.headers)
  });

  if (response.status === 401 && retry) {
    clearDemoSession();
    return apiFetch(path, init, false);
  }

  return response;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await apiFetch(path);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
