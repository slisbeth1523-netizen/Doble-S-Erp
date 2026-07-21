import type { PostingDocument } from "../infrastructure/PostingRuleRepository.js";

export type PostingRuleCacheKey = {
  tenantId: string;
  companyId: string;
  sourceModule: string;
  sourceDocumentType: string;
  direction: PostingDocument["direction"];
};

export class PostingRuleCache<TValue> {
  private readonly entries = new Map<string, TValue>();

  get(key: PostingRuleCacheKey) {
    return this.entries.get(this.key(key));
  }

  set(key: PostingRuleCacheKey, value: TValue) {
    this.entries.set(this.key(key), value);
  }

  invalidateCompany(tenantId: string, companyId: string) {
    const prefix = `${tenantId}:${companyId}:`;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
      }
    }
  }

  clear() {
    this.entries.clear();
  }

  private key(value: PostingRuleCacheKey) {
    return [
      value.tenantId,
      value.companyId,
      value.sourceModule,
      value.sourceDocumentType,
      value.direction
    ].join(":");
  }
}
