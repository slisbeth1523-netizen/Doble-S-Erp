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
      companyScoped: !["currencies", "units-of-measure"].includes(catalog)
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
    actions,
    permissions: Object.fromEntries(actions.map((action) => [action.action, action.permission])),
    requirements: {
      license: null,
      featureFlag: null
    }
  };
}
