import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";

export type SalesReturnStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SalesReturnLine = {
  id: string;
  lineNumber: number;
  salesShipmentLineId: string;
  salesInvoiceLineId?: string;
  itemCode: string;
  itemDescription: string;
  warehouseCode: string;
  unitOfMeasureCode: string;
  quantity: number;
  reason?: string;
  notes?: string;
};

export type SalesReturn = {
  id: string;
  returnNumber: string;
  salesOrderId: string;
  orderNumber: string;
  salesShipmentId: string;
  shipmentNumber: string;
  salesInvoiceId?: string;
  invoiceNumber?: string;
  customerName: string;
  returnDate: string;
  status: SalesReturnStatus;
  movementNumber?: string;
  inventoryMovementId?: string;
  reason?: string;
  totalQuantity: number;
  lineCount: number;
  lines: SalesReturnLine[];
  idempotencyReplayed?: boolean;
};

export type SalesReturnableLine = {
  salesShipmentLineId: string;
  salesShipmentId: string;
  shipmentNumber: string;
  salesOrderId: string;
  orderNumber: string;
  customerName: string;
  salesInvoiceId?: string;
  invoiceNumber?: string;
  salesInvoiceLineId?: string;
  salesOrderLineId: string;
  lineNumber: number;
  itemCode: string;
  itemDescription: string;
  warehouseCode: string;
  unitOfMeasureCode: string;
  shippedQuantity: number;
  previouslyReturnedQuantity: number;
  returnableQuantity: number;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

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

export function listSalesReturns(params: { search?: string; status?: string; page?: number; pageSize?: number } = {}) {
  return requestApi<{ records: SalesReturn[]; pagination: { totalItems: number } }>(
    `/sales/returns${queryString(params)}`
  );
}

export function createSalesReturn(payload: {
  salesShipmentId: string;
  salesInvoiceId?: string | null;
  reason?: string | null;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestApi<SalesReturn>("/sales/returns", { method: "POST", body: payload });
}

export function getShipmentReturnableLines(shipmentId: string) {
  return requestApi<SalesReturnableLine[]>(`/sales/shipments/${shipmentId}/returnable-lines`);
}

export function addSalesReturnLine(returnId: string, payload: {
  salesShipmentLineId: string;
  salesInvoiceLineId?: string | null;
  quantity: number;
  reason?: string | null;
  notes?: string | null;
}) {
  return requestApi<SalesReturn>(`/sales/returns/${returnId}/lines`, { method: "POST", body: payload });
}

export function updateSalesReturnLine(returnId: string, lineId: string, payload: { quantity?: number; reason?: string | null; notes?: string | null }) {
  return requestApi<SalesReturn>(`/sales/returns/${returnId}/lines/${lineId}`, { method: "PATCH", body: payload });
}

export function deleteSalesReturnLine(returnId: string, lineId: string) {
  return requestApi<SalesReturn>(`/sales/returns/${returnId}/lines/${lineId}`, { method: "DELETE" });
}

export function postSalesReturn(returnId: string, idempotencyKey: string) {
  return requestApi<SalesReturn>(`/sales/returns/${returnId}/post`, {
    method: "POST",
    body: { idempotencyKey }
  });
}
