import type { ApiResponse } from "@doble-s-erp/shared";

import { fetchCatalogItems, fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { apiFetch } from "./apiClient.js";

export type SalesQuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONVERTED";

export type SalesQuotationLine = {
  id: string;
  salesQuotationId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  unitOfMeasureName: string;
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
};

export type SalesQuotation = {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  quotationDate: string;
  validUntil: string;
  currencyCode: string;
  exchangeRate: number;
  status: SalesQuotationStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineCount: number;
  reference?: string;
  notes?: string;
  lines: SalesQuotationLine[];
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

export function loadSalesQuotationOptions() {
  return Promise.all([
    fetchCatalogLookup("customers", { search: "CLI", pageSize: 25 }),
    fetchCatalogLookup("items", { search: "ART", pageSize: 25 }),
    fetchCatalogLookup("units-of-measure", { search: "UND", pageSize: 25 })
  ]).then(([customers, items, units]) => ({ customers, items, units }));
}

export function loadSalesQuotationSnapshots() {
  return Promise.all([
    fetchCatalogItems("sales-quotations", { page: 1, pageSize: 8, sortBy: "quotationDate", sortDirection: "desc" }),
    fetchCatalogItems("sales-quotation-lines", { page: 1, pageSize: 8, sortBy: "quotationNumber", sortDirection: "desc" })
  ]).then(([quotations, lines]) => ({ quotations: quotations.items, lines: lines.items }));
}

export function listSalesQuotations(params: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  return requestSales<{ records: SalesQuotation[]; pagination: { totalItems: number } }>(
    `/sales/quotations${queryString(params)}`
  );
}

export function getSalesQuotation(id: string) {
  return requestSales<SalesQuotation>(`/sales/quotations/${id}`);
}

export function createSalesQuotation(payload: {
  customerId: string;
  quotationDate?: string;
  validUntil: string;
  currencyCode: string;
  exchangeRate?: number;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestSales<SalesQuotation>("/sales/quotations", {
    method: "POST",
    body: payload
  });
}

export function updateSalesQuotation(id: string, payload: Partial<{
  customerId: string;
  quotationDate: string;
  validUntil: string;
  currencyCode: string;
  exchangeRate: number;
  reference: string | null;
  notes: string | null;
}>) {
  return requestSales<SalesQuotation>(`/sales/quotations/${id}`, {
    method: "PATCH",
    body: payload
  });
}

export function addSalesQuotationLine(id: string, payload: {
  itemId: string;
  unitOfMeasureId: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxPercent?: number;
  notes?: string | null;
}) {
  return requestSales<SalesQuotation>(`/sales/quotations/${id}/lines`, {
    method: "POST",
    body: payload
  });
}

export function updateSalesQuotationLine(quotationId: string, lineId: string, payload: Partial<{
  itemId: string;
  unitOfMeasureId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  notes: string | null;
}>) {
  return requestSales<SalesQuotation>(`/sales/quotations/${quotationId}/lines/${lineId}`, {
    method: "PATCH",
    body: payload
  });
}

export function deleteSalesQuotationLine(quotationId: string, lineId: string) {
  return requestSales<SalesQuotation>(`/sales/quotations/${quotationId}/lines/${lineId}`, {
    method: "DELETE"
  });
}

export function transitionSalesQuotation(id: string, action: "send" | "approve" | "reject" | "expire") {
  return requestSales<SalesQuotation>(`/sales/quotations/${id}/${action}`, {
    method: "POST"
  });
}

export function optionLabel(options: LookupOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function recordNumber(record: CatalogRecord, field: string) {
  return Number(record[field] ?? 0);
}
