import type { ApiResponse } from "@doble-s-erp/shared";

import { apiFetch } from "./apiClient.js";
import { fetchCatalogItems, fetchCatalogLookup } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";

export type InventoryMovementType = "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";

export type InventoryAdjustment = {
  id: string;
  movementNumber: string;
  movementType: InventoryMovementType;
  status: "DRAFT" | "POSTED";
  movementDate: string;
  lineCount: number;
  totalQuantity: number;
  totalCost: number;
};

export type PhysicalCount = {
  id: string;
  countNumber: string;
  warehouseId: string;
  status: "DRAFT" | "COMPLETED" | "ADJUSTMENT_CREATED";
  countDate: string;
  completedAt?: string;
  adjustmentMovementId?: string;
  lineCount: number;
  totalSnapshotQuantity: number;
  totalCountedQuantity: number;
  totalDifferenceQuantity: number;
};

export type PhysicalCountLine = {
  id: string;
  physicalCountId: string;
  lineNumber: number;
  itemId: string;
  warehouseId: string;
  unitOfMeasureId?: string;
  snapshotQuantity: number;
  countedQuantity: number;
  differenceQuantity: number;
  unitCost: number;
};

export type PhysicalCountAdjustmentResult = {
  physicalCount: PhysicalCount;
  adjustment: InventoryAdjustment;
};

type RequestOptions = {
  method?: "POST";
  body?: unknown;
};

async function requestInventory<T>(path: string, options: RequestOptions = {}) {
  const response = await apiFetch(path, {
    method: options.method ?? "POST",
    headers: {
      "content-type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    const message =
      body?.error?.message ?? `La API respondio con estado ${response.status}.`;
    throw new Error(message);
  }

  return body.data;
}

export function loadInventoryOptions() {
  return Promise.all([
    fetchCatalogLookup("items", { search: "ART", pageSize: 25 }),
    fetchCatalogLookup("warehouses", { search: "ALM", pageSize: 25 })
  ]).then(([items, warehouses]) => ({ items, warehouses }));
}

export function loadInventorySnapshots() {
  return Promise.all([
    fetchCatalogItems("inventory-stocks", { search: "ART", page: 1, pageSize: 8 }),
    fetchCatalogItems("inventory-movements", { page: 1, pageSize: 8, sortBy: "movementDate", sortDirection: "desc" })
  ]).then(([stocks, movements]) => ({ stocks: stocks.items, movements: movements.items }));
}

export function createInventoryAdjustment(payload: {
  movementType: InventoryMovementType;
  reference?: string | null;
  notes?: string | null;
  lines: Array<{
    itemId: string;
    warehouseId: string;
    quantity: number;
    unitCost?: number;
    notes?: string | null;
  }>;
}) {
  return requestInventory<InventoryAdjustment>("/inventory/adjustments", { body: payload });
}

export function postInventoryMovement(movementId: string) {
  return requestInventory<InventoryAdjustment>(`/inventory/movements/${movementId}/post`);
}

export function createPhysicalCount(payload: {
  warehouseId: string;
  reference?: string | null;
  notes?: string | null;
}) {
  return requestInventory<PhysicalCount>("/inventory/physical-counts", { body: payload });
}

export function addPhysicalCountLine(
  physicalCountId: string,
  payload: {
    itemId: string;
    countedQuantity: number;
    unitCost?: number;
    notes?: string | null;
  }
) {
  return requestInventory<PhysicalCountLine>(`/inventory/physical-counts/${physicalCountId}/lines`, {
    body: payload
  });
}

export function completePhysicalCount(physicalCountId: string) {
  return requestInventory<PhysicalCount>(`/inventory/physical-counts/${physicalCountId}/complete`);
}

export function createPhysicalCountAdjustment(physicalCountId: string) {
  return requestInventory<PhysicalCountAdjustmentResult>(
    `/inventory/physical-counts/${physicalCountId}/create-adjustment`
  );
}

export function optionLabel(options: LookupOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

export function recordNumber(record: CatalogRecord, field: string) {
  return Number(record[field] ?? 0);
}
