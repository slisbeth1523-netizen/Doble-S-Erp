import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems, fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type PurchaseOrderStatus = "DRAFT" | "APPROVED" | "CANCELLED" | "CLOSED";

export type PurchaseOrder = {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string;
  reference?: string;
  notes?: string;
  approvedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  lineCount: number;
  totalQuantity: number;
  totalAmount: number;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestPurchase<T>(path: string, options: RequestOptions = {}) {
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

export function loadPurchaseOrderOptions() {
  return Promise.all([
    fetchCatalogLookup("suppliers", { search: "SUP", pageSize: 25 }),
    fetchCatalogLookup("items", { search: "ART", pageSize: 25 }),
    fetchCatalogLookup("warehouses", { search: "ALM", pageSize: 25 })
  ]).then(([suppliers, items, warehouses]) => ({ suppliers, items, warehouses }));
}

export function loadPurchaseOrderSnapshots() {
  return Promise.all([
    fetchCatalogItems("purchase-orders", { page: 1, pageSize: 8, sortBy: "orderDate", sortDirection: "desc" }),
    fetchCatalogItems("purchase-order-lines", { page: 1, pageSize: 8, sortBy: "purchaseOrderNumber", sortDirection: "desc" })
  ]).then(([orders, lines]) => ({ orders: orders.items, lines: lines.items }));
}

export function createPurchaseOrder(payload: {
  supplierId: string;
  expectedDate?: string | null;
  reference?: string | null;
  notes?: string | null;
  lines: Array<{
    itemId: string;
    warehouseId: string;
    unitOfMeasureId?: string | null;
    quantity: number;
    unitCost?: number;
    discountAmount?: number;
    taxAmount?: number;
    expectedDate?: string | null;
    notes?: string | null;
  }>;
}) {
  return requestPurchase<PurchaseOrder>("/purchasing/purchase-orders", {
    method: "POST",
    body: payload
  });
}

export function approvePurchaseOrder(purchaseOrderId: string) {
  return requestPurchase<PurchaseOrder>(`/purchasing/purchase-orders/${purchaseOrderId}/approve`, {
    method: "POST"
  });
}

export function cancelPurchaseOrder(purchaseOrderId: string, reason?: string | null) {
  return requestPurchase<PurchaseOrder>(`/purchasing/purchase-orders/${purchaseOrderId}/cancel`, {
    method: "POST",
    body: { reason: reason ?? null }
  });
}

export function optionLabel(options: LookupOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function recordNumber(record: CatalogRecord, field: string) {
  return Number(record[field] ?? 0);
}
