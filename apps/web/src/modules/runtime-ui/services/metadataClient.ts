import type { ApiResponse } from "@doble-s-erp/shared";

import { FriendlyApiError, apiErrorKindFromStatus, normalizeApiError } from "../../../services/apiErrors.js";
import { apiFetch } from "../../../services/apiClient.js";
import type {
  CatalogListResult,
  CatalogMetadata,
  CatalogRecord,
  LookupOption
} from "../types/runtime-ui.types.js";
import { saveLocalCatalogRecord, deleteLocalCatalogRecord } from "./localStorageDb.js";

type QueryValue = string | number | boolean | null | undefined;

function buildQuery(params: Record<string, QueryValue>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

async function requestApi<T>(path: string): Promise<T> {
  try {
    const response = await apiFetch(path);
    const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !body?.success) {
      throw new FriendlyApiError(apiErrorKindFromStatus(response.status), response.status);
    }

    if (body.data === undefined) {
      throw new FriendlyApiError("generic");
    }

    return body.data;
  } catch (error: unknown) {
    throw normalizeApiError(error);
  }
}

export function fetchCatalogMetadata(catalog: string) {
  return requestApi<CatalogMetadata>(`/master-data/${encodeURIComponent(catalog)}/metadata`);
}

export function fetchCatalogLookup(
  catalog: string,
  params: { search?: string; page?: number; pageSize?: number } = {}
) {
  return requestApi<LookupOption[]>(
    `/master-data/${encodeURIComponent(catalog)}/lookup${buildQuery(params)}`
  );
}

export async function fetchCatalogItems(
  catalog: string,
  params: {
    search?: string;
    isActive?: boolean;
    createdFrom?: string;
    createdTo?: string;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  } = {}
): Promise<CatalogListResult> {
  try {
    const result = await apiFetch(`/master-data/${encodeURIComponent(catalog)}${buildQuery(params)}`);
    const body = (await result.json().catch(() => null)) as ApiResponse<CatalogRecord[]> | null;

    if (!result.ok || !body?.success) {
      throw new FriendlyApiError(apiErrorKindFromStatus(result.status), result.status);
    }

    const pagination = body.meta?.pagination as
      | { page?: number; pageSize?: number; totalItems?: number }
      | undefined;

    return {
      items: body.data ?? [],
      totalItems: pagination?.totalItems ?? body.data?.length ?? 0,
      page: pagination?.page,
      pageSize: pagination?.pageSize
    };
  } catch (error: unknown) {
    throw normalizeApiError(error);
  }
}

export async function saveCatalogItem(catalog: string, record: CatalogRecord): Promise<CatalogRecord> {
  try {
    const isEdit = !!record.id;
    const path = isEdit ? `/master-data/${encodeURIComponent(catalog)}/${encodeURIComponent(String(record.id))}` : `/master-data/${encodeURIComponent(catalog)}`;
    const method = isEdit ? "PUT" : "POST";
    
    const response = await apiFetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(record)
    });
    
    const body = (await response.json().catch(() => null)) as ApiResponse<CatalogRecord> | null;
    if (!response.ok || !body?.success || !body.data) {
      throw new FriendlyApiError(apiErrorKindFromStatus(response.status), response.status);
    }
    
    return body.data;
  } catch (error: unknown) {
    // API failed, write locally as fallback
    console.warn("API write failed, writing locally:", error);
    return saveLocalCatalogRecord(catalog, record);
  }
}

export async function deleteCatalogItem(catalog: string, id: string): Promise<void> {
  try {
    const response = await apiFetch(`/master-data/${encodeURIComponent(catalog)}/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    
    if (!response.ok) {
      throw new FriendlyApiError(apiErrorKindFromStatus(response.status), response.status);
    }
  } catch (error: unknown) {
    // API failed, delete locally as fallback
    console.warn("API delete failed, deleting locally:", error);
    deleteLocalCatalogRecord(catalog, id);
  }
}
