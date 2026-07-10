import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems, fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type SupplierAdjustmentType = "CREDIT_NOTE" | "DEBIT_NOTE";
export type SupplierAdjustmentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SupplierAdjustmentApplication = {
  id: string;
  supplierAdjustmentId: string;
  lineNumber: number;
  accountsPayableDocumentId: string;
  documentNumber: string;
  documentStatus: "OPEN" | "PARTIALLY_PAID" | "PAID";
  documentRemainingAmount: number;
  appliedAmount: number;
};

export type SupplierAdjustment = {
  id: string;
  adjustmentNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  adjustmentType: SupplierAdjustmentType;
  adjustmentDate: string;
  status: SupplierAdjustmentStatus;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  generatedAccountsPayableDocumentId?: string;
  generatedDocumentNumber?: string;
  reference?: string;
  notes?: string;
  postedAt?: string;
  applications: SupplierAdjustmentApplication[];
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestAccountsPayable<T>(path: string, options: RequestOptions = {}) {
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

export function loadSupplierAdjustmentOptions() {
  return Promise.all([
    fetchCatalogLookup("suppliers", { page: 1, pageSize: 50 }),
    fetchCatalogItems("accounts-payable-documents", { page: 1, pageSize: 100, sortBy: "documentDate", sortDirection: "desc" }),
    fetchCatalogItems("supplier-adjustments", { page: 1, pageSize: 12, sortBy: "adjustmentDate", sortDirection: "desc" })
  ]).then(([suppliers, documents, adjustments]) => ({
    suppliers,
    documents: documents.items,
    adjustments: adjustments.items
  }));
}

export function openDocumentsForSupplier(documents: CatalogRecord[], supplier: LookupOption | null) {
  if (!supplier) return [];

  return documents.filter((document) => {
    const status = String(document.status ?? "");
    const supplierId = String(document.supplierId ?? "");
    const supplierName = String(document.name ?? document.supplierName ?? "");

    return ["OPEN", "PARTIALLY_PAID"].includes(status) && (supplierId === supplier.value || supplierName === supplier.label);
  });
}

export function createSupplierAdjustment(payload: {
  supplierId: string;
  adjustmentType: SupplierAdjustmentType;
  adjustmentDate?: string | null;
  amount: number;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestAccountsPayable<SupplierAdjustment>("/accounts-payable/adjustments", {
    method: "POST",
    body: payload
  });
}

export function addSupplierAdjustmentApplication(
  supplierAdjustmentId: string,
  payload: { accountsPayableDocumentId: string; appliedAmount: number; notes?: string | null }
) {
  return requestAccountsPayable<SupplierAdjustment>(`/accounts-payable/adjustments/${supplierAdjustmentId}/applications`, {
    method: "POST",
    body: payload
  });
}

export function postSupplierAdjustment(supplierAdjustmentId: string) {
  return requestAccountsPayable<SupplierAdjustment>(`/accounts-payable/adjustments/${supplierAdjustmentId}/post`, {
    method: "POST"
  });
}
