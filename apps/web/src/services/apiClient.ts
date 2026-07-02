const configuredApiUrl = import.meta.env.VITE_API_URL as string | undefined;
const fallbackApiHost = "http://localhost:4001";

function normalizeApiUrl(value: string) {
  const trimmed = value.replace(/\/+$/, "");

  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export const apiConfigurationMessage = configuredApiUrl
  ? "API configurada desde VITE_API_URL."
  : "VITE_API_URL no está configurada; se usa http://localhost:4001 como API local.";

export const apiUrl = normalizeApiUrl(configuredApiUrl ?? fallbackApiHost);

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}
