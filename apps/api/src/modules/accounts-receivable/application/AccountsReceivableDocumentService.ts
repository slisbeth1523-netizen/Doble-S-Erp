import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  accountsReceivableDocumentRepository,
  type AccountsReceivableContextInput,
  type AccountsReceivableDocumentCreateInput
} from "../infrastructure/AccountsReceivableDocumentRepository.js";
import type {
  AccountsReceivableDocumentCreatePayload,
  AccountsReceivableDocumentListQuery,
  CustomerBalanceListQuery
} from "../validators/accounts-receivable-document.validators.js";

export type AccountsReceivableContext = AccountsReceivableContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class AccountsReceivableDocumentService extends BaseService {
  constructor(private readonly repository = accountsReceivableDocumentRepository) {
    super();
  }

  async createDocument(context: AccountsReceivableContext, payload: AccountsReceivableDocumentCreatePayload) {
    const input: AccountsReceivableDocumentCreateInput = {
      ...context,
      ...payload
    };
    const result = await this.repository.createDocument(input);

    await this.recordCreateSideEffects(context, result);

    return result;
  }

  listDocuments(context: AccountsReceivableContextInput, query: AccountsReceivableDocumentListQuery) {
    return this.repository.listDocuments(context, query);
  }

  getDocument(context: AccountsReceivableContextInput, documentId: string) {
    return this.repository.getDocument(context, documentId);
  }

  listCustomerBalances(context: AccountsReceivableContextInput, query: CustomerBalanceListQuery) {
    return this.repository.listCustomerBalances(context, query);
  }

  getCustomerBalance(context: AccountsReceivableContextInput, customerId: string) {
    return this.repository.getCustomerBalance(context, customerId);
  }

  private async recordCreateSideEffects(
    context: AccountsReceivableContext,
    result: Awaited<ReturnType<typeof this.repository.createDocument>>
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "ACCOUNTS_RECEIVABLE_DOCUMENT_CREATED",
        entity: "ar.AccountsReceivableDocuments",
        entityId: result.id,
        metadata: {
          documentNumber: result.documentNumber,
          customerId: result.customerId,
          sourceType: result.sourceType,
          totalAmount: result.totalAmount,
          remainingAmount: result.remainingAmount,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Accounts receivable document audit could not be recorded", {
        accountsReceivableDocumentId: result.id,
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
          eventName: "ar.accounts-receivable-document.created",
          eventType: "ar.accounts-receivable-document.created",
          sourceModule: "accounts-receivable",
          sourceEntity: "ar.AccountsReceivableDocuments",
          sourceEntityId: result.id,
          payload: {
            accountsReceivableDocumentId: result.id,
            documentNumber: result.documentNumber,
            customerId: result.customerId,
            sourceType: result.sourceType,
            totalAmount: result.totalAmount,
            createdBy: context.userId
          }
        }
      );
    } catch (error) {
      logger.warn("Accounts receivable document event could not be published", {
        accountsReceivableDocumentId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const accountsReceivableDocumentService = new AccountsReceivableDocumentService();
