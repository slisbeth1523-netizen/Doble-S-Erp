import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";
import { listSalesOrders, type SalesOrder } from "./salesOrdersClient.js";

export type InventoryReservationStatus = "ACTIVE" | "PARTIALLY_RELEASED" | "RELEASED" | "CONSUMED" | "CANCELLED";

export type InventoryReservation = {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  salesOrderLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  reservedQuantity: number;
  releasedQuantity: number;
  consumedQuantity: number;
  activeQuantity: number;
  status: InventoryReservationStatus;
  reference?: string;
  notes?: string;
};

export type ItemAvailability = {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export type SalesOrderReservationLine = {
  salesOrderId: string;
  orderNumber: string;
  orderStatus: string;
  salesOrderLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  orderedQuantity: number;
  reservedQuantity: number;
  releasedQuantity: number;
  consumedQuantity: number;
  pendingReservationQuantity: number;
  onHandQuantity: number;
  availableQuantity: number;
};

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

function queryString(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
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

export function listInventoryReservations(params: {
  search?: string;
  status?: string;
  itemId?: string;
  warehouseId?: string;
  orderId?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return requestApi<{ records: InventoryReservation[]; pagination: { totalItems: number } }>(
    `/inventory/reservations${queryString(params)}`
  );
}

export function listItemAvailability(params: { search?: string; itemId?: string; warehouseId?: string; page?: number; pageSize?: number } = {}) {
  return requestApi<{ records: ItemAvailability[]; pagination: { totalItems: number } }>(
    `/inventory/availability${queryString(params)}`
  );
}

export function listApprovedSalesOrders() {
  return listSalesOrders({ status: "APPROVED", page: 1, pageSize: 25 }).then((result) => result.records);
}

export function getSalesOrderReservationLines(orderId: string) {
  return requestApi<SalesOrderReservationLine[]>(`/sales/orders/${orderId}/reservations`);
}

export function reserveSalesOrderLine(
  orderId: string,
  lineId: string,
  payload: { idempotencyKey: string; quantity: number; reference?: string | null; notes?: string | null }
) {
  return requestApi<InventoryReservation>(`/sales/orders/${orderId}/lines/${lineId}/reserve`, {
    method: "POST",
    body: payload
  });
}

export function releaseInventoryReservation(reservationId: string, payload: { idempotencyKey: string; quantity: number; reason?: string | null }) {
  return requestApi<InventoryReservation>(`/inventory/reservations/${reservationId}/release`, {
    method: "POST",
    body: payload
  });
}

export function orderLabel(order: SalesOrder) {
  return `${order.orderNumber} - ${order.customerName}`;
}
