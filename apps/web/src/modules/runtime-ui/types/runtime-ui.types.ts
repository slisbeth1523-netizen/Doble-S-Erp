import type { ApiErrorKind } from "../../../services/apiErrors.js";

export type RuntimeFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "lookup"
  | "textarea";

export type RuntimeValidation = {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  regex?: string;
  unique?: boolean;
  nullable?: boolean;
};

export type RuntimeField = {
  field: string;
  label: string;
  type: RuntimeFieldType;
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
  validation: RuntimeValidation;
};

export type RuntimeGridColumn = {
  field: string;
  label: string;
  type: RuntimeFieldType;
  order: number;
  width?: number;
  align?: "left" | "center" | "right";
  format?: string;
  sortable: boolean;
  searchable: boolean;
};

export type RuntimeFormField = {
  field: string;
  label: string;
  inputType: RuntimeFieldType;
  order: number;
  required: boolean;
  readOnly: boolean;
  editable: boolean;
  defaultValue?: string | number | boolean | null;
  placeholder?: string;
  helpText?: string;
  lookupCatalog?: string;
  validation: RuntimeValidation;
};

export type RuntimeAction = {
  action: "create" | "update" | "activate" | "deactivate" | "lookup" | "export" | "import";
  permission: string;
  available?: boolean;
};

export type CatalogMetadata = {
  catalog: {
    code: string;
    displayName: string;
    tenantScoped: boolean;
    companyScoped: boolean;
  };
  fields: RuntimeField[];
  grid: {
    columns: RuntimeGridColumn[];
    sortableColumns: string[];
    searchableColumns: string[];
  };
  form: {
    fields: RuntimeFormField[];
  };
  validations: Record<string, RuntimeValidation>;
  actions: RuntimeAction[];
  permissions: Record<string, string>;
  requirements: {
    license: string | null;
    featureFlag: string | null;
  };
};

export type LookupOption = {
  value: string;
  label: string;
  code?: string;
  isActive?: boolean;
};

export type CatalogRecord = Record<string, string | number | boolean | null | undefined>;

export type CatalogListResult = {
  items: CatalogRecord[];
  totalItems: number;
  page?: number;
  pageSize?: number;
};

export type RuntimeResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  errorKind?: ApiErrorKind;
  empty: boolean;
};
