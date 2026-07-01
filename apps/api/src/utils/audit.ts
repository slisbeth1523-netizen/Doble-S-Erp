import { recordFunctionalAuditEvent } from "../modules/audit/infrastructure/audit.repository.js";
import { logger } from "./logger.js";

export type AuditLogInput = {
  tenantId?: string;
  companyId?: string;
  userId?: string;
  action: string;
  entity?: string;
  entityName?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
};

export async function auditEvent(input: AuditLogInput) {
  try {
    await recordFunctionalAuditEvent({
      tenantId: input.tenantId,
      companyId: input.companyId,
      userId: input.userId,
      action: input.action,
      entityName: input.entityName ?? input.entity,
      entityId: input.entityId,
      metadata: input.timestamp
        ? {
            ...input.metadata,
            timestamp: input.timestamp.toISOString()
          }
        : input.metadata
    });
  } catch {
    logger.warn("Functional audit event could not be recorded", {
      action: input.action,
      entityName: input.entityName,
      entityId: input.entityId
    });
  }
}
