import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type AccountsReceivableDocument = {
  id: string;
  documentNumber: string;
  sourceType: "MANUAL" | "OPENING_BALANCE" | "SALES_INVOICE" | "CUSTOMER_DEBIT_NOTE";
  customerId: string;
  customerCode: string;
  customerName: string;
  documentDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: number;
  status: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysPastDue: number;
  reference?: string;
  notes?: string;
};

export type CustomerReceivableBalance = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  totalDocumentAmount: number;
  totalPaidAmount: number;
  totalOpenAmount: number;
  overdueAmount: number;
  notDueAmount: number;
  openDocumentCount: number;
  overdueDocumentCount: number;
  lastDocumentDate?: string;
};

export type DocumentsResponse = {
  records: AccountsReceivableDocument[];
  summary: {
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    overdueAmount: number;
    openDocumentCount: number;
    overdueDocumentCount: number;
  };
};

export type BalancesResponse = {
  records: CustomerReceivableBalance[];
  summary: {
    totalDocumentAmount: number;
    totalPaidAmount: number;
    totalOpenAmount: number;
    overdueAmount: number;
    notDueAmount: number;
    openDocumentCount: number;
    overdueDocumentCount: number;
  };
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

async function request<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}) {
  const response = await apiFetch(path, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    const message = body?.error?.message ?? `La API respondio con estado ${response.status}.`;
    throw new Error(message);
  }

  return body.data;
}

export function loadAccountsReceivableDocuments(query: Query = {}) {
  return request<DocumentsResponse>(`/accounts-receivable/documents${queryString(query)}`);
}

export function loadCustomerReceivableBalances(query: Query = {}) {
  return request<BalancesResponse>(`/accounts-receivable/customer-balances${queryString(query)}`);
}

export function createAccountsReceivableDocument(payload: {
  customerId: string;
  sourceType: "MANUAL" | "OPENING_BALANCE";
  documentDate?: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: number;
  totalAmount: number;
  reference?: string;
  notes?: string;
}) {
  return request<AccountsReceivableDocument>("/accounts-receivable/documents", {
    method: "POST",
    body: payload
  });
}

export function loadAccountsReceivableOptions(): Promise<{ customers: LookupOption[] }> {
  return fetchCatalogLookup("customers", { page: 1, pageSize: 100 }).then((customers) => ({ customers }));
}
