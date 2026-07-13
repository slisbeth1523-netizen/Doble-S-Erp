import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems, fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type SalesOrderStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "CLOSED";

export type SalesOrderLine = {
  id: string;
  salesOrderId: string;
  sourceQuotationLineId?: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  unitOfMeasureName: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  notes?: string;
  reservedQuantity?: number;
  pendingReservationQuantity?: number;
  onHandQuantity?: number;
  availableQuantity?: number;
};

export type SalesOrder = {
  id: string;
  orderNumber: string;
  sourceQuotationId?: string;
  sourceQuotationNumber?: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  orderDate: string;
  requestedDeliveryDate?: string;
  currencyCode: string;
  exchangeRate: number;
  status: SalesOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineCount: number;
  reference?: string;
  notes?: string;
  cancellationReason?: string;
  lines: SalesOrderLine[];
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

async function requestSales<T>(path: string, options: RequestOptions = {}) {
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

export function loadSalesOrderOptions() {
  return Promise.all([
    fetchCatalogLookup("customers", { search: "CLI", pageSize: 25 }),
    fetchCatalogLookup("items", { search: "ART", pageSize: 25 }),
    fetchCatalogLookup("units-of-measure", { search: "UND", pageSize: 25 }),
    fetchCatalogLookup("warehouses", { search: "ALM", pageSize: 25 }),
    fetchCatalogItems("sales-quotations", {
      page: 1,
      pageSize: 25,
      sortBy: "quotationDate",
      sortDirection: "desc"
    })
  ]).then(([customers, items, units, warehouses, quotations]) => ({
    customers,
    items,
    units,
    warehouses,
    approvedQuotations: quotations.items.filter((quotation) => quotation.status === "APPROVED")
  }));
}

export function loadSalesOrderSnapshots() {
  return Promise.all([
    fetchCatalogItems("sales-orders", { page: 1, pageSize: 8, sortBy: "orderDate", sortDirection: "desc" }),
    fetchCatalogItems("sales-order-lines", { page: 1, pageSize: 8, sortBy: "orderNumber", sortDirection: "desc" })
  ]).then(([orders, lines]) => ({ orders: orders.items, lines: lines.items }));
}

export function listSalesOrders(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return requestSales<{ records: SalesOrder[]; pagination: { totalItems: number } }>(
    `/sales/orders${queryString(params)}`
  );
}

export function createSalesOrder(payload: {
  customerId: string;
  orderDate?: string;
  requestedDeliveryDate?: string | null;
  currencyCode: string;
  exchangeRate?: number;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestSales<SalesOrder>("/sales/orders", {
    method: "POST",
    body: payload
  });
}

export function createSalesOrderFromQuotation(quotationId: string) {
  return requestSales<SalesOrder>(`/sales/orders/from-quotation/${quotationId}`, {
    method: "POST"
  });
}

export function addSalesOrderLine(id: string, payload: {
  itemId: string;
  unitOfMeasureId: string;
  warehouseId?: string | null;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  notes?: string | null;
}) {
  return requestSales<SalesOrder>(`/sales/orders/${id}/lines`, {
    method: "POST",
    body: payload
  });
}

export function updateSalesOrderLine(orderId: string, lineId: string, payload: Partial<{
  itemId: string;
  unitOfMeasureId: string;
  warehouseId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  notes: string | null;
}>) {
  return requestSales<SalesOrder>(`/sales/orders/${orderId}/lines/${lineId}`, {
    method: "PATCH",
    body: payload
  });
}

export function deleteSalesOrderLine(orderId: string, lineId: string) {
  return requestSales<SalesOrder>(`/sales/orders/${orderId}/lines/${lineId}`, {
    method: "DELETE"
  });
}

export function transitionSalesOrder(id: string, action: "submit" | "approve" | "reject") {
  return requestSales<SalesOrder>(`/sales/orders/${id}/${action}`, {
    method: "POST"
  });
}

export function cancelSalesOrder(id: string, reason: string) {
  return requestSales<SalesOrder>(`/sales/orders/${id}/cancel`, {
    method: "POST",
    body: { reason }
  });
}

export function optionLabel(options: LookupOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function recordNumber(record: CatalogRecord, field: string) {
  return Number(record[field] ?? 0);
}
