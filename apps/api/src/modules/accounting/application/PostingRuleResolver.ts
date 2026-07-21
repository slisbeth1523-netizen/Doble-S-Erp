import { NotFoundError } from "../../../errors/index.js";
import type { PostingContextInput } from "./AccountingPostingEngine.js";
import { PostingRuleCache } from "./PostingRuleCache.js";
import type {
  PostingAccount,
  PostingDocument,
  PostingRuleRepository,
  ResolvedPostingRule
} from "../infrastructure/PostingRuleRepository.js";

export type ResolvedPostingAccounts = {
  debit: PostingAccount;
  credit: PostingAccount;
  tax?: PostingAccount;
  costCenterId?: string;
};

export class PostingRuleResolver {
  private readonly cache = new PostingRuleCache<ResolvedPostingRule[]>();

  async resolveAccounts(
    repository: PostingRuleRepository,
    context: PostingContextInput,
    document: PostingDocument
  ): Promise<ResolvedPostingAccounts> {
    const cacheKey = {
      tenantId: context.tenantId,
      companyId: context.companyId,
      sourceModule: document.sourceModule,
      sourceDocumentType: document.sourceDocumentType,
      direction: document.direction
    };
    let rules = this.cache.get(cacheKey);

    if (!rules) {
      rules = await repository.listRulesForResolution(context, document);
      this.cache.set(cacheKey, rules);
    }

    const rule = rules.find((candidate) => this.isEffective(candidate, document.documentDate));
    if (!rule) {
      throw new NotFoundError(
        "No active posting rule could be resolved for this document.",
        {
          sourceModule: document.sourceModule,
          sourceDocumentType: document.sourceDocumentType,
          direction: document.direction
        },
        "POSTING_RULE_NOT_FOUND"
      );
    }

    return {
      debit: rule.debit,
      credit: rule.credit,
      tax: document.taxAmount > 0 && rule.appliesTax ? rule.tax : undefined,
      costCenterId: rule.costCenterId
    };
  }

  invalidateCompany(tenantId: string, companyId: string) {
    this.cache.invalidateCompany(tenantId, companyId);
  }

  private isEffective(rule: ResolvedPostingRule, documentDate: string) {
    return (!rule.validFrom || rule.validFrom <= documentDate) && (!rule.validTo || rule.validTo >= documentDate);
  }
}

export const postingRuleResolver = new PostingRuleResolver();
