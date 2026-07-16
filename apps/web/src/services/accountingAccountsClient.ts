import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type AccountingAccount = {
  accountId: string;
  code: string;
  name: string;
  description?: string;
  parentAccountId?: string;
  parentCode?: string;
  parentName?: string;
  level: number;
  accountType: string;
  normalBalance: string;
  classification?: string;
  allowsPosting: boolean;
  requiresCostCenter: boolean;
  requiresThirdParty: boolean;
  isControlAccount: boolean;
  currencyCode?: string;
  validFrom?: string;
  validTo?: string;
  isBlocked: boolean;
  blockReason?: string;
  isActive: boolean;
  childCount: number;
  fullPath: string;
};

export type AccountingAccountPayload = {
  code: string;
  name: string;
  description?: string;
  parentAccountId?: string;
  accountType: string;
  normalBalance: string;
  classification?: string;
  allowsPosting: boolean;
  requiresCostCenter: boolean;
  requiresThirdParty: boolean;
  isControlAccount: boolean;
  currencyCode?: string;
  validFrom?: string;
  validTo?: string;
};

export type AccountingAccountListResult = {
  records: AccountingAccount[];
  totalItems: number;
  page: number;
  pageSize: number;
};

async function requestAccounting<T>(path: string, options: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {}) {
  const response = await apiFetch(path, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error?.message ?? `La API respondio con estado ${response.status}.`);
  }

  return body.data;
}

export function listAccountingAccounts(query: { search?: string; accountType?: string; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.search) params.append("search", query.search);
  if (query.accountType) params.append("accountType", query.accountType);
  params.append("pageSize", String(query.pageSize ?? 200));

  return requestAccounting<AccountingAccountListResult>(`/accounting/accounts?${params.toString()}`);
}

export function createAccountingAccount(payload: AccountingAccountPayload) {
  return requestAccounting<AccountingAccount>("/accounting/accounts", { method: "POST", body: payload });
}

export function updateAccountingAccount(id: string, payload: AccountingAccountPayload) {
  return requestAccounting<AccountingAccount>(`/accounting/accounts/${id}`, { method: "PATCH", body: payload });
}

export function blockAccountingAccount(id: string, reason: string) {
  return requestAccounting<AccountingAccount>(`/accounting/accounts/${id}/block`, { method: "POST", body: { reason } });
}

export function unblockAccountingAccount(id: string) {
  return requestAccounting<AccountingAccount>(`/accounting/accounts/${id}/unblock`, { method: "POST" });
}

export function activateAccountingAccount(id: string) {
  return requestAccounting<AccountingAccount>(`/accounting/accounts/${id}/activate`, { method: "POST" });
}

export function deactivateAccountingAccount(id: string) {
  return requestAccounting<AccountingAccount>(`/accounting/accounts/${id}/deactivate`, { method: "POST" });
}
