export const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4001/api";

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

