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
  label: string;
  type: CatalogFieldType;
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
  descriptionColumn: string;
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
  }
} as const satisfies Record<string, CatalogDefinition>;

export type CatalogCode = keyof typeof catalogDefinitions;

export function getCatalogDefinition(catalogCode: string) {
  return catalogDefinitions[catalogCode as CatalogCode];
}
