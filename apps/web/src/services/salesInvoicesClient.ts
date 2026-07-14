import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";
import { listSalesOrders, type SalesOrder } from "./salesOrdersClient.js";

export type SalesInvoiceStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SalesInvoiceLine = {
  id: string;
  salesInvoiceId: string;
  salesOrderLineId: string;
  salesShipmentId: string;
  shipmentNumber: string;
  salesShipmentLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureCode: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  notes?: string;
};

export type SalesInvoice = {
  id: string;
  invoiceNumber: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  currencyCode: string;
  exchangeRate: number;
  status: SalesInvoiceStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  accountsReceivableDocumentId?: string;
  accountsReceivableDocumentNumber?: string;
  reference?: string;
  notes?: string;
  postedAt?: string;
  lineCount: number;
  totalQuantity: number;
  lines: SalesInvoiceLine[];
};

export type SalesInvoicePendingLine = {
  salesShipmentInvoiceId: string;
  salesShipmentId: string;
  shipmentNumber: string;
  shipmentStatus: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  currencyCode: string;
  exchangeRate: number;
  salesOrderLineId: string;
  salesShipmentLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureCode: string;
  shippedQuantity: number;
  previouslyInvoicedQuantity: number;
  pendingInvoiceQuantity: number;
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

export function listSalesInvoices(params: { search?: string; status?: string; salesOrderId?: string; page?: number; pageSize?: number } = {}) {
  return requestApi<{ records: SalesInvoice[]; pagination: { totalItems: number } }>(
    `/sales/invoices${queryString(params)}`
  );
}

export function listOrdersForInvoices(): Promise<SalesOrder[]> {
  return listSalesOrders({ status: "CLOSED", page: 1, pageSize: 25 })
    .then((result) => result.records)
    .catch(() => listSalesOrders({ status: "APPROVED", page: 1, pageSize: 25 }).then((result) => result.records));
}

export function getSalesOrderInvoicePendingLines(orderId: string) {
  return requestApi<SalesInvoicePendingLine[]>(`/sales/orders/${orderId}/invoice-pending-lines`);
}

export function createSalesInvoice(payload: { salesOrderId: string; dueDate: string; invoiceDate?: string; reference?: string | null; notes?: string | null }) {
  return requestApi<SalesInvoice>("/sales/invoices", { method: "POST", body: payload });
}

export function addSalesInvoiceLine(invoiceId: string, payload: { salesShipmentLineId: string; quantity: number; notes?: string | null }) {
  return requestApi<SalesInvoice>(`/sales/invoices/${invoiceId}/lines`, { method: "POST", body: payload });
}

export function postSalesInvoice(invoiceId: string, idempotencyKey: string) {
  return requestApi<SalesInvoice>(`/sales/invoices/${invoiceId}/post`, {
    method: "POST",
    body: { idempotencyKey }
  });
}

export function orderLabel(order: SalesOrder) {
  return `${order.orderNumber} - ${order.customerName}`;
}
