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

export type RequestContext = {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  jwtId?: string;
  permissions?: string[];
  requestId: string;
  correlationId: string;
};
