export type TenantContext = {
  tenantId: string;
};

export type CompanyContext = TenantContext & {
  companyId: string;
};

export type UserContext = TenantContext & {
  userId: string;
  companyId?: string;
  roles: string[];
};

