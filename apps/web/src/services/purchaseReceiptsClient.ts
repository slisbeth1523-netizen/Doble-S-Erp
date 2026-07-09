import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";
import type { PurchaseOrder } from "./purchaseOrdersClient.js";

export type PurchaseReceiptStatus = "DRAFT" | "POSTED";

export type PurchaseReceiptLine = {
  id: string;
  purchaseOrderLineId: string;
  itemCode: string;
  itemDescription: string;
  warehouseCode: string;
  quantityReceived: number;
  orderedQuantity: number;
  unitCost: number;
  lineTotal: number;
};

export type PurchaseReceipt = {
  id: string;
  purchaseReceiptNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierName: string;
  inventoryMovementId?: string;
  movementNumber?: string;
  status: PurchaseReceiptStatus;
  receiptDate: string;
  reference?: string;
  postedAt?: string;
  lineCount: number;
  totalQuantityReceived: number;
  totalAmount: number;
  lines: PurchaseReceiptLine[];
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

export function listApprovedPurchaseOrders() {
  return requestPurchasing<PurchaseOrder[]>("/purchasing/purchase-orders?status=APPROVED&page=1&pageSize=25");
}

export function getPurchaseOrder(purchaseOrderId: string) {
  return requestPurchasing<PurchaseOrder>(`/purchasing/purchase-orders/${purchaseOrderId}`);
}

export function loadPurchaseReceiptSnapshots() {
  return Promise.all([
    fetchCatalogItems("purchase-receipts", { page: 1, pageSize: 8, sortBy: "receiptDate", sortDirection: "desc" }),
    fetchCatalogItems("purchase-receipt-lines", { page: 1, pageSize: 8, sortBy: "purchaseReceiptNumber", sortDirection: "desc" })
  ]).then(([receipts, lines]) => ({ receipts: receipts.items, lines: lines.items }));
}

export function createPurchaseReceipt(payload: {
  purchaseOrderId: string;
  receiptDate?: string | null;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestPurchasing<PurchaseReceipt>("/purchasing/purchase-receipts", {
    method: "POST",
    body: payload
  });
}

export function addPurchaseReceiptLine(
  purchaseReceiptId: string,
  payload: {
    purchaseOrderLineId: string;
    quantityReceived: number;
    unitCost?: number;
    notes?: string | null;
  }
) {
  return requestPurchasing<PurchaseReceipt>(`/purchasing/purchase-receipts/${purchaseReceiptId}/lines`, {
    method: "POST",
    body: payload
  });
}

export function completePurchaseReceipt(purchaseReceiptId: string) {
  return requestPurchasing<PurchaseReceipt>(`/purchasing/purchase-receipts/${purchaseReceiptId}/complete`, {
    method: "POST"
  });
}

export function recordNumber(record: CatalogRecord, field: string) {
  return Number(record[field] ?? 0);
}
