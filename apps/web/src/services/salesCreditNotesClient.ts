import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type SalesCreditNoteStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SalesCreditableReturn = {
  id: string;
  salesReturnId: string;
  returnNumber: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  accountsReceivableDocumentId: string;
  accountsReceivableDocumentNumber: string;
  accountsReceivableStatus: string;
  accountsReceivableRemainingAmount: number;
  customerId: string;
  customerCode: string;
  customerName: string;
  returnedQuantity: number;
  returnedAmount: number;
  reservedCreditAmount: number;
  postedCreditAmount: number;
  pendingCreditAmount: number;
  creditNoteCount: number;
};

export type SalesCreditNote = {
  id: string;
  customerCreditNoteId: string;
  creditNoteNumber: string;
  salesReturnId: string;
  returnNumber: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  accountsReceivableDocumentId: string;
  accountsReceivableDocumentNumber: string;
  accountsReceivableStatus: string;
  accountsReceivableTotalAmount: number;
  accountsReceivablePaidAmount: number;
  accountsReceivableRemainingAmount: number;
  customerId: string;
  customerCode: string;
  customerName: string;
  creditNoteDate: string;
  status: SalesCreditNoteStatus;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  reference?: string;
  notes?: string;
  postedAt?: string;
};

type Paged<T> = {
  records: T[];
  pagination: { totalItems: number; page?: number; pageSize?: number };
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestApi<T>(path: string, options: RequestOptions = {}) {
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

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.append(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `?${suffix}` : "";
}

export function listCreditableSalesReturns(params: { search?: string; page?: number; pageSize?: number } = {}) {
  return requestApi<Paged<SalesCreditableReturn>>(`/sales/credit-notes/creditable-returns${queryString(params)}`);
}

export function listSalesCreditNotes(params: { search?: string; status?: string; page?: number; pageSize?: number } = {}) {
  return requestApi<Paged<SalesCreditNote>>(`/sales/credit-notes${queryString(params)}`);
}

export function createSalesCreditNoteFromReturn(payload: {
  salesReturnId: string;
  amount?: number;
  creditNoteDate?: string;
  reference?: string | null;
  notes?: string | null;
  idempotencyKey: string;
}) {
  return requestApi<SalesCreditNote>("/sales/credit-notes/from-return", { method: "POST", body: payload });
}

export function postSalesCreditNote(customerCreditNoteId: string, idempotencyKey: string) {
  return requestApi<SalesCreditNote>(`/sales/credit-notes/${customerCreditNoteId}/post`, {
    method: "POST",
    body: { idempotencyKey }
  });
}
