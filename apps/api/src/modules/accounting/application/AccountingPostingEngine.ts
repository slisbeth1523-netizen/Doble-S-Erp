import { postingRuleRepository } from "../infrastructure/PostingRuleRepository.js";
import { postingPreviewService } from "./PostingPreviewService.js";
import { postingTransactionManager } from "./PostingTransactionManager.js";
import { postingValidator } from "./PostingValidator.js";
import type { PostingRequestPayload } from "../validators/posting-engine.validators.js";

export type PostingContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export class AccountingPostingEngine {
  constructor(
    private readonly rules = postingRuleRepository,
    private readonly previewService = postingPreviewService,
    private readonly validator = postingValidator,
    private readonly transactionManager = postingTransactionManager
  ) {}

  async preview(context: PostingContextInput, payload: PostingRequestPayload) {
    const document = await this.rules.resolveDocument(context, payload.sourceModule, payload.documentId);
    const preview = await this.previewService.buildPreview(context, document, payload.postingDate, payload.reference);
    this.validator.validatePreview(preview);

    return preview;
  }

  async create(context: PostingContextInput, payload: PostingRequestPayload) {
    const preview = await this.preview(context, payload);
    return this.transactionManager.createPosting(context, preview);
  }

  async reverse(context: PostingContextInput, payload: PostingRequestPayload) {
    const preview = await this.preview(context, payload);
    return this.transactionManager.createReversal(context, preview);
  }
}

export const accountingPostingEngine = new AccountingPostingEngine();
