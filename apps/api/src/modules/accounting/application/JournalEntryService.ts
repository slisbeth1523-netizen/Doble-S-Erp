import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  journalEntryRepository,
  type JournalEntryContextInput,
  type JournalEntryDetail
} from "../infrastructure/JournalEntryRepository.js";
import type {
  JournalEntryCreatePayload,
  JournalEntryLinePayload,
  JournalEntryListQuery,
  JournalEntryPostPayload,
  JournalEntryUpdatePayload
} from "../validators/journal-entry.validators.js";

export type JournalEntryContext = JournalEntryContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class JournalEntryService extends BaseService {
  constructor(private readonly repository = journalEntryRepository) {
    super();
  }

  listEntries(context: JournalEntryContextInput, query: JournalEntryListQuery) {
    return this.repository.listEntries(context, query);
  }

  getEntry(context: JournalEntryContextInput, journalEntryId: string) {
    return this.repository.getEntry(context, journalEntryId);
  }

  listLines(context: JournalEntryContextInput, journalEntryId: string) {
    return this.repository.listLines(context, journalEntryId);
  }

  async createEntry(context: JournalEntryContext, payload: JournalEntryCreatePayload) {
    const result = await this.repository.createEntry({ ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_JOURNAL_ENTRY_CREATED", "accounting.journal-entry.created");

    return result;
  }

  async updateEntry(context: JournalEntryContext, journalEntryId: string, payload: JournalEntryUpdatePayload) {
    const result = await this.repository.updateEntry(journalEntryId, { ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_JOURNAL_ENTRY_UPDATED", "accounting.journal-entry.updated");

    return result;
  }

  async addLine(context: JournalEntryContext, journalEntryId: string, payload: JournalEntryLinePayload) {
    const result = await this.repository.addLine(journalEntryId, { ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_JOURNAL_ENTRY_LINE_ADDED", "accounting.journal-entry.line-added");

    return result;
  }

  async updateLine(
    context: JournalEntryContext,
    journalEntryId: string,
    lineId: string,
    payload: JournalEntryLinePayload
  ) {
    const result = await this.repository.updateLine(journalEntryId, lineId, { ...context, ...payload });
    await this.recordSideEffects(context, result, "ACCOUNTING_JOURNAL_ENTRY_LINE_UPDATED", "accounting.journal-entry.line-updated");

    return result;
  }

  async deleteLine(context: JournalEntryContext, journalEntryId: string, lineId: string) {
    const result = await this.repository.deleteLine(context, journalEntryId, lineId);
    await this.recordSideEffects(context, result, "ACCOUNTING_JOURNAL_ENTRY_LINE_DELETED", "accounting.journal-entry.line-deleted");

    return result;
  }

  async postEntry(context: JournalEntryContext, journalEntryId: string, payload: JournalEntryPostPayload) {
    const result = await this.repository.postEntry(context, journalEntryId, payload);
    if (result.postedNow) {
      await this.recordSideEffects(context, result, "ACCOUNTING_JOURNAL_ENTRY_POSTED", "accounting.journal-entry.posted");
    }

    return result;
  }

  countPostOperations(context: JournalEntryContextInput, journalEntryId: string) {
    return this.repository.countPostOperations(context, journalEntryId);
  }

  private async recordSideEffects(
    context: JournalEntryContext,
    result: JournalEntryDetail,
    auditAction: string,
    eventName: string
  ) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: auditAction,
        entity: "accounting.JournalEntries",
        entityId: result.journalEntryId,
        metadata: {
          entryNumber: result.entryNumber,
          status: result.status,
          totalDebit: result.totalDebit,
          totalCredit: result.totalCredit,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Journal entry audit could not be recorded", {
        journalEntryId: result.journalEntryId,
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
          sourceEntity: "accounting.JournalEntries",
          sourceEntityId: result.journalEntryId,
          payload: {
            journalEntryId: result.journalEntryId,
            entryNumber: result.entryNumber,
            status: result.status,
            totalDebit: result.totalDebit,
            totalCredit: result.totalCredit,
            updatedBy: context.userId
          }
        }
      );
    } catch (error) {
      logger.warn("Journal entry event could not be published", {
        journalEntryId: result.journalEntryId,
        eventName,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const journalEntryService = new JournalEntryService();
