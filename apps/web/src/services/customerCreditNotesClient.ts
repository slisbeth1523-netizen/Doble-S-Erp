import type { ApiResponse } from "@doble-s-erp/shared";
import {
  listCustomers,
  listOpenReceivableDocuments,
  type AccountsReceivableDocument,
  type AccountsReceivableDocumentStatus
} from "./customerReceiptsClient.js";
import { apiFetch } from "./apiClient.js";

export type CustomerCreditNoteStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type CustomerCreditNoteApplication = {
  id: string;
  customerCreditNoteId: string;
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

export type CustomerCreditNote = {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  creditNoteDate: string;
  status: CustomerCreditNoteStatus;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  reference?: string;
  notes?: string;
  postedAt?: string;
  applications: CustomerCreditNoteApplication[];
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

export function listCustomerCreditNotes(
  query: { customerId?: string; status?: string; page?: number; pageSize?: number } = {}
) {
  const params = new URLSearchParams();
  if (query.customerId) params.append("customerId", query.customerId);
  if (query.status) params.append("status", query.status);
  if (query.page) params.append("page", String(query.page));
  if (query.pageSize) params.append("pageSize", String(query.pageSize));

  const suffix = params.toString();
  return requestAR<CustomerCreditNote[]>(`/accounts-receivable/customer-credit-notes${suffix ? `?${suffix}` : ""}`);
}

export function getCustomerCreditNote(id: string) {
  return requestAR<CustomerCreditNote>(`/accounts-receivable/customer-credit-notes/${id}`);
}

export function createCustomerCreditNote(payload: {
  customerId: string;
  amount: number;
  creditNoteDate?: string;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestAR<CustomerCreditNote>("/accounts-receivable/customer-credit-notes", {
    method: "POST",
    body: payload
  });
}

export function applyCustomerCreditNote(
  creditNoteId: string,
  payload: {
    accountsReceivableDocumentId: string;
    appliedAmount: number;
    notes?: string | null;
  }
) {
  return requestAR<CustomerCreditNote>(`/accounts-receivable/customer-credit-notes/${creditNoteId}/applications`, {
    method: "POST",
    body: payload
  });
}

export function postCustomerCreditNote(creditNoteId: string) {
  return requestAR<CustomerCreditNote>(`/accounts-receivable/customer-credit-notes/${creditNoteId}/post`, {
    method: "POST"
  });
}

export { listCustomers, listOpenReceivableDocuments };
export type { AccountsReceivableDocument };
