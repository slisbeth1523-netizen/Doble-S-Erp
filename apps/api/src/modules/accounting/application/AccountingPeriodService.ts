import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  accountingPeriodRepository,
  type AccountingPeriodContextInput,
  type AccountingPeriodResult
} from "../infrastructure/AccountingPeriodRepository.js";
import type {
  AccountingPeriodCreatePayload,
  AccountingPeriodListQuery,
  AccountingPeriodReopenPayload,
  AccountingPeriodUpdatePayload
} from "../validators/accounting-period.validators.js";

export type AccountingPeriodContext = AccountingPeriodContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class AccountingPeriodService extends BaseService {
  constructor(private readonly repository = accountingPeriodRepository) {
    super();
  }

  listPeriods(context: AccountingPeriodContextInput, query: AccountingPeriodListQuery) {
    return this.repository.listPeriods(context, query);
  }

  getPeriod(context: AccountingPeriodContextInput, accountingPeriodId: string) {
    return this.repository.getPeriod(context, accountingPeriodId);
  }

  async createPeriod(context: AccountingPeriodContext, payload: AccountingPeriodCreatePayload) {
    const result = await this.repository.createPeriod({ ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_PERIOD_CREATED", "accounting.period.created");

    return result;
  }

  async updatePeriod(
    context: AccountingPeriodContext,
    accountingPeriodId: string,
    payload: AccountingPeriodUpdatePayload
  ) {
    const result = await this.repository.updatePeriod(accountingPeriodId, { ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_PERIOD_UPDATED", "accounting.period.updated");

    return result;
  }

  async closePeriod(context: AccountingPeriodContext, accountingPeriodId: string) {
    const result = await this.repository.closePeriod(context, accountingPeriodId);
    await this.recordSideEffects(context, result, "ACCOUNTING_PERIOD_CLOSED", "accounting.period.closed");

    return result;
  }

  async reopenPeriod(
    context: AccountingPeriodContext,
    accountingPeriodId: string,
    payload: AccountingPeriodReopenPayload
  ) {
    const result = await this.repository.reopenPeriod(context, accountingPeriodId, payload.reason);
    await this.recordSideEffects(context, result, "ACCOUNTING_PERIOD_REOPENED", "accounting.period.reopened");

    return result;
  }

  async deactivatePeriod(context: AccountingPeriodContext, accountingPeriodId: string) {
    const result = await this.repository.deactivatePeriod(context, accountingPeriodId);
    await this.recordSideEffects(context, result, "ACCOUNTING_PERIOD_DEACTIVATED", "accounting.period.updated");

    return result;
  }

  private async recordSideEffects(
    context: AccountingPeriodContext,
    result: AccountingPeriodResult,
    auditAction: string,
    eventName: string
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditAction,
        entity: "accounting.AccountingPeriods",
        entityId: result.accountingPeriodId,
        metadata: {
          fiscalYear: result.fiscalYear,
          periodNumber: result.periodNumber,
          status: result.status,
          startDate: result.startDate,
          endDate: result.endDate,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Accounting period audit could not be recorded", {
        accountingPeriodId: result.accountingPeriodId,
        action: auditAction,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      await domainEventPublisher.publish(
        {
          tenantId: context.tenantId,
          companyId: context.companyId,
          userId: context.userId,
          requestId: context.requestId ?? "",
          correlationId: context.correlationId ?? context.requestId ?? ""
        },
        {
          eventName,
          eventType: eventName,
          sourceModule: "accounting",
          sourceEntity: "accounting.AccountingPeriods",
          sourceEntityId: result.accountingPeriodId,
          payload: {
            accountingPeriodId: result.accountingPeriodId,
            fiscalYear: result.fiscalYear,
            periodNumber: result.periodNumber,
            status: result.status,
            updatedBy: context.userId
          }
        }
      );
    } catch (error) {
      logger.warn("Accounting period event could not be published", {
        accountingPeriodId: result.accountingPeriodId,
        eventName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const accountingPeriodService = new AccountingPeriodService();
