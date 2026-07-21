import { BaseService } from "../../../services/BaseService.js";
import { accountingPostingEngine, type PostingContextInput } from "./AccountingPostingEngine.js";
import type { PostingRequestPayload } from "../validators/posting-engine.validators.js";

export type AccountingPostingContext = PostingContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class AccountingPostingService extends BaseService {
  constructor(private readonly engine = accountingPostingEngine) {
    super();
  }

  preview(context: AccountingPostingContext, payload: PostingRequestPayload) {
    return this.engine.preview(context, payload);
  }

  create(context: AccountingPostingContext, payload: PostingRequestPayload) {
    return this.engine.create(context, payload);
  }

  reverse(context: AccountingPostingContext, payload: PostingRequestPayload) {
    return this.engine.reverse(context, payload);
  }
}

export const accountingPostingService = new AccountingPostingService();
