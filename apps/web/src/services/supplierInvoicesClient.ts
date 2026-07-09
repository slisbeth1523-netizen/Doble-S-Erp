import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type SupplierInvoiceStatus = "DRAFT" | "POSTED";

export type SupplierInvoiceLine = {
  id: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  quantity: number;
  unitCost: number;
  taxAmount: number;
  lineTotal: number;
  notes?: string;
};

export type SupplierInvoice = {
  id: string;
  supplierInvoiceNumber: string;
  purchaseReceiptId: string;
  purchaseReceiptNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  status: SupplierInvoiceStatus;
  invoiceDate: string;
  dueDate: string;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  reference?: string;
  notes?: string;
  postedAt?: string;
  lineCount: number;
  lines: SupplierInvoiceLine[];
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestPurchasing<T>(path: string, options: RequestOptions = {}) {
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

export function listPostedPurchaseReceipts() {
  return fetchCatalogItems("purchase-receipts", {
    page: 1,
    pageSize: 50,
    sortBy: "receiptDate",
    sortDirection: "desc"
  }).then((res) => res.items.filter((item) => item.status === "POSTED"));
}

export function loadSupplierInvoiceSnapshots() {
  return Promise.all([
    fetchCatalogItems("supplier-invoices", { page: 1, pageSize: 8, sortBy: "invoiceDate", sortDirection: "desc" }),
    fetchCatalogItems("supplier-invoice-lines", { page: 1, pageSize: 8, sortBy: "supplierInvoiceNumber", sortDirection: "desc" })
  ]).then(([invoices, lines]) => ({ invoices: invoices.items, lines: lines.items }));
}

export function loadAccountsPayableSnapshots() {
  return fetchCatalogItems("accounts-payable-documents", { page: 1, pageSize: 25, sortBy: "documentDate", sortDirection: "desc" })
    .then((res) => res.items);
}

export function createSupplierInvoice(payload: {
  purchaseReceiptId: string;
  supplierInvoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestPurchasing<SupplierInvoice>("/purchasing/supplier-invoices", {
    method: "POST",
    body: payload
  });
}

export function addSupplierInvoiceLine(
  supplierInvoiceId: string,
  payload: {
    itemId: string;
    unitOfMeasureId?: string | null;
    quantity: number;
    unitCost: number;
    taxAmount?: number;
    notes?: string | null;
  }
) {
  return requestPurchasing<SupplierInvoice>(`/purchasing/supplier-invoices/${supplierInvoiceId}/lines`, {
    method: "POST",
    body: payload
  });
}

export function completeSupplierInvoice(supplierInvoiceId: string) {
  return requestPurchasing<SupplierInvoice>(`/purchasing/supplier-invoices/${supplierInvoiceId}/complete`, {
    method: "POST"
  });
}

export function getSupplierInvoice(supplierInvoiceId: string) {
  return requestPurchasing<SupplierInvoice>(`/purchasing/supplier-invoices/${supplierInvoiceId}`);
}
