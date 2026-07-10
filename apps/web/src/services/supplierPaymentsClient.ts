import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems, fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type SupplierPaymentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SupplierPaymentApplication = {
  id: string;
  supplierPaymentId: string;
  lineNumber: number;
  accountsPayableDocumentId: string;
  documentNumber: string;
  sourceDocumentNumber?: string;
  documentStatus: "OPEN" | "PARTIALLY_PAID" | "PAID";
  documentTotalAmount: number;
  documentPaidAmount: number;
  documentRemainingAmount: number;
  appliedAmount: number;
  notes?: string;
};

export type SupplierPayment = {
  id: string;
  paymentNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  paymentDate: string;
  status: SupplierPaymentStatus;
  paymentMethod: string;
  totalAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  reference?: string;
  notes?: string;
  postedAt?: string;
  applications: SupplierPaymentApplication[];
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestAccountsPayable<T>(path: string, options: RequestOptions = {}) {
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

export function loadSupplierPaymentOptions() {
  return Promise.all([
    fetchCatalogLookup("suppliers", { page: 1, pageSize: 50 }),
    fetchCatalogItems("accounts-payable-documents", { page: 1, pageSize: 100, sortBy: "documentDate", sortDirection: "desc" }),
    fetchCatalogItems("supplier-payments", { page: 1, pageSize: 12, sortBy: "paymentDate", sortDirection: "desc" })
  ]).then(([suppliers, documents, payments]) => ({
    suppliers,
    documents: documents.items,
    payments: payments.items
  }));
}

export function openDocumentsForSupplier(documents: CatalogRecord[], supplier: LookupOption | null) {
  if (!supplier) {
    return [];
  }

  return documents.filter((document) => {
    const status = String(document.status ?? "");
    const supplierId = String(document.supplierId ?? "");
    const supplierName = String(document.name ?? document.supplierName ?? "");

    return (
      ["OPEN", "PARTIALLY_PAID"].includes(status) &&
      (supplierId === supplier.value || supplierName === supplier.label)
    );
  });
}

export function createSupplierPayment(payload: {
  supplierId: string;
  paymentDate?: string | null;
  totalAmount: number;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestAccountsPayable<SupplierPayment>("/accounts-payable/payments", {
    method: "POST",
    body: payload
  });
}

export function addSupplierPaymentApplication(
  supplierPaymentId: string,
  payload: {
    accountsPayableDocumentId: string;
    appliedAmount: number;
    notes?: string | null;
  }
) {
  return requestAccountsPayable<SupplierPayment>(`/accounts-payable/payments/${supplierPaymentId}/applications`, {
    method: "POST",
    body: payload
  });
}

export function postSupplierPayment(supplierPaymentId: string) {
  return requestAccountsPayable<SupplierPayment>(`/accounts-payable/payments/${supplierPaymentId}/post`, {
    method: "POST"
  });
}
