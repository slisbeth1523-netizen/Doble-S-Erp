import { BaseService } from "../../../services/BaseService.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  postingRuleRepository,
  type PostingRuleResult
} from "../infrastructure/PostingRuleRepository.js";
import type { PostingContextInput } from "./AccountingPostingEngine.js";
import { postingRuleResolver } from "./PostingRuleResolver.js";
import { postingRuleValidator } from "./PostingRuleValidator.js";
import type { PostingRuleListQuery, PostingRulePayload } from "../validators/posting-rule.validators.js";

export type PostingRuleContext = PostingContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class PostingRuleService extends BaseService {
  constructor(
    private readonly repository = postingRuleRepository,
    private readonly validator = postingRuleValidator,
    private readonly resolver = postingRuleResolver
  ) {
    super();
  }

  listRules(context: PostingRuleContext, query: PostingRuleListQuery) {
    return this.repository.listRules(context, query);
  }

  getRule(context: PostingRuleContext, postingRuleId: string) {
    return this.repository.getRule(context, postingRuleId);
  }

  async createRule(context: PostingRuleContext, payload: PostingRulePayload) {
    this.validator.validatePayload(payload);
    const result = await this.repository.createRule(context, payload);
    this.invalidate(context);
    await this.recordAudit(context, result, "ACCOUNTING_POSTING_RULE_CREATED");
    return result;
  }

  async updateRule(context: PostingRuleContext, postingRuleId: string, payload: PostingRulePayload) {
    this.validator.validatePayload(payload);
    const result = await this.repository.updateRule(context, postingRuleId, payload);
    this.invalidate(context);
    await this.recordAudit(context, result, "ACCOUNTING_POSTING_RULE_UPDATED");
    return result;
  }

  async deleteRule(context: PostingRuleContext, postingRuleId: string) {
    const result = await this.repository.deleteRule(context, postingRuleId);
    this.invalidate(context);
    await this.recordAudit(context, result, "ACCOUNTING_POSTING_RULE_DELETED");
    return result;
  }

  private invalidate(context: PostingRuleContext) {
    this.resolver.invalidateCompany(context.tenantId, context.companyId);
  }

  private async recordAudit(context: PostingRuleContext, result: PostingRuleResult, action: string) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action,
        entity: "accounting.PostingRules",
        entityId: result.postingRuleId,
        metadata: {
          ruleCode: result.ruleCode,
          sourceModule: result.sourceModule,
          sourceDocumentType: result.sourceDocumentType,
          direction: result.direction,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Posting rule audit could not be recorded", {
        postingRuleId: result.postingRuleId,
        action,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const postingRuleService = new PostingRuleService();
