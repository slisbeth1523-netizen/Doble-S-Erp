import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type JournalEntryLine = {
  journalEntryLineId: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  debitBaseAmount: number;
  creditBaseAmount: number;
  reference?: string;
};

export type JournalEntry = {
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  accountingPeriodId: string;
  periodCode: string;
  description: string;
  reference?: string;
  status: "DRAFT" | "POSTED";
  currencyCode: string;
  exchangeRate: number;
  totalDebit: number;
  totalCredit: number;
  totalDebitBase: number;
  totalCreditBase: number;
  difference: number;
  baseDifference: number;
  lineCount: number;
  postedAt?: string;
  postedBy?: string;
  lines?: JournalEntryLine[];
  canEdit?: boolean;
  canPost?: boolean;
  isBalanced?: boolean;
};

export type JournalEntryListResult = {
  records: JournalEntry[];
  totalItems: number;
  page: number;
  pageSize: number;
};

export type JournalEntryPayload = {
  entryDate: string;
  description: string;
  reference?: string;
  currencyCode: string;
  exchangeRate: number;
};

export type JournalEntryLinePayload = {
  accountId: string;
  costCenterId?: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  reference?: string;
};

async function requestAccounting<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}
) {
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

export function listJournalEntries(query: { search?: string; status?: string; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.search) params.append("search", query.search);
  if (query.status) params.append("status", query.status);
  params.append("pageSize", String(query.pageSize ?? 25));

  return requestAccounting<JournalEntryListResult>(`/accounting/journal-entries?${params.toString()}`);
}

export function getJournalEntry(id: string) {
  return requestAccounting<JournalEntry>(`/accounting/journal-entries/${id}`);
}

export function createJournalEntry(payload: JournalEntryPayload) {
  return requestAccounting<JournalEntry>("/accounting/journal-entries", { method: "POST", body: payload });
}

export function updateJournalEntry(id: string, payload: JournalEntryPayload) {
  return requestAccounting<JournalEntry>(`/accounting/journal-entries/${id}`, { method: "PATCH", body: payload });
}

export function addJournalEntryLine(id: string, payload: JournalEntryLinePayload) {
  return requestAccounting<JournalEntry>(`/accounting/journal-entries/${id}/lines`, { method: "POST", body: payload });
}

export function updateJournalEntryLine(id: string, lineId: string, payload: JournalEntryLinePayload) {
  return requestAccounting<JournalEntry>(`/accounting/journal-entries/${id}/lines/${lineId}`, {
    method: "PATCH",
    body: payload
  });
}

export function deleteJournalEntryLine(id: string, lineId: string) {
  return requestAccounting<JournalEntry>(`/accounting/journal-entries/${id}/lines/${lineId}`, { method: "DELETE" });
}

export function postJournalEntry(id: string, idempotencyKey: string) {
  return requestAccounting<JournalEntry>(`/accounting/journal-entries/${id}/post`, {
    method: "POST",
    body: { idempotencyKey }
  });
}
