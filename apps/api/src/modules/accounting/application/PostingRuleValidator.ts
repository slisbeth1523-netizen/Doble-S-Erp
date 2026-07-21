import { ConflictError, ValidationError } from "../../../errors/index.js";
import type { PostingRulePayload } from "../validators/posting-rule.validators.js";

const validPairs = new Set([
  "ACCOUNTS_RECEIVABLE:AR_DOCUMENT:RECEIVABLE",
  "ACCOUNTS_PAYABLE:AP_DOCUMENT:PAYABLE",
  "SALES:SALES_INVOICE:RECEIVABLE",
  "PURCHASING:SUPPLIER_INVOICE:PAYABLE"
]);

export class PostingRuleValidator {
  validatePayload(payload: PostingRulePayload) {
    const pair = `${payload.sourceModule}:${payload.sourceDocumentType}:${payload.direction}`;
    if (!validPairs.has(pair)) {
      throw new ValidationError(
        "Posting rule source, document type and direction are not compatible.",
        { sourceModule: payload.sourceModule, sourceDocumentType: payload.sourceDocumentType, direction: payload.direction },
        "POSTING_RULE_SOURCE_INVALID"
      );
    }

    if (payload.debitAccountId === payload.creditAccountId) {
      throw new ConflictError(
        "Debit and credit accounts must be different.",
        { debitAccountId: payload.debitAccountId, creditAccountId: payload.creditAccountId },
        "POSTING_RULE_SAME_ACCOUNT"
      );
    }

    if (payload.taxAccountId && [payload.debitAccountId, payload.creditAccountId].includes(payload.taxAccountId)) {
      throw new ConflictError(
        "Tax account must be different from debit and credit accounts.",
        { taxAccountId: payload.taxAccountId },
        "POSTING_RULE_TAX_ACCOUNT_REPEATED"
      );
    }

    if (payload.validFrom && payload.validTo && payload.validTo < payload.validFrom) {
      throw new ValidationError(
        "Posting rule validTo must be greater than or equal to validFrom.",
        { validFrom: payload.validFrom, validTo: payload.validTo },
        "POSTING_RULE_DATE_RANGE_INVALID"
      );
    }
  }
}

export const postingRuleValidator = new PostingRuleValidator();
