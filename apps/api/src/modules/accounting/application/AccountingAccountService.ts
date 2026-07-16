import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  accountingAccountRepository,
  type AccountingAccountContextInput,
  type AccountingAccountResult
} from "../infrastructure/AccountingAccountRepository.js";
import type {
  AccountingAccountBlockPayload,
  AccountingAccountListQuery,
  AccountingAccountPayload
} from "../validators/accounting-account.validators.js";

export type AccountingAccountContext = AccountingAccountContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class AccountingAccountService extends BaseService {
  constructor(private readonly repository = accountingAccountRepository) {
    super();
  }

  listAccounts(context: AccountingAccountContextInput, query: AccountingAccountListQuery) {
    return this.repository.listAccounts(context, query);
  }

  getAccount(context: AccountingAccountContextInput, accountId: string) {
    return this.repository.getAccount(context, accountId);
  }

  listChildren(context: AccountingAccountContextInput, accountId: string) {
    return this.repository.listChildren(context, accountId);
  }

  async createAccount(context: AccountingAccountContext, payload: AccountingAccountPayload) {
    const result = await this.repository.createAccount({ ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_ACCOUNT_CREATED", "accounting.account.created");
    return result;
  }

  async updateAccount(context: AccountingAccountContext, accountId: string, payload: AccountingAccountPayload) {
    const { account, hierarchyChanged } = await this.repository.updateAccount(accountId, { ...context, ...payload });
    await this.recordSideEffects(context, account, "ACCOUNTING_ACCOUNT_UPDATED", "accounting.account.updated");
    if (hierarchyChanged) {
      await this.recordSideEffects(
        context,
        account,
        "ACCOUNTING_ACCOUNT_HIERARCHY_CHANGED",
        "accounting.account.hierarchy-changed"
      );
    }
    return account;
  }

  async blockAccount(context: AccountingAccountContext, accountId: string, payload: AccountingAccountBlockPayload) {
    const result = await this.repository.blockAccount(context, accountId, payload.reason);
    await this.recordSideEffects(context, result, "ACCOUNTING_ACCOUNT_BLOCKED", "accounting.account.blocked");
    return result;
  }

  async unblockAccount(context: AccountingAccountContext, accountId: string) {
    const result = await this.repository.unblockAccount(context, accountId);
    await this.recordSideEffects(context, result, "ACCOUNTING_ACCOUNT_UNBLOCKED", "accounting.account.unblocked");
    return result;
  }

  async activateAccount(context: AccountingAccountContext, accountId: string) {
    const result = await this.repository.activateAccount(context, accountId);
    await this.recordSideEffects(context, result, "ACCOUNTING_ACCOUNT_ACTIVATED", "accounting.account.activated");
    return result;
  }

  async deactivateAccount(context: AccountingAccountContext, accountId: string) {
    const result = await this.repository.deactivateAccount(context, accountId);
    await this.recordSideEffects(context, result, "ACCOUNTING_ACCOUNT_DEACTIVATED", "accounting.account.deactivated");
    return result;
  }

  private async recordSideEffects(
    context: AccountingAccountContext,
    result: AccountingAccountResult,
    auditAction: string,
    eventName: string
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditAction,
        entity: "accounting.Accounts",
        entityId: result.accountId,
        metadata: {
          code: result.code,
          name: result.name,
          parentAccountId: result.parentAccountId,
          allowsPosting: result.allowsPosting,
          isBlocked: result.isBlocked,
          isActive: result.isActive,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Accounting account audit could not be recorded", {
        accountId: result.accountId,
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
          sourceEntity: "accounting.Accounts",
          sourceEntityId: result.accountId,
          payload: {
            accountId: result.accountId,
            code: result.code,
            name: result.name,
            updatedBy: context.userId
          }
        }
      );
    } catch (error) {
      logger.warn("Accounting account event could not be published", {
        accountId: result.accountId,
        eventName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const accountingAccountService = new AccountingAccountService();
