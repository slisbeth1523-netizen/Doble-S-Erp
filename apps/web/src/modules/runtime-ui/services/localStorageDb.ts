import type { CatalogRecord, CatalogListResult } from "../types/runtime-ui.types.js";

// Helper to seed initial data
const initialMockData: Record<string, CatalogRecord[]> = {
  customers: [
    { id: "c1", code: "CLI-00001", name: "Juan Pérez", commercialName: "Comercial Juan", documentNumber: "224-0012345-6", email: "juan@example.com", phone: "809-555-0199", isActive: true, isCreditCustomer: true, creditLimit: 50000 },
    { id: "c2", code: "CLI-00002", name: "María Rodríguez", commercialName: "Rodríguez CXP", documentNumber: "101-0023456-7", email: "maria@example.com", phone: "829-555-0288", isActive: true, isCreditCustomer: false, creditLimit: 0 },
    { id: "c3", code: "CLI-00003", name: "Estación de Servicios Sol", commercialName: "Gasolinera Sol", documentNumber: "131-01923-4", email: "sol@servicios.com", phone: "809-555-0300", isActive: true, isCreditCustomer: true, creditLimit: 150000 }
  ],
  suppliers: [
    { id: "s1", code: "PROV-00001", name: "Distribuidora Dominicana S.A.", commercialName: "DisDom", documentNumber: "101-55555-1", email: "ventas@disdom.com.do", phone: "809-222-1111", isActive: true, isTaxWithholder: true },
    { id: "s2", code: "PROV-00002", name: "Importaciones Pérez", commercialName: "ImpPerez", documentNumber: "224-11823-9", email: "contacto@impperez.com", phone: "829-333-4444", isActive: true, isTaxWithholder: false }
  ],
  currencies: [
    { id: "cur1", code: "DOP", name: "Peso Dominicano", isActive: true },
    { id: "cur2", code: "USD", name: "Dólar Estadounidense", isActive: true }
  ],
  "payment-terms": [
    { id: "pt1", code: "CONTADO", name: "Pago al Contado", isActive: true },
    { id: "pt2", code: "CRED30", name: "Crédito 30 Días", isActive: true },
    { id: "pt3", code: "CRED60", name: "Crédito 60 Días", isActive: true }
  ],
  "tax-categories": [
    { id: "tc1", code: "ITBIS18", name: "ITBIS 18%", isActive: true },
    { id: "tc2", code: "ITBIS16", name: "ITBIS 16%", isActive: true },
    { id: "tc3", code: "EXENTO", name: "Exento", isActive: true }
  ],
  items: [
    { id: "i1", code: "ART-00001", name: "Cemento Gris Cibao Tipo IP", barcode: "7460123456789", categoryId: "cat1", brandId: "b1", unitOfMeasureId: "uom1", averageCost: 450, basePrice: 520, isActive: true, isService: false },
    { id: "i2", code: "ART-00002", name: "Varilla de Acero 3/8", barcode: "7460123456790", categoryId: "cat2", brandId: "b2", unitOfMeasureId: "uom1", averageCost: 180, basePrice: 220, isActive: true, isService: false },
    { id: "i3", code: "SRV-00001", name: "Consultoría de Ingeniería Estructural", barcode: "", categoryId: "cat3", brandId: "b3", unitOfMeasureId: "uom2", averageCost: 0, basePrice: 2500, isActive: true, isService: true }
  ],
  categories: [
    { id: "cat1", code: "CONST", name: "Construcción", isActive: true },
    { id: "cat2", code: "FERR", name: "Ferretería", isActive: true },
    { id: "cat3", code: "SERV", name: "Servicios", isActive: true }
  ],
  brands: [
    { id: "b1", code: "CIBAO", name: "Cementos Cibao", isActive: true },
    { id: "b2", code: "METAL", name: "Metaldom", isActive: true },
    { id: "b3", code: "GEN", name: "Genérico", isActive: true }
  ],
  warehouses: [
    { id: "w1", code: "ALM-PPAL", name: "Almacén Principal", warehouseType: "NORMAL", isDefault: true, isActive: true },
    { id: "w2", code: "ALM-TRANS", name: "Almacén de Tránsito", warehouseType: "TRANSIT", isTransit: true, isActive: true }
  ],
  "units-of-measure": [
    { id: "uom1", code: "UND", name: "Unidad", symbol: "und", decimalPrecision: 0, isBaseUnit: true, isActive: true },
    { id: "uom2", code: "HORA", name: "Hora", symbol: "h", decimalPrecision: 2, isBaseUnit: false, isActive: true }
  ],
  "cost-centers": [
    { id: "cc1", code: "ADM", name: "Administración", isActive: true },
    { id: "cc2", code: "VTA", name: "Ventas", isActive: true },
    { id: "cc3", code: "OPE", name: "Operaciones", isActive: true }
  ]
};

function getStorageKey(catalog: string) {
  return `dobles_erp_catalog_${catalog}`;
}

export function getLocalCatalogItems(catalog: string): CatalogRecord[] {
  const key = getStorageKey(catalog);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fail silent and reload initial
    }
  }

  const initial = initialMockData[catalog] || [];
  localStorage.setItem(key, JSON.stringify(initial));
  return initial;
}

export function saveLocalCatalogItems(catalog: string, items: CatalogRecord[]) {
  const key = getStorageKey(catalog);
  localStorage.setItem(key, JSON.stringify(items));
}

export function queryLocalCatalog(
  catalog: string,
  params: {
    search?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  }
): CatalogListResult {
  let items = getLocalCatalogItems(catalog);

  // Apply filters
  if (params.search) {
    const s = params.search.toLowerCase();
    items = items.filter(
      (item) =>
        String(item.code || "").toLowerCase().includes(s) ||
        String(item.name || "").toLowerCase().includes(s) ||
        String(item.commercialName || "").toLowerCase().includes(s)
    );
  }

  if (params.isActive !== undefined) {
    items = items.filter((item) => item.isActive === params.isActive);
  }

  // Apply Sorting
  const sortBy = params.sortBy || "code";
  const direction = params.sortDirection || "asc";
  items.sort((a, b) => {
    const valA = String(a[sortBy] || "");
    const valB = String(b[sortBy] || "");
    return direction === "asc"
      ? valA.localeCompare(valB, undefined, { numeric: true })
      : valB.localeCompare(valA, undefined, { numeric: true });
  });

  // Apply Pagination
  const page = params.page || 1;
  const pageSize = params.pageSize || 10;
  const startIndex = (page - 1) * pageSize;
  const paginated = items.slice(startIndex, startIndex + pageSize);

  return {
    items: paginated,
    totalItems: items.length,
    page,
    pageSize
  };
}

export function saveLocalCatalogRecord(catalog: string, record: CatalogRecord): CatalogRecord {
  const items = getLocalCatalogItems(catalog);
  let resolvedRecord = { ...record };

  if (record.id) {
    // Edit existing
    const index = items.findIndex((item) => item.id === record.id);
    if (index >= 0) {
      items[index] = { ...items[index], ...record };
    } else {
      items.push(record);
    }
  } else {
    // Create new
    resolvedRecord.id = `local_${Date.now()}`;
    items.push(resolvedRecord);
  }

  saveLocalCatalogItems(catalog, items);
  return resolvedRecord;
}

export function deleteLocalCatalogRecord(catalog: string, id: string) {
  const items = getLocalCatalogItems(catalog);
  const updated = items.filter((item) => item.id !== id);
  saveLocalCatalogItems(catalog, updated);
}
