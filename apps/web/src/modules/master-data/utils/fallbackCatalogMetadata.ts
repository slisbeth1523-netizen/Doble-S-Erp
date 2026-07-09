import type {
  CatalogMetadata,
  RuntimeAction,
  RuntimeField,
  RuntimeFieldType,
  RuntimeFormField,
  RuntimeGridColumn,
  RuntimeValidation
} from "../../runtime-ui/types/runtime-ui.types.js";
import { getCatalogLabel } from "./catalogLabels.js";

type FieldInput = {
  field: string;
  label: string;
  type?: RuntimeFieldType;
  required?: boolean;
  visibleInGrid?: boolean;
  visibleInForm?: boolean;
  searchable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  readOnly?: boolean;
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  helpText?: string;
  lookupCatalog?: string;
  validation?: RuntimeValidation;
  width?: number;
  align?: "left" | "center" | "right";
  format?: string;
};

const actions: RuntimeAction[] = [
  { action: "create", permission: "local.preview", available: true },
  { action: "update", permission: "local.preview", available: false },
  { action: "activate", permission: "local.preview", available: false },
  { action: "deactivate", permission: "local.preview", available: false },
  { action: "lookup", permission: "local.preview", available: true }
];

const readOnlyActions: RuntimeAction[] = [
  { action: "create", permission: "local.preview", available: false },
  { action: "update", permission: "local.preview", available: false },
  { action: "activate", permission: "local.preview", available: false },
  { action: "deactivate", permission: "local.preview", available: false },
  { action: "lookup", permission: "local.preview", available: true },
  { action: "export", permission: "local.preview", available: false },
  { action: "import", permission: "local.preview", available: false }
];

const technicalFields: FieldInput[] = [
  {
    field: "code",
    label: "Código",
    required: true,
    searchable: true,
    sortable: true,
    validation: { required: true, minLength: 1, maxLength: 40, nullable: false },
    width: 120
  },
  {
    field: "name",
    label: "Nombre",
    required: true,
    searchable: true,
    sortable: true,
    validation: { required: true, minLength: 1, maxLength: 160, nullable: false },
    width: 220
  },
  {
    field: "description",
    label: "Descripción",
    type: "textarea",
    searchable: true,
    visibleInGrid: true,
    validation: { maxLength: 250, nullable: true },
    width: 280
  },
  {
    field: "isActive",
    label: "Activo",
    type: "boolean",
    sortable: true,
    defaultValue: true,
    validation: { nullable: false },
    width: 96,
    align: "center",
    format: "boolean"
  }
];

