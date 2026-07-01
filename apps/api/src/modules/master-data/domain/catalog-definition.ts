export type CatalogPermissionSet = {
  read: string;
  create: string;
  update: string;
  activate: string;
  deactivate: string;
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
};

const commonPermissions = (resource: string): CatalogPermissionSet => ({
  read: `${resource}.read`,
  create: `${resource}.create`,
  update: `${resource}.update`,
  activate: `${resource}.activate`,
  deactivate: `${resource}.deactivate`
});

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
    }
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
    }
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
    }
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
    }
  }
} as const satisfies Record<string, CatalogDefinition>;

export type CatalogCode = keyof typeof catalogDefinitions;

export function getCatalogDefinition(catalogCode: string) {
  return catalogDefinitions[catalogCode as CatalogCode];
}
