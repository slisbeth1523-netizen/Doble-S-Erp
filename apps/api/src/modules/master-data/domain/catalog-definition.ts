export type CatalogPermissionSet = {
  read: string;
  create: string;
  update: string;
  activate: string;
  deactivate: string;
  lookup: string;
  export: string;
  import: string;
};

export type CatalogFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "lookup"
  | "textarea";

export type CatalogFieldValidation = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  regex?: string;
  unique?: boolean;
  nullable?: boolean;
};

export type CatalogFieldGrid = {
  width?: number;
  align?: "left" | "center" | "right";
  format?: string;
};

export type CatalogFieldDefinition = {
  field: string;
  dbColumn?: string;
  label: string;
  type: CatalogFieldType;
  lookupCatalog?: string;
  required: boolean;
  visibleInGrid: boolean;
  visibleInForm: boolean;
  searchable: boolean;
  sortable: boolean;
  editable: boolean;
  readOnly: boolean;
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  helpText?: string;
  displayOrder: number;
  validation: CatalogFieldValidation;
  grid?: CatalogFieldGrid;
};

export type CatalogColumnMap = {
  id: string;
  tenantId: string;
  companyId?: string;
  code: string;
  name: string;
  description: string;
  isActive: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type CatalogDefinition = {
  catalogCode: string;
  displayName: string;
  tableName: string;
  idColumn: string;
  codeColumn: string;
  nameColumn: string;
  descriptionColumn?: string;
  allowedSearchColumns: readonly string[];
  allowedSortColumns: readonly string[];
  defaultSortBy: string;
  permissions: CatalogPermissionSet;
  moduleCode: string;
  tenantScoped: boolean;
  companyScoped: boolean;
  licenseRequirement?: string;
  featureFlagRequirement?: string;
  columns: CatalogColumnMap;
  fields: readonly CatalogFieldDefinition[];
};

const commonPermissions = (resource: string): CatalogPermissionSet => ({
  read: `${resource}.read`,
  create: `${resource}.create`,
  update: `${resource}.update`,
  activate: `${resource}.activate`,
  deactivate: `${resource}.deactivate`,
  lookup: `${resource}.read`,
  export: `${resource}.export`,
  import: `${resource}.import`
});

const commonCatalogFields = (companyVisible: boolean): readonly CatalogFieldDefinition[] => [
  {
    field: "code",
    label: "Code",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "Enter code",
    helpText: "Unique code for this catalog and scope.",
    displayOrder: 10,
    validation: {
      required: true,
      minLength: 1,
      maxLength: 80,
      unique: true,
      nullable: false
    },
    grid: {
      width: 140,
      align: "left"
    }
  },
  {
    field: "name",
    label: "Name",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "Enter name",
    displayOrder: 20,
    validation: {
      required: true,
      minLength: 1,
      maxLength: 160,
      nullable: false
    },
    grid: {
      width: 240,
      align: "left"
    }
  },
  {
    field: "description",
    label: "Description",
    type: "textarea",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: false,
    editable: true,
    readOnly: false,
    placeholder: "Optional description",
    displayOrder: 30,
    validation: {
      maxLength: 250,
      nullable: true
    },
    grid: {
      width: 320,
      align: "left"
    }
  },
  {
    field: "companyId",
    label: "Company",
    type: "lookup",
    required: companyVisible,
    visibleInGrid: companyVisible,
    visibleInForm: companyVisible,
    searchable: false,
    sortable: false,
    editable: companyVisible,
    readOnly: !companyVisible,
    displayOrder: 40,
    validation: {
      required: companyVisible,
      nullable: !companyVisible
    },
    grid: {
      width: 180,
      align: "left"
    }
  },
  {
    field: "isActive",
    label: "Active",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: true,
    displayOrder: 50,
    validation: {
      nullable: false
    },
    grid: {
      width: 96,
      align: "center",
      format: "boolean"
    }
  }
];

const customerFields = [
  {
    field: "code",
    label: "Codigo",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "CLI-0001",
    displayOrder: 10,
    validation: { required: true, minLength: 1, maxLength: 40, unique: true, nullable: false },
    grid: { width: 120, align: "left" }
  },
  {
    field: "name",
    label: "Nombre",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "Nombre legal del cliente",
    displayOrder: 20,
    validation: { required: true, minLength: 1, maxLength: 200, nullable: false },
    grid: { width: 240, align: "left" }
  },
  {
    field: "commercialName",
    dbColumn: "CommercialName",
    label: "Nombre comercial",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 30,
    validation: { maxLength: 200, nullable: true },
    grid: { width: 220, align: "left" }
  },
  {
    field: "documentType",
    dbColumn: "DocumentType",
    label: "Tipo documento",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    placeholder: "RNC, Cedula, Pasaporte",
    displayOrder: 40,
    validation: { maxLength: 30, nullable: true }
  },
  {
    field: "documentNumber",
    dbColumn: "DocumentNumber",
    label: "Documento",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 50,
    validation: { maxLength: 40, nullable: true },
    grid: { width: 150, align: "left" }
  },
  {
    field: "email",
    dbColumn: "Email",
    label: "Correo",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 60,
    validation: { maxLength: 200, regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", nullable: true },
    grid: { width: 220, align: "left" }
  },
  {
    field: "phone",
    dbColumn: "Phone",
    label: "Telefono",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 70,
    validation: { maxLength: 40, nullable: true },
    grid: { width: 140, align: "left" }
  },
  {
    field: "mobile",
    dbColumn: "Mobile",
    label: "Movil",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 80,
    validation: { maxLength: 40, nullable: true }
  },
  {
    field: "addressLine1",
    dbColumn: "AddressLine1",
    label: "Direccion",
    type: "textarea",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 90,
    validation: { maxLength: 300, nullable: true }
  },
  {
    field: "city",
    dbColumn: "City",
    label: "Ciudad",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 100,
    validation: { maxLength: 120, nullable: true }
  },
  {
    field: "province",
    dbColumn: "Province",
    label: "Provincia",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 110,
    validation: { maxLength: 120, nullable: true }
  },
  {
    field: "countryCode",
    dbColumn: "CountryCode",
    label: "Pais",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    placeholder: "DOM",
    displayOrder: 120,
    validation: { minLength: 2, maxLength: 3, nullable: true }
  },
  {
    field: "paymentTermId",
    dbColumn: "PaymentTermId",
    label: "Condicion de pago",
    type: "lookup",
    lookupCatalog: "payment-terms",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 130,
    validation: { nullable: true }
  },
  {
    field: "currencyId",
    dbColumn: "CurrencyId",
    label: "Moneda",
    type: "lookup",
    lookupCatalog: "currencies",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 140,
    validation: { nullable: true }
  },
  {
    field: "taxCategoryId",
    dbColumn: "TaxCategoryId",
    label: "Categoria fiscal",
    type: "lookup",
    lookupCatalog: "tax-categories",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 150,
    validation: { nullable: true }
  },
  {
    field: "creditLimit",
    dbColumn: "CreditLimit",
    label: "Limite de credito",
    type: "number",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 160,
    validation: { min: 0, nullable: true },
    grid: { width: 140, align: "right", format: "currency" }
  },
  {
    field: "isCreditCustomer",
    dbColumn: "IsCreditCustomer",
    label: "Cliente a credito",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 170,
    validation: { nullable: false },
    grid: { width: 120, align: "center", format: "boolean" }
  },
  {
    field: "isActive",
    label: "Activo",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: true,
    displayOrder: 180,
    validation: { nullable: false },
    grid: { width: 96, align: "center", format: "boolean" }
  }
] as const satisfies readonly CatalogFieldDefinition[];

const supplierFields = [
  {
    field: "code",
    label: "Codigo",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "SUP-0001",
    displayOrder: 10,
    validation: { required: true, minLength: 1, maxLength: 40, unique: true, nullable: false },
    grid: { width: 120, align: "left" }
  },
  {
    field: "name",
    label: "Nombre",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "Nombre legal del proveedor",
    displayOrder: 20,
    validation: { required: true, minLength: 1, maxLength: 200, nullable: false },
    grid: { width: 240, align: "left" }
  },
  {
    field: "commercialName",
    dbColumn: "CommercialName",
    label: "Nombre comercial",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 30,
    validation: { maxLength: 200, nullable: true },
    grid: { width: 220, align: "left" }
  },
  {
    field: "documentType",
    dbColumn: "DocumentType",
    label: "Tipo documento",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    placeholder: "RNC, Cedula, Pasaporte",
    displayOrder: 40,
    validation: { maxLength: 30, nullable: true }
  },
  {
    field: "documentNumber",
    dbColumn: "DocumentNumber",
    label: "Documento",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 50,
    validation: { maxLength: 40, nullable: true },
    grid: { width: 150, align: "left" }
  },
  {
    field: "email",
    dbColumn: "Email",
    label: "Correo",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 60,
    validation: { maxLength: 200, regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", nullable: true },
    grid: { width: 220, align: "left" }
  },
  {
    field: "phone",
    dbColumn: "Phone",
    label: "Telefono",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 70,
    validation: { maxLength: 40, nullable: true },
    grid: { width: 140, align: "left" }
  },
  {
    field: "mobile",
    dbColumn: "Mobile",
    label: "Movil",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 80,
    validation: { maxLength: 40, nullable: true }
  },
  {
    field: "addressLine1",
    dbColumn: "AddressLine1",
    label: "Direccion",
    type: "textarea",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 90,
    validation: { maxLength: 300, nullable: true }
  },
  {
    field: "city",
    dbColumn: "City",
    label: "Ciudad",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 100,
    validation: { maxLength: 120, nullable: true }
  },
  {
    field: "province",
    dbColumn: "Province",
    label: "Provincia",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 110,
    validation: { maxLength: 120, nullable: true }
  },
  {
    field: "countryCode",
    dbColumn: "CountryCode",
    label: "Pais",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    placeholder: "DOM",
    displayOrder: 120,
    validation: { minLength: 2, maxLength: 3, nullable: true }
  },
  {
    field: "paymentTermId",
    dbColumn: "PaymentTermId",
    label: "Condicion de pago",
    type: "lookup",
    lookupCatalog: "payment-terms",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 130,
    validation: { nullable: true }
  },
  {
    field: "currencyId",
    dbColumn: "CurrencyId",
    label: "Moneda",
    type: "lookup",
    lookupCatalog: "currencies",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 140,
    validation: { nullable: true }
  },
  {
    field: "taxCategoryId",
    dbColumn: "TaxCategoryId",
    label: "Categoria fiscal",
    type: "lookup",
    lookupCatalog: "tax-categories",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 150,
    validation: { nullable: true }
  },
  {
    field: "isTaxWithholder",
    dbColumn: "IsTaxWithholder",
    label: "Agente de retencion",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 160,
    validation: { nullable: false },
    grid: { width: 130, align: "center", format: "boolean" }
  },
  {
    field: "isForeignSupplier",
    dbColumn: "IsForeignSupplier",
    label: "Proveedor extranjero",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 170,
    validation: { nullable: false },
    grid: { width: 150, align: "center", format: "boolean" }
  },
  {
    field: "contactName",
    dbColumn: "ContactName",
    label: "Contacto",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 180,
    validation: { maxLength: 200, nullable: true },
    grid: { width: 200, align: "left" }
  },
  {
    field: "contactEmail",
    dbColumn: "ContactEmail",
    label: "Correo contacto",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 190,
    validation: { maxLength: 200, regex: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", nullable: true }
  },
  {
    field: "contactPhone",
    dbColumn: "ContactPhone",
    label: "Telefono contacto",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 200,
    validation: { maxLength: 40, nullable: true }
  },
  {
    field: "notes",
    dbColumn: "Notes",
    label: "Notas",
    type: "textarea",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 210,
    validation: { maxLength: 500, nullable: true }
  },
  {
    field: "isActive",
    label: "Activo",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: true,
    displayOrder: 220,
    validation: { nullable: false },
    grid: { width: 96, align: "center", format: "boolean" }
  }
] as const satisfies readonly CatalogFieldDefinition[];

const itemFields = [
  {
    field: "code",
    label: "Codigo",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "ART-0001",
    displayOrder: 10,
    validation: { required: true, minLength: 1, maxLength: 50, unique: true, nullable: false },
    grid: { width: 130, align: "left" }
  },
  {
    field: "name",
    label: "Descripcion",
    type: "text",
    required: true,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    placeholder: "Descripcion principal del articulo",
    displayOrder: 20,
    validation: { required: true, minLength: 1, maxLength: 300, nullable: false },
    grid: { width: 280, align: "left" }
  },
  {
    field: "shortDescription",
    dbColumn: "ShortDescription",
    label: "Descripcion corta",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 30,
    validation: { maxLength: 120, nullable: true }
  },
  {
    field: "barcode",
    dbColumn: "Barcode",
    label: "Codigo de barras",
    type: "text",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 40,
    validation: { maxLength: 100, nullable: true },
    grid: { width: 170, align: "left" }
  },
  {
    field: "alternateCode",
    dbColumn: "AlternateCode",
    label: "Codigo alterno",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: true,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 50,
    validation: { maxLength: 100, nullable: true }
  },
  {
    field: "categoryId",
    dbColumn: "CategoryId",
    label: "Categoria",
    type: "lookup",
    lookupCatalog: "categories",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 60,
    validation: { nullable: true },
    grid: { width: 150, align: "left" }
  },
  {
    field: "brandId",
    dbColumn: "BrandId",
    label: "Marca",
    type: "lookup",
    lookupCatalog: "brands",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    displayOrder: 70,
    validation: { nullable: true },
    grid: { width: 150, align: "left" }
  },
  {
    field: "unitOfMeasureId",
    dbColumn: "UnitOfMeasureId",
    label: "Unidad",
    type: "lookup",
    lookupCatalog: "units-of-measure",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 80,
    validation: { nullable: true },
    grid: { width: 130, align: "left" }
  },
  {
    field: "taxCategoryId",
    dbColumn: "TaxCategoryId",
    label: "Categoria fiscal",
    type: "lookup",
    lookupCatalog: "tax-categories",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 90,
    validation: { nullable: true }
  },
  {
    field: "inventoryType",
    dbColumn: "InventoryType",
    label: "Tipo inventario",
    type: "text",
    required: true,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: "PRODUCT",
    helpText: "PRODUCT, SERVICE, RAW_MATERIAL, FINISHED_GOOD, CONSUMABLE",
    displayOrder: 100,
    validation: {
      required: true,
      regex: "^(PRODUCT|SERVICE|RAW_MATERIAL|FINISHED_GOOD|CONSUMABLE)$",
      nullable: false
    }
  },
  {
    field: "itemType",
    dbColumn: "ItemType",
    label: "Tipo articulo",
    type: "text",
    required: true,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: "NORMAL",
    helpText: "NORMAL, KIT, BUNDLE, SERVICE",
    displayOrder: 110,
    validation: { required: true, regex: "^(NORMAL|KIT|BUNDLE|SERVICE)$", nullable: false }
  },
  {
    field: "allowNegativeInventory",
    dbColumn: "AllowNegativeInventory",
    label: "Permite negativo",
    type: "boolean",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 120,
    validation: { nullable: false }
  },
  {
    field: "trackInventory",
    dbColumn: "TrackInventory",
    label: "Controla inventario",
    type: "boolean",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: true,
    displayOrder: 130,
    validation: { nullable: false }
  },
  {
    field: "trackLot",
    dbColumn: "TrackLot",
    label: "Controla lote",
    type: "boolean",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 140,
    validation: { nullable: false }
  },
  {
    field: "trackSerial",
    dbColumn: "TrackSerial",
    label: "Controla serie",
    type: "boolean",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 150,
    validation: { nullable: false }
  },
  {
    field: "isService",
    dbColumn: "IsService",
    label: "Es servicio",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 160,
    validation: { nullable: false },
    grid: { width: 110, align: "center", format: "boolean" }
  },
  {
    field: "isManufactured",
    dbColumn: "IsManufactured",
    label: "Manufacturado",
    type: "boolean",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: false,
    displayOrder: 170,
    validation: { nullable: false }
  },
  {
    field: "costMethod",
    dbColumn: "CostMethod",
    label: "Metodo de costo",
    type: "text",
    required: true,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: "AVERAGE",
    helpText: "AVERAGE, FIFO, LIFO_PLACEHOLDER, STANDARD",
    displayOrder: 180,
    validation: { required: true, regex: "^(AVERAGE|FIFO|LIFO_PLACEHOLDER|STANDARD)$", nullable: false }
  },
  {
    field: "standardCost",
    dbColumn: "StandardCost",
    label: "Costo estandar",
    type: "number",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 190,
    validation: { min: 0, nullable: true }
  },
  {
    field: "averageCost",
    dbColumn: "AverageCost",
    label: "Costo promedio",
    type: "number",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 200,
    validation: { min: 0, nullable: true },
    grid: { width: 140, align: "right", format: "currency" }
  },
  {
    field: "lastCost",
    dbColumn: "LastCost",
    label: "Ultimo costo",
    type: "number",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 210,
    validation: { min: 0, nullable: true }
  },
  {
    field: "basePrice",
    dbColumn: "BasePrice",
    label: "Precio base",
    type: "number",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 220,
    validation: { min: 0, nullable: true },
    grid: { width: 140, align: "right", format: "currency" }
  },
  {
    field: "minimumPrice",
    dbColumn: "MinimumPrice",
    label: "Precio minimo",
    type: "number",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 230,
    validation: { min: 0, nullable: true }
  },
  {
    field: "maximumDiscountPercent",
    dbColumn: "MaximumDiscountPercent",
    label: "Descuento maximo %",
    type: "number",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 240,
    validation: { min: 0, max: 100, nullable: true }
  },
  {
    field: "weight",
    dbColumn: "Weight",
    label: "Peso",
    type: "number",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 250,
    validation: { min: 0, nullable: true }
  },
  {
    field: "volume",
    dbColumn: "Volume",
    label: "Volumen",
    type: "number",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    defaultValue: 0,
    displayOrder: 260,
    validation: { min: 0, nullable: true }
  },
  {
    field: "imageUrl",
    dbColumn: "ImageUrl",
    label: "URL imagen",
    type: "text",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 270,
    validation: { maxLength: 500, nullable: true }
  },
  {
    field: "notes",
    dbColumn: "Notes",
    label: "Notas",
    type: "textarea",
    required: false,
    visibleInGrid: false,
    visibleInForm: true,
    searchable: false,
    sortable: false,
    editable: true,
    readOnly: false,
    displayOrder: 280,
    validation: { maxLength: 1000, nullable: true }
  },
  {
    field: "isActive",
    label: "Activo",
    type: "boolean",
    required: false,
    visibleInGrid: true,
    visibleInForm: true,
    searchable: false,
    sortable: true,
    editable: true,
    readOnly: false,
    defaultValue: true,
    displayOrder: 290,
    validation: { nullable: false },
    grid: { width: 96, align: "center", format: "boolean" }
  }
] as const satisfies readonly CatalogFieldDefinition[];

export const catalogDefinitions = {
  currencies: {
    catalogCode: "currencies",
    displayName: "Currencies",
    tableName: "core.Currencies",
    idColumn: "CurrencyId",
    codeColumn: "Code",
    nameColumn: "Name",
    descriptionColumn: "Description",
    allowedSearchColumns: ["Code", "Name", "Description"],
    allowedSortColumns: ["Code", "Name", "CreatedAt", "IsActive"],
    defaultSortBy: "Name",
    permissions: commonPermissions("master-data.currencies"),
    moduleCode: "master-data",
    tenantScoped: true,
    companyScoped: false,
    columns: {
      id: "CurrencyId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Name",
      description: "Description",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: commonCatalogFields(false)
  },
  "payment-terms": {
    catalogCode: "payment-terms",
    displayName: "Payment Terms",
    tableName: "core.PaymentTerms",
    idColumn: "PaymentTermId",
    codeColumn: "Code",
    nameColumn: "Name",
    descriptionColumn: "Description",
    allowedSearchColumns: ["Code", "Name", "Description"],
    allowedSortColumns: ["Code", "Name", "CreatedAt", "IsActive"],
    defaultSortBy: "Name",
    permissions: commonPermissions("master-data.payment-terms"),
    moduleCode: "master-data",
    tenantScoped: true,
    companyScoped: true,
    columns: {
      id: "PaymentTermId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Name",
      description: "Description",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: commonCatalogFields(true)
  },
  "tax-categories": {
    catalogCode: "tax-categories",
    displayName: "Tax Categories",
    tableName: "fiscal.TaxCategories",
    idColumn: "TaxCategoryId",
    codeColumn: "Code",
    nameColumn: "Name",
    descriptionColumn: "Description",
    allowedSearchColumns: ["Code", "Name", "Description"],
    allowedSortColumns: ["Code", "Name", "CreatedAt", "IsActive"],
    defaultSortBy: "Name",
    permissions: commonPermissions("master-data.tax-categories"),
    moduleCode: "master-data",
    tenantScoped: true,
    companyScoped: true,
    columns: {
      id: "TaxCategoryId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Name",
      description: "Description",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: commonCatalogFields(true)
  },
  "units-of-measure": {
    catalogCode: "units-of-measure",
    displayName: "Units of Measure",
    tableName: "core.UnitsOfMeasure",
    idColumn: "UnitOfMeasureId",
    codeColumn: "Code",
    nameColumn: "Name",
    descriptionColumn: "Description",
    allowedSearchColumns: ["Code", "Name", "Description"],
    allowedSortColumns: ["Code", "Name", "CreatedAt", "IsActive"],
    defaultSortBy: "Name",
    permissions: commonPermissions("master-data.units-of-measure"),
    moduleCode: "master-data",
    tenantScoped: true,
    companyScoped: false,
    columns: {
      id: "UnitOfMeasureId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Name",
      description: "Description",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: commonCatalogFields(false)
  },
  customers: {
    catalogCode: "customers",
    displayName: "Clientes",
    tableName: "crm.Customers",
    idColumn: "CustomerId",
    codeColumn: "Code",
    nameColumn: "Name",
    allowedSearchColumns: ["Code", "Name", "CommercialName", "DocumentNumber", "Email", "Phone"],
    allowedSortColumns: [
      "Code",
      "Name",
      "CommercialName",
      "DocumentNumber",
      "Email",
      "City",
      "Province",
      "CreditLimit",
      "IsCreditCustomer",
      "CreatedAt",
      "IsActive"
    ],
    defaultSortBy: "Name",
    permissions: commonPermissions("crm.customers"),
    moduleCode: "crm",
    tenantScoped: true,
    companyScoped: true,
    columns: {
      id: "CustomerId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Name",
      description: "AddressLine1",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: customerFields
  },
  suppliers: {
    catalogCode: "suppliers",
    displayName: "Proveedores",
    tableName: "purchasing.Suppliers",
    idColumn: "SupplierId",
    codeColumn: "Code",
    nameColumn: "Name",
    allowedSearchColumns: [
      "Code",
      "Name",
      "CommercialName",
      "DocumentNumber",
      "Email",
      "Phone",
      "ContactName"
    ],
    allowedSortColumns: [
      "Code",
      "Name",
      "CommercialName",
      "DocumentNumber",
      "Email",
      "City",
      "Province",
      "ContactName",
      "IsTaxWithholder",
      "IsForeignSupplier",
      "CreatedAt",
      "IsActive"
    ],
    defaultSortBy: "Name",
    permissions: commonPermissions("purchasing.suppliers"),
    moduleCode: "purchasing",
    tenantScoped: true,
    companyScoped: true,
    columns: {
      id: "SupplierId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Name",
      description: "Notes",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: supplierFields
  },
  items: {
    catalogCode: "items",
    displayName: "Articulos",
    tableName: "inventory.Items",
    idColumn: "ItemId",
    codeColumn: "Code",
    nameColumn: "Description",
    allowedSearchColumns: ["Code", "Description", "Barcode", "AlternateCode"],
    allowedSortColumns: [
      "Code",
      "Description",
      "Barcode",
      "AlternateCode",
      "CategoryId",
      "BrandId",
      "BasePrice",
      "AverageCost",
      "CreatedAt",
      "IsActive"
    ],
    defaultSortBy: "Description",
    permissions: commonPermissions("inventory.items"),
    moduleCode: "inventory",
    tenantScoped: true,
    companyScoped: true,
    columns: {
      id: "ItemId",
      tenantId: "TenantId",
      companyId: "CompanyId",
      code: "Code",
      name: "Description",
      description: "Notes",
      isActive: "IsActive",
      createdAt: "CreatedAt",
      updatedAt: "UpdatedAt",
      createdBy: "CreatedBy",
      updatedBy: "UpdatedBy"
    },
    fields: itemFields
  }
} as const satisfies Record<string, CatalogDefinition>;

export type CatalogCode = keyof typeof catalogDefinitions;

export function getCatalogDefinition(catalogCode: string) {
  return catalogDefinitions[catalogCode as CatalogCode];
}
