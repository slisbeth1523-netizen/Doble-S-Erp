import { accountingPostingService } from "./AccountingPostingService.js";
import { ValidationError } from "../../../errors/index.js";
import type { BusinessEventEnvelope } from "../../events/application/BusinessEvent.js";
import type { BusinessEventHandler } from "../../events/application/BusinessEventHandler.js";
import type { PostingRequestPayload } from "../validators/posting-engine.validators.js";

export abstract class AccountingEventHandler implements BusinessEventHandler {
  abstract readonly name: string;
  abstract canHandle(envelope: BusinessEventEnvelope): boolean;
  protected abstract toPostingPayload(envelope: BusinessEventEnvelope): PostingRequestPayload;

  constructor(private readonly postingService = accountingPostingService) {}

  async handle(envelope: BusinessEventEnvelope) {
    if (!envelope.context.companyId) {
      throw new ValidationError(
        "Business event accounting handler requires company context.",
        { eventName: envelope.event.eventName },
        "BUSINESS_EVENT_ACCOUNTING_COMPANY_REQUIRED"
      );
    }
    await this.postingService.create(
      { ...envelope.context, companyId: envelope.context.companyId },
      this.toPostingPayload(envelope)
    );
  }
}
