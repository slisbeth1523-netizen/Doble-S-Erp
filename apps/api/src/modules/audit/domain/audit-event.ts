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
