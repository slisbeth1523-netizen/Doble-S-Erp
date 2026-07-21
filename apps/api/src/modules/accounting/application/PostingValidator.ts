import { ValidationError } from "../../../errors/index.js";
import type { PostingPreview } from "./PostingPreviewService.js";

export class PostingValidator {
  validatePreview(preview: PostingPreview) {
    if (preview.lines.length < 2) {
      throw new ValidationError("Posting preview requires at least two lines.", preview, "POSTING_LINES_REQUIRED");
    }
    if (preview.totalDebit <= 0 || preview.totalCredit <= 0) {
      throw new ValidationError("Posting totals must be greater than zero.", preview, "POSTING_EMPTY_TOTALS");
    }
    if (!this.amountsMatch(preview.totalDebit, preview.totalCredit)) {
      throw new ValidationError("Posting debit and credit totals must match.", preview, "POSTING_NOT_BALANCED");
    }
    if (!this.amountsMatch(preview.totalDebitBase, preview.totalCreditBase)) {
      throw new ValidationError("Posting base debit and credit totals must match.", preview, "POSTING_BASE_NOT_BALANCED");
    }

    for (const line of preview.lines) {
      if (!line.accountId) {
        throw new ValidationError("Every posting line must resolve an account.", line, "POSTING_LINE_ACCOUNT_REQUIRED");
      }
      if ((line.debitAmount > 0 && line.creditAmount > 0) || (line.debitAmount === 0 && line.creditAmount === 0)) {
        throw new ValidationError("Posting lines must contain exactly one side.", line, "POSTING_LINE_SIDE_INVALID");
      }
    }
  }

  private amountsMatch(left: number, right: number) {
    return Math.abs(Number(left) - Number(right)) < 0.0001;
  }
}

export const postingValidator = new PostingValidator();
