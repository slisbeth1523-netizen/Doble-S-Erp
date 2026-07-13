import type { ApiResponse } from "@doble-s-erp/shared";
import { fetchCatalogItems } from "../modules/runtime-ui/services/metadataClient.js";
import { apiFetch } from "./apiClient.js";

export type CustomerReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type AccountsReceivableDocumentStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";

export type CustomerReceiptApplication = {
  id: string;
  customerReceiptId: string;
  lineNumber: number;
  accountsReceivableDocumentId: string;
  documentNumber: string;
  sourceDocumentNumber?: string;
  documentStatus: AccountsReceivableDocumentStatus;
  documentTotalAmount: number;
  documentPaidAmount: number;
  documentRemainingAmount: number;
  appliedAmount: number;
  notes?: string;
};

export type CustomerReceipt = {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  receiptDate: string;
  status: CustomerReceiptStatus;
  receiptMethod: string;
  totalAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  reference?: string;
  notes?: string;
  postedAt?: string;
  applications: CustomerReceiptApplication[];
};

export type AccountsReceivableDocument = {
  id: string;
  documentNumber: string;
  sourceType: string;
  sourceDocumentNumber?: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  documentDate: string;
  dueDate: string;
  status: AccountsReceivableDocumentStatus;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  reference?: string;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestAR<T>(path: string, options: RequestOptions = {}) {
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

export function listCustomerReceipts(query: { customerId?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.customerId) params.append("customerId", query.customerId);
  if (query.status) params.append("status", query.status);
  if (query.page) params.append("page", String(query.page));
  if (query.pageSize) params.append("pageSize", String(query.pageSize));

  const suffix = params.toString();
  return requestAR<CustomerReceipt[]>(`/accounts-receivable/receipts${suffix ? `?${suffix}` : ""}`);
}

export function getCustomerReceipt(id: string) {
  return requestAR<CustomerReceipt>(`/accounts-receivable/receipts/${id}`);
}

export function createCustomerReceipt(payload: {
  customerId: string;
  totalAmount: number;
  receiptDate?: string;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestAR<CustomerReceipt>("/accounts-receivable/receipts", {
    method: "POST",
    body: payload
  });
}

export function applyCustomerReceipt(
  receiptId: string,
  payload: {
    accountsReceivableDocumentId: string;
    appliedAmount: number;
    notes?: string | null;
  }
) {
  return requestAR<CustomerReceipt>(`/accounts-receivable/receipts/${receiptId}/applications`, {
    method: "POST",
    body: payload
  });
}

export function postCustomerReceipt(receiptId: string) {
  return requestAR<CustomerReceipt>(`/accounts-receivable/receipts/${receiptId}/post`, {
    method: "POST"
  });
}

export async function listOpenReceivableDocuments(customerId: string) {
  const params = new URLSearchParams({
    customerId,
    page: "1",
    pageSize: "100"
  });
  const data = await requestAR<{ records: AccountsReceivableDocument[] }>(`/accounts-receivable/documents?${params}`);
  return data.records.filter((document) => ["OPEN", "PARTIALLY_PAID"].includes(document.status));
}

export function listCustomers() {
  return fetchCatalogItems("customers", { page: 1, pageSize: 100, sortBy: "name", sortDirection: "asc" }).then(
    (res) => res.items
  );
}
