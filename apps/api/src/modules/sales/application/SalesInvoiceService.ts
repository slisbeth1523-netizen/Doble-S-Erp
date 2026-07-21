import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { salesAccountingService } from "./SalesAccountingService.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  salesInvoiceRepository,
  type SalesInvoiceContext,
  type SalesInvoiceContextInput,
  type SalesInvoiceResult
} from "../infrastructure/SalesInvoiceRepository.js";
import type {
  SalesInvoiceCreatePayload,
  SalesInvoiceLineCreatePayload,
  SalesInvoiceLineUpdatePayload,
  SalesInvoiceListQuery,
  SalesInvoicePostPayload
} from "../validators/sales-invoice.validators.js";

type SideEffectAction = "created" | "lineAdded" | "lineUpdated" | "lineDeleted" | "posted";

const auditActions: Record<SideEffectAction, string> = {
  created: "SALES_INVOICE_CREATED",
  lineAdded: "SALES_INVOICE_LINE_ADDED",
  lineUpdated: "SALES_INVOICE_LINE_UPDATED",
  lineDeleted: "SALES_INVOICE_LINE_DELETED",
  posted: "SALES_INVOICE_POSTED"
};

export class SalesInvoiceService extends BaseService {
  constructor(
    private readonly repository = salesInvoiceRepository,
    private readonly accounting = salesAccountingService
  ) {
    super();
  }

  listInvoices(context: SalesInvoiceContextInput, query: SalesInvoiceListQuery) {
    return this.repository.listInvoices(context, query);
  }

  getInvoice(context: SalesInvoiceContextInput, invoiceId: string) {
    return this.repository.getInvoice(context, invoiceId);
  }

  getOrderPendingLines(context: SalesInvoiceContextInput, salesOrderId: string) {
    return this.repository.getOrderPendingLines(context, salesOrderId);
  }

  getShipmentPendingLines(context: SalesInvoiceContextInput, salesShipmentId: string) {
    return this.repository.getShipmentPendingLines(context, salesShipmentId);
  }

  async createInvoice(context: SalesInvoiceContext, payload: SalesInvoiceCreatePayload) {
    const result = await this.repository.createInvoice(context, payload);
    await this.recordSideEffects(context, result, "created");
    return result;
  }

  async addLine(context: SalesInvoiceContext, invoiceId: string, payload: SalesInvoiceLineCreatePayload) {
    const result = await this.repository.addLine(context, invoiceId, payload);
    await this.recordSideEffects(context, result, "lineAdded");
    return result;
  }

  async updateLine(context: SalesInvoiceContext, invoiceId: string, lineId: string, payload: SalesInvoiceLineUpdatePayload) {
    const result = await this.repository.updateLine(context, invoiceId, lineId, payload);
    await this.recordSideEffects(context, result, "lineUpdated");
    return result;
  }

  async deleteLine(context: SalesInvoiceContext, invoiceId: string, lineId: string) {
    const result = await this.repository.deleteLine(context, invoiceId, lineId);
    await this.recordSideEffects(context, result, "lineDeleted");
    return result;
  }

  async postInvoice(context: SalesInvoiceContext, invoiceId: string, payload: SalesInvoicePostPayload) {
    const result = await this.repository.postInvoice(context, invoiceId, payload);
    const accountingResult = await this.accounting.postInvoiceAccounting(context, result.id, {
      postingDate: result.invoiceDate.toISOString().slice(0, 10),
      reference: result.invoiceNumber
    });
    if (!result.idempotencyReplayed) {
      await this.recordSideEffects(context, result, "posted");
      await this.recordAccountsReceivableCreatedEvent(context, result);
    }
    return {
      ...result,
      accounting: accountingResult.accounting,
      accountingJournalEntry: accountingResult.journalEntry
    };
  }

  private async recordSideEffects(context: SalesInvoiceContext, result: SalesInvoiceResult, action: SideEffectAction) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditActions[action],
        entity: "sales.SalesInvoices",
        entityId: result.id,
        metadata: {
          invoiceNumber: result.invoiceNumber,
          salesOrderId: result.salesOrderId,
          status: result.status,
          totalAmount: result.totalAmount,
          accountsReceivableDocumentId: result.accountsReceivableDocumentId,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Sales invoice audit could not be recorded", {
        salesInvoiceId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    if (!["created", "posted"].includes(action)) {
      return;
    }

    const eventName = action === "posted" ? "sales.invoice.posted" : "sales.invoice.created";
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
          sourceModule: "sales",
          sourceEntity: "sales.SalesInvoices",
          sourceEntityId: result.id,
          payload: {
            salesInvoiceId: result.id,
            invoiceNumber: result.invoiceNumber,
            salesOrderId: result.salesOrderId,
            accountsReceivableDocumentId: result.accountsReceivableDocumentId,
            status: result.status
          }
        }
      );
    } catch (error) {
      logger.warn("Sales invoice event could not be published", {
        salesInvoiceId: result.id,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async recordAccountsReceivableCreatedEvent(context: SalesInvoiceContext, result: SalesInvoiceResult) {
    if (!result.accountsReceivableDocumentId) {
      return;
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
          sourceEntityId: result.accountsReceivableDocumentId,
          payload: {
            accountsReceivableDocumentId: result.accountsReceivableDocumentId,
            documentNumber: result.accountsReceivableDocumentNumber,
            sourceType: "SALES_INVOICE",
            sourceDocumentId: result.id,
            totalAmount: result.totalAmount
          }
        }
      );
    } catch (error) {
      logger.warn("Sales invoice accounts receivable event could not be published", {
        salesInvoiceId: result.id,
        accountsReceivableDocumentId: result.accountsReceivableDocumentId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const salesInvoiceService = new SalesInvoiceService();
