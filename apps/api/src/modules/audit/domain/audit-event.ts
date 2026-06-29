export type AuditEvent = {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress?: string;
  userAgent?: string;
};

export type FunctionalAuditEvent = {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  action: string;
  entityName?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
};
