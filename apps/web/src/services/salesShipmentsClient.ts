import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";
import { listApprovedSalesOrders, type InventoryReservation } from "./inventoryReservationsClient.js";
import { listSalesOrders, type SalesOrder } from "./salesOrdersClient.js";

export type SalesShipmentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SalesShipmentLine = {
  id: string;
  salesShipmentId: string;
  salesOrderLineId: string;
  inventoryReservationId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  quantity: number;
  notes?: string;
};

export type SalesShipment = {
  id: string;
  shipmentNumber: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  shipmentDate: string;
  status: SalesShipmentStatus;
  warehouseCode?: string;
  reference?: string;
  notes?: string;
  inventoryMovementId?: string;
  movementNumber?: string;
  postedAt?: string;
  lineCount: number;
  totalQuantity: number;
  lines: SalesShipmentLine[];
};

export type SalesOrderShipmentLine = {
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
  previouslyShippedQuantity: number;
  pendingShipmentQuantity: number;
  activeReservationQuantity: number;
};

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
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

export function listSalesShipments(params: { search?: string; status?: string; salesOrderId?: string; page?: number; pageSize?: number } = {}) {
  return requestApi<{ records: SalesShipment[]; pagination: { totalItems: number } }>(
    `/sales/shipments${queryString(params)}`
  );
}

export function createSalesShipment(payload: { salesOrderId: string; reference?: string | null; notes?: string | null }) {
  return requestApi<SalesShipment>("/sales/shipments", { method: "POST", body: payload });
}

export function addSalesShipmentLine(
  shipmentId: string,
  payload: { salesOrderLineId: string; inventoryReservationId: string; quantity: number; notes?: string | null }
) {
  return requestApi<SalesShipment>(`/sales/shipments/${shipmentId}/lines`, { method: "POST", body: payload });
}

export function postSalesShipment(shipmentId: string, idempotencyKey: string) {
  return requestApi<SalesShipment>(`/sales/shipments/${shipmentId}/post`, {
    method: "POST",
    body: { idempotencyKey }
  });
}

export function getSalesOrderShipmentLines(orderId: string) {
  return requestApi<SalesOrderShipmentLine[]>(`/sales/shipments/orders/${orderId}/lines`);
}

export function listActiveReservations(orderId?: string) {
  const params = { orderId, page: 1, pageSize: 50 };
  return requestApi<{ records: InventoryReservation[]; pagination: { totalItems: number } }>(
    `/inventory/reservations${queryString(params)}`
  ).then((result) => result.records.filter((reservation) => reservation.activeQuantity > 0));
}

export function listApprovedOrdersForShipments(): Promise<SalesOrder[]> {
  return listApprovedSalesOrders().catch(() => listSalesOrders({ status: "APPROVED", page: 1, pageSize: 25 }).then((result) => result.records));
}

export function orderLabel(order: SalesOrder) {
  return `${order.orderNumber} - ${order.customerName}`;
}
