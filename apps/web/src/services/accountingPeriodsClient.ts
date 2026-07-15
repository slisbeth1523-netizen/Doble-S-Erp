import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type AccountingPeriodStatus = "OPEN" | "CLOSED";

export type AccountingPeriod = {
  accountingPeriodId: string;
  fiscalYear: number;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: AccountingPeriodStatus;
  isAdjustmentPeriod: boolean;
  openedAt?: string;
  openedBy?: string;
  closedAt?: string;
  closedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
  isActive: boolean;
  durationDays: number;
  isCurrentPeriod: boolean;
  displayCode: string;
};

export type AccountingPeriodPayload = {
  fiscalYear: number;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  isAdjustmentPeriod: boolean;
};

export type AccountingPeriodListResult = {
  records: AccountingPeriod[];
  totalItems: number;
  page: number;
  pageSize: number;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

async function requestAccounting<T>(path: string, options: RequestOptions = {}) {
  const response = await apiFetch(path, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    const message = body?.error?.message ?? `La API respondio con estado ${response.status}.`;
    throw new Error(message);
  }

  return body.data;
}

export function listAccountingPeriods(query: {
  fiscalYear?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const params = new URLSearchParams();
  if (query.fiscalYear) params.append("fiscalYear", query.fiscalYear);
  if (query.status) params.append("status", query.status);
  if (query.search) params.append("search", query.search);
  if (query.page) params.append("page", String(query.page));
  if (query.pageSize) params.append("pageSize", String(query.pageSize));

  return requestAccounting<AccountingPeriodListResult>(`/accounting/periods?${params.toString()}`);
}

export function getAccountingPeriod(id: string) {
  return requestAccounting<AccountingPeriod>(`/accounting/periods/${id}`);
}

export function createAccountingPeriod(payload: AccountingPeriodPayload) {
  return requestAccounting<AccountingPeriod>("/accounting/periods", {
    method: "POST",
    body: payload
  });
}

export function updateAccountingPeriod(id: string, payload: AccountingPeriodPayload) {
  return requestAccounting<AccountingPeriod>(`/accounting/periods/${id}`, {
    method: "PATCH",
    body: payload
  });
}

export function closeAccountingPeriod(id: string) {
  return requestAccounting<AccountingPeriod>(`/accounting/periods/${id}/close`, {
    method: "POST"
  });
}

export function reopenAccountingPeriod(id: string, reason: string) {
  return requestAccounting<AccountingPeriod>(`/accounting/periods/${id}/reopen`, {
    method: "POST",
    body: { reason }
  });
}
