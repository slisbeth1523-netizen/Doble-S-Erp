import type { ApiResponse } from "@doble-s-erp/shared";
import { fetchCatalogItems } from "../modules/runtime-ui/services/metadataClient.js";
import { apiFetch } from "./apiClient.js";

export type SupplierPaymentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SupplierPaymentApplication = {
  SupplierPaymentApplicationId: string;
  SupplierPaymentId: string;
  AccountsPayableDocumentId: string;
  DocumentNumber: string;
  SourceDocumentNumber: string;
  AppliedAmount: number;
  Notes?: string;
  CreatedAt: string;
};

export type SupplierPayment = {
  SupplierPaymentId: string;
  PaymentNumber: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  PaymentDate: string;
  TotalAmount: number;
  AppliedAmountTotal: number;
  Status: SupplierPaymentStatus;
  Reference?: string;
  Notes?: string;
  PostedAt?: string;
  PostedBy?: string;
  IsActive: boolean;
  CreatedAt: string;
  applications?: SupplierPaymentApplication[];
};

export type AccountsPayableDocument = {
  AccountsPayableDocumentId: string;
  DocumentNumber: string;
  SupplierId: string;
  SourceModule: string;
  SourceDocumentId: string;
  SourceDocumentNumber: string;
  DocumentDate: string;
  DueDate: string;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
  Status: string;
  Notes?: string;
};

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
};

async function requestAP<T>(path: string, options: RequestOptions = {}) {
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

export function listSupplierPayments(query: { search?: string; status?: string; page?: number; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.search) params.append("search", query.search);
  if (query.status) params.append("status", query.status);
  if (query.page) params.append("page", String(query.page));
  if (query.pageSize) params.append("pageSize", String(query.pageSize));

  const url = `/accounts-payable/payments?${params.toString()}`;
  return requestAP<SupplierPayment[]>(url);
}

export function getSupplierPayment(id: string) {
  return requestAP<SupplierPayment & { applications: SupplierPaymentApplication[] }>(`/accounts-payable/payments/${id}`);
}

export function createSupplierPayment(payload: {
  supplierId: string;
  totalAmount: number;
  paymentDate?: string;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestAP<SupplierPayment>("/accounts-payable/payments", {
    method: "POST",
    body: payload
  });
}

export function applyPayment(
  paymentId: string,
  payload: {
    accountsPayableDocumentId: string;
    appliedAmount: number;
    notes?: string | null;
  }
) {
  return requestAP<SupplierPayment & { applications: SupplierPaymentApplication[] }>(
    `/accounts-payable/payments/${paymentId}/applications`,
    {
      method: "POST",
      body: payload
    }
  );
}

export function removeApplication(paymentId: string, docId: string) {
  return requestAP<SupplierPayment & { applications: SupplierPaymentApplication[] }>(
    `/accounts-payable/payments/${paymentId}/applications/${docId}`,
    {
      method: "DELETE"
    }
  );
}

export function postPayment(paymentId: string) {
  return requestAP<SupplierPayment>(`/accounts-payable/payments/${paymentId}/post`, {
    method: "POST"
  });
}

export function listOpenDocuments(supplierId: string) {
  return requestAP<AccountsPayableDocument[]>(`/accounts-payable/open-documents?supplierId=${supplierId}`);
}

export function listSuppliers() {
  return fetchCatalogItems("suppliers", { page: 1, pageSize: 100, sortBy: "name", sortDirection: "asc" })
    .then((res) => res.items);
}