const catalogFields: Record<string, FieldInput[]> = {
  customers: [
    ...technicalFields.slice(0, 2),
    { field: "commercialName", label: "Nombre comercial", searchable: true, sortable: true, width: 220 },
    { field: "documentNumber", label: "Documento", searchable: true, sortable: true, validation: { maxLength: 40 } },
    {
      field: "email",
      label: "Correo",
      searchable: true,
      sortable: true,
      validation: { maxLength: 200, regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", nullable: true },
      width: 220
    },
    { field: "phone", label: "Teléfono", searchable: true, validation: { maxLength: 40 }, width: 140 },
    { field: "addressLine1", label: "Dirección", type: "textarea", visibleInGrid: false, validation: { maxLength: 300 } },
    { field: "city", label: "Ciudad", visibleInGrid: false, validation: { maxLength: 120 } },
    { field: "province", label: "Provincia", visibleInGrid: false, validation: { maxLength: 120 } },
    { field: "countryCode", label: "País", visibleInGrid: false, validation: { maxLength: 3 } },
    { field: "paymentTermId", label: "Condición de pago", type: "lookup", lookupCatalog: "payment-terms", visibleInGrid: false },
    { field: "currencyId", label: "Moneda", type: "lookup", lookupCatalog: "currencies", visibleInGrid: false },
    { field: "taxCategoryId", label: "Categoría fiscal", type: "lookup", lookupCatalog: "tax-categories", visibleInGrid: false },
    { field: "creditLimit", label: "Límite de crédito", type: "number", defaultValue: 0, validation: { min: 0 }, align: "right" },
    { field: "isCreditCustomer", label: "Cliente a crédito", type: "boolean", defaultValue: false, align: "center" },
    technicalFields[3]!
  ],
  suppliers: [
    ...technicalFields.slice(0, 2),
    { field: "commercialName", label: "Nombre comercial", searchable: true, sortable: true, width: 220 },
    { field: "documentNumber", label: "Documento", searchable: true, sortable: true, validation: { maxLength: 40 } },
    {
      field: "email",
      label: "Correo",
      searchable: true,
      sortable: true,
      validation: { maxLength: 200, regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", nullable: true },
      width: 220
    },
    { field: "phone", label: "Teléfono", searchable: true, validation: { maxLength: 40 }, width: 140 },
    { field: "contactName", label: "Contacto", searchable: true, sortable: true, validation: { maxLength: 200 } },
    { field: "contactEmail", label: "Correo contacto", visibleInGrid: false, validation: { maxLength: 200 } },
    { field: "contactPhone", label: "Teléfono contacto", visibleInGrid: false, validation: { maxLength: 40 } },
    { field: "isTaxWithholder", label: "Agente de retención", type: "boolean", defaultValue: false, align: "center" },
    { field: "isForeignSupplier", label: "Proveedor extranjero", type: "boolean", defaultValue: false, align: "center" },
    { field: "notes", label: "Notas", type: "textarea", visibleInGrid: false, validation: { maxLength: 500 } },
    technicalFields[3]!
  ],
  "purchase-orders": [
    { field: "purchaseOrderNumber", label: "Orden", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 160 },
    { field: "supplierCode", label: "Proveedor", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 130 },
    { field: "supplierName", label: "Nombre proveedor", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 240 },
    { field: "status", label: "Estado", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 120 },
    { field: "orderDate", label: "Fecha", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 170 },
    { field: "expectedDate", label: "Fecha esperada", type: "date", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 150 },
    { field: "reference", label: "Referencia", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 180 },
    { field: "lineCount", label: "Lineas", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 90, align: "right" },
    { field: "totalQuantity", label: "Cantidad total", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right" },
    { field: "totalAmount", label: "Total", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right", format: "currency" },
    { field: "approvedAt", label: "Aprobada", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 160 },
    { field: "cancelledAt", label: "Cancelada", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 160 }
  ],
  "purchase-order-lines": [
    { field: "purchaseOrderNumber", label: "Orden", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 160 },
    { field: "status", label: "Estado", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 120 },
    { field: "lineNumber", label: "Linea", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 1, nullable: false }, width: 90, align: "right" },
    { field: "itemCode", label: "Articulo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 130 },
    { field: "itemDescription", label: "Descripcion articulo", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 240 },
    { field: "warehouseCode", label: "Almacen", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 130 },
    { field: "quantity", label: "Cantidad", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 120, align: "right" },
    { field: "unitCost", label: "Costo unitario", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right", format: "currency" },
    { field: "lineTotal", label: "Total linea", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right", format: "currency" },
    { field: "expectedDate", label: "Fecha esperada", type: "date", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 150 }
  ],
  items: [
    { ...technicalFields[0]!, validation: { required: true, minLength: 1, maxLength: 50, nullable: false } },
    {
      field: "name",
      label: "Descripción",
      required: true,
      searchable: true,
      sortable: true,
      validation: { required: true, minLength: 1, maxLength: 300, nullable: false },
      width: 280
    },
    { field: "shortDescription", label: "Descripción corta", visibleInGrid: false, validation: { maxLength: 120 } },
    { field: "barcode", label: "Código de barras", searchable: true, sortable: true, validation: { maxLength: 100 }, width: 170 },
    { field: "alternateCode", label: "Código alterno", searchable: true, sortable: true, visibleInGrid: false },
    { field: "categoryId", label: "Categoría", type: "lookup", lookupCatalog: "categories", sortable: true },
    { field: "brandId", label: "Marca", type: "lookup", lookupCatalog: "brands", sortable: true },
    { field: "unitOfMeasureId", label: "Unidad", type: "lookup", lookupCatalog: "units-of-measure" },
    { field: "defaultWarehouseId", label: "Almacen por defecto", type: "lookup", lookupCatalog: "warehouses", visibleInGrid: false },
    { field: "taxCategoryId", label: "Categoría fiscal", type: "lookup", lookupCatalog: "tax-categories", visibleInGrid: false },
    { field: "inventoryType", label: "Tipo inventario", defaultValue: "PRODUCT", visibleInGrid: false },
    { field: "trackInventory", label: "Controla inventario", type: "boolean", defaultValue: true, visibleInGrid: false },
    { field: "isService", label: "Es servicio", type: "boolean", defaultValue: false, align: "center" },
    { field: "averageCost", label: "Costo promedio", type: "number", defaultValue: 0, align: "right" },
    { field: "basePrice", label: "Precio base", type: "number", defaultValue: 0, align: "right" },
    { field: "notes", label: "Notas", type: "textarea", visibleInGrid: false },
    technicalFields[3]!
  ],
  categories: [
    ...technicalFields.slice(0, 3),
    { field: "parentCategoryId", label: "Categoría padre", type: "lookup", lookupCatalog: "categories", visibleInGrid: false },
    { field: "isSalesCategory", label: "Categoría de ventas", type: "boolean", defaultValue: true, align: "center" },
    { field: "isPurchaseCategory", label: "Categoría de compras", type: "boolean", defaultValue: true, align: "center" },
    { field: "isInventoryCategory", label: "Categoría de inventario", type: "boolean", defaultValue: true, align: "center" },
    technicalFields[3]!
  ],
  brands: [
    ...technicalFields.slice(0, 3),
    { field: "website", label: "Sitio web", validation: { maxLength: 250, nullable: true }, width: 220 },
    { field: "countryCode", label: "País", validation: { maxLength: 3, nullable: true }, width: 90 },
    technicalFields[3]!
  ],
  warehouses: [
    ...technicalFields.slice(0, 3),
    {
      field: "warehouseType",
      label: "Tipo almacen",
      required: true,
      defaultValue: "NORMAL",
      sortable: true,
      validation: {
        required: true,
        maxLength: 40,
        regex: "^(NORMAL|PRODUCTION|CONSIGNMENT|TRANSIT|VIRTUAL)$",
        nullable: false
      },
      width: 150
    },
    { field: "addressLine1", label: "Direccion 1", visibleInGrid: false, validation: { maxLength: 250, nullable: true } },
    { field: "addressLine2", label: "Direccion 2", visibleInGrid: false, validation: { maxLength: 250, nullable: true } },
    { field: "city", label: "Ciudad", searchable: true, validation: { maxLength: 120, nullable: true }, width: 150 },
    { field: "province", label: "Provincia", searchable: true, validation: { maxLength: 120, nullable: true }, width: 150 },
    { field: "countryCode", label: "Pais", visibleInGrid: false, validation: { maxLength: 3, nullable: true } },
    { field: "responsibleUserId", label: "Responsable", type: "lookup", visibleInGrid: false, visibleInForm: false },
    { field: "allowsNegativeInventory", label: "Permite negativo", type: "boolean", defaultValue: false, visibleInGrid: false },
    { field: "isDefault", label: "Predeterminado", type: "boolean", defaultValue: false, width: 130, align: "center", format: "boolean" },
    { field: "isTransit", label: "Transito", type: "boolean", defaultValue: false, width: 110, align: "center", format: "boolean" },
    { field: "isVirtual", label: "Virtual", type: "boolean", defaultValue: false, width: 100, align: "center", format: "boolean" },
    technicalFields[3]!
  ],
  "inventory-stocks": [
    { field: "itemCode", label: "Articulo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, width: 130 },
    { field: "itemDescription", label: "Descripcion articulo", searchable: true, editable: false, readOnly: true, visibleInForm: false, width: 260 },
    { field: "warehouseCode", label: "Almacen", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, width: 140 },
    { field: "warehouseName", label: "Nombre almacen", searchable: true, editable: false, readOnly: true, visibleInForm: false, width: 220 },
    { field: "quantityOnHand", label: "Existencia", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right" },
    { field: "quantityReserved", label: "Reservado", type: "number", editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right" },
    { field: "quantityAvailable", label: "Disponible", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right" },
    { field: "averageCost", label: "Costo promedio", type: "number", editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right", format: "currency" },
    { field: "lastCost", label: "Ultimo costo", type: "number", editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right", format: "currency" },
    { field: "standardCost", label: "Costo estandar", type: "number", editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right", format: "currency" },
    { field: "lastMovementAt", label: "Ultimo movimiento", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 160 },
    { field: "isActive", label: "Activo", type: "boolean", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 96, align: "center", format: "boolean" }
  ],
  "inventory-movements": [
    { field: "movementNumber", label: "Movimiento", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 150 },
    { field: "movementType", label: "Tipo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 190 },
    { field: "movementDate", label: "Fecha", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 170 },
    { field: "status", label: "Estado", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 110 },
    { field: "sourceModule", label: "Modulo origen", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 140 },
    { field: "sourceDocumentNumber", label: "Documento origen", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 170 },
    { field: "reference", label: "Referencia", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 180 },
    { field: "lineCount", label: "Lineas", type: "number", editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 90, align: "right" },
    { field: "totalQuantity", label: "Cantidad total", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right" },
    { field: "totalCost", label: "Costo total", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right", format: "currency" },
    { field: "postedAt", label: "Posteado", type: "datetime", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 160 },
    { field: "voidedAt", label: "Anulado", type: "datetime", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 160 },
    { field: "isActive", label: "Activo", type: "boolean", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 96, align: "center", format: "boolean" }
  ],
  "inventory-movement-lines": [
    { field: "movementNumber", label: "Movimiento", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 150 },
    { field: "movementType", label: "Tipo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 190 },
    { field: "status", label: "Estado", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 110 },
    { field: "lineNumber", label: "Linea", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 1, nullable: false }, width: 90, align: "right" },
    { field: "itemCode", label: "Articulo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 130 },
    { field: "itemDescription", label: "Descripcion articulo", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 260 },
    { field: "warehouseCode", label: "Almacen", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 140 },
    { field: "quantity", label: "Cantidad", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 120, align: "right" },
    { field: "unitCost", label: "Costo unitario", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right", format: "currency" },
    { field: "totalCost", label: "Costo total", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right", format: "currency" },
    { field: "lotNumber", label: "Lote", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 130 },
    { field: "serialNumber", label: "Serie", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 130 },
    { field: "expirationDate", label: "Vencimiento", type: "date", editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 130 }
  ],
  "inventory-ledger": [
    { field: "movementNumber", label: "Movimiento", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 150 },
    { field: "movementType", label: "Tipo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 180 },
    { field: "ledgerDirection", label: "Direccion", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 110, align: "center" },
    { field: "movementDate", label: "Fecha", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 170 },
    { field: "postedAt", label: "Posteado", type: "datetime", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 170 },
    { field: "itemCode", label: "Articulo", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 130 },
    { field: "itemDescription", label: "Descripcion articulo", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 240 },
    { field: "warehouseCode", label: "Almacen", searchable: true, sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 130 },
    { field: "warehouseName", label: "Nombre almacen", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 200 },
    { field: "quantityIn", label: "Entrada", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 110, align: "right" },
    { field: "quantityOut", label: "Salida", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 110, align: "right" },
    { field: "quantityBalanceImpact", label: "Impacto", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: false }, width: 120, align: "right" },
    { field: "unitCost", label: "Costo unitario", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 140, align: "right", format: "currency" },
    { field: "totalCost", label: "Costo total", type: "number", sortable: true, editable: false, readOnly: true, visibleInForm: false, validation: { min: 0, nullable: false }, width: 130, align: "right", format: "currency" },
    { field: "sourceDocumentNumber", label: "Documento origen", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 170 },
    { field: "reference", label: "Referencia", searchable: true, editable: false, readOnly: true, visibleInForm: false, validation: { nullable: true }, width: 180 }
  ],
  currencies: technicalFields,
  "units-of-measure": [
    ...technicalFields.slice(0, 3),
    { field: "symbol", label: "Simbolo", searchable: true, validation: { maxLength: 20, nullable: true }, width: 100 },
    { field: "unitType", label: "Tipo de unidad", placeholder: "QUANTITY", validation: { maxLength: 40, nullable: true }, width: 140 },
    {
      field: "decimalPrecision",
      label: "Precision decimal",
      type: "number",
      required: true,
      defaultValue: 2,
      validation: { required: true, min: 0, max: 6, nullable: false },
      width: 130,
      align: "right"
    },
    { field: "isBaseUnit", label: "Unidad base", type: "boolean", defaultValue: false, width: 120, align: "center" },
    technicalFields[3]!
  ],
  "payment-terms": technicalFields,
  "tax-categories": technicalFields
};

function buildField(input: FieldInput, index: number): RuntimeField {
  return {
    field: input.field,
    label: input.label,
    type: input.type ?? "text",
    required: input.required ?? false,
    visibleInGrid: input.visibleInGrid ?? true,
    visibleInForm: input.visibleInForm ?? true,
    searchable: input.searchable ?? false,
    sortable: input.sortable ?? false,
    editable: input.editable ?? true,
    readOnly: input.readOnly ?? false,
    defaultValue: input.defaultValue,
    placeholder: input.placeholder,
    helpText: input.helpText,
    displayOrder: (index + 1) * 10,
    validation: input.validation ?? { nullable: true }
  };
}

function buildGridColumn(field: RuntimeField, input: FieldInput): RuntimeGridColumn {
  return {
    field: field.field,
    label: field.label,
    type: field.type,
    order: field.displayOrder,
    width: input.width,
    align: input.align,
    format: input.format,
    sortable: field.sortable,
    searchable: field.searchable
  };
}

function buildFormField(field: RuntimeField, input: FieldInput): RuntimeFormField {
  return {
    field: field.field,
    label: field.label,
    inputType: field.type,
    order: field.displayOrder,
    required: field.required,
    readOnly: field.readOnly,
    editable: field.editable,
    defaultValue: field.defaultValue,
    placeholder: field.placeholder,
    helpText: field.helpText,
    lookupCatalog: input.lookupCatalog,
    validation: field.validation
  };
}

export function getFallbackCatalogMetadata(catalog: string): CatalogMetadata | null {
  const inputs = catalogFields[catalog];
  const catalogReadOnly = [
    "inventory-stocks",
    "inventory-movements",
    "inventory-movement-lines",
    "inventory-ledger",
    "purchase-orders",
    "purchase-order-lines"
  ].includes(catalog);
  const catalogActions = catalogReadOnly ? readOnlyActions : actions;

  if (!inputs) {
    return null;
  }

  const fields = inputs.map(buildField);
  const gridColumns = fields
    .map((field, index) => ({ field, input: inputs[index]! }))
    .filter(({ field }) => field.visibleInGrid)
    .map(({ field, input }) => buildGridColumn(field, input));
  const formFields = fields
    .map((field, index) => ({ field, input: inputs[index]! }))
    .filter(({ field }) => field.visibleInForm)
    .map(({ field, input }) => buildFormField(field, input));

  return {
    catalog: {
      code: catalog,
      displayName: getCatalogLabel(catalog),
      tenantScoped: true,
      companyScoped: !["currencies", "units-of-measure"].includes(catalog),
      readOnly: catalogReadOnly
    },
    fields,
    grid: {
      columns: gridColumns,
      sortableColumns: gridColumns.filter((column) => column.sortable).map((column) => column.field),
      searchableColumns: fields.filter((field) => field.searchable).map((field) => field.field)
    },
    form: {
      fields: formFields
    },
    validations: Object.fromEntries(fields.map((field) => [field.field, field.validation])),
    actions: catalogActions,
    permissions: Object.fromEntries(catalogActions.map((action) => [action.action, action.permission])),
    requirements: {
      license: null,
      featureFlag: null
    }
  };
}
