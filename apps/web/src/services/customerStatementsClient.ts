import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";

export type CustomerStatementDetail = {
  id: string;
  accountsReceivableDocumentId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  documentNumber: string;
  sourceDocumentNumber?: string;
  sourceType: string;
  documentDate: string;
  dueDate: string;
  currencyCode: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysPastDue: number;
  agingBucket: string;
  reference?: string;
};

export type CustomerAgingSummary = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
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

export type CustomerStatementResponse = {
  asOfDate: string;
  records: CustomerStatementDetail[];
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    overdueAmount: number;
    notDueAmount: number;
    documentCount: number;
    openDocumentCount: number;
  };
};

export type CustomerAgingResponse = {
  asOfDate: string;
  records: CustomerAgingSummary[];
  summary: Omit<CustomerAgingSummary, "id" | "customerId" | "customerCode" | "customerName">;
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

async function requestAccountsReceivable<T>(path: string) {
  const response = await apiFetch(path);
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    const message = body?.error?.message ?? `La API respondio con estado ${response.status}.`;
    throw new Error(message);
  }

  return body.data;
}

export function loadCustomerStatements(query: Query = {}) {
  return requestAccountsReceivable<CustomerStatementResponse>(`/accounts-receivable/statements${queryString(query)}`);
}

export function loadCustomerAging(query: Query = {}) {
  return requestAccountsReceivable<CustomerAgingResponse>(`/accounts-receivable/aging${queryString(query)}`);
}
