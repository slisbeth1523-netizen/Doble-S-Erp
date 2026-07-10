import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";

export type SupplierStatementDetail = {
  id: string;
  accountsPayableDocumentId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  sourceDocumentNumber: string;
  sourceType: string;
  documentDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysPastDue: number;
  agingBucket: string;
};

export type SupplierAgingSummary = {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  currentAmount: number;
  days1To30Amount: number;
  days31To60Amount: number;
  days61To90Amount: number;
  daysOver90Amount: number;
  totalOpenAmount: number;
  overdueAmount: number;
  notDueAmount: number;
  openDocumentCount: number;
  overdueDocumentCount: number;
};

export type SupplierStatementResponse = {
  asOfDate: string;
  records: SupplierStatementDetail[];
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    overdueAmount: number;
    notDueAmount: number;
    documentCount: number;
  };
};

export type SupplierAgingResponse = {
  asOfDate: string;
  records: SupplierAgingSummary[];
  summary: Omit<SupplierAgingSummary, "id" | "supplierId" | "supplierCode" | "supplierName">;
};

type Query = Record<string, string | number | boolean | undefined | null>;

function queryString(query: Query) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const text = params.toString();
  return text ? `?${text}` : "";
}

async function requestAccountsPayable<T>(path: string) {
  const response = await apiFetch(path);
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    const message = body?.error?.message ?? `La API respondio con estado ${response.status}.`;
    throw new Error(message);
  }

  return body.data;
}

export function loadSupplierStatements(query: Query = {}) {
  return requestAccountsPayable<SupplierStatementResponse>(`/accounts-payable/statements${queryString(query)}`);
}

export function loadSupplierAging(query: Query = {}) {
  return requestAccountsPayable<SupplierAgingResponse>(`/accounts-payable/aging${queryString(query)}`);
}
