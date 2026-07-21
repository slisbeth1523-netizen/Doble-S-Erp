import { NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { PostingContextInput } from "../application/AccountingPostingEngine.js";
import type { PostingAccount, PostingDocument } from "./PostingRuleRepository.js";

export type PostingAccountRole =
  | "accountsReceivable"
  | "salesRevenue"
  | "salesTaxPayable"
  | "purchaseExpense"
  | "accountsPayable"
  | "purchaseTaxReceivable";

type PostingAccountSlot = {
  role: PostingAccountRole;
  tag: string;
  accountType: string;
};

type AccountRow = {
  AccountId: string;
  Code: string;
  Name: string;
  AccountType: string;
};

const foundationSlots: Record<PostingAccountRole, PostingAccountSlot> = {
  accountsReceivable: {
    role: "accountsReceivable",
    tag: "POST_AR",
    accountType: "ASSET"
  },
  salesRevenue: {
    role: "salesRevenue",
    tag: "POST_SALES_REV",
    accountType: "REVENUE"
  },
  salesTaxPayable: {
    role: "salesTaxPayable",
    tag: "POST_TAX_PAY",
    accountType: "LIABILITY"
  },
  purchaseExpense: {
    role: "purchaseExpense",
    tag: "POST_PUR_EXP",
    accountType: "EXPENSE"
  },
  accountsPayable: {
    role: "accountsPayable",
    tag: "POST_AP",
    accountType: "LIABILITY"
  },
  purchaseTaxReceivable: {
    role: "purchaseTaxReceivable",
    tag: "POST_TAX_REC",
    accountType: "ASSET"
  }
};

export class PostingAccountResolver extends BaseSqlRepository {
  async resolveAccounts(context: PostingContextInput, document: PostingDocument) {
    if (document.direction === "RECEIVABLE") {
      return {
        debit: await this.resolveSlot(context, foundationSlots.accountsReceivable),
        credit: await this.resolveSlot(context, foundationSlots.salesRevenue),
        tax: document.taxAmount > 0 ? await this.resolveSlot(context, foundationSlots.salesTaxPayable) : undefined
      };
    }

    return {
      debit: await this.resolveSlot(context, foundationSlots.purchaseExpense),
      credit: await this.resolveSlot(context, foundationSlots.accountsPayable),
      tax: document.taxAmount > 0 ? await this.resolveSlot(context, foundationSlots.purchaseTaxReceivable) : undefined
    };
  }

  private async resolveSlot(context: PostingContextInput, slot: PostingAccountSlot): Promise<PostingAccount> {
    const rows = await this.query<AccountRow>(
      `
        SELECT TOP (1) AccountId, Code, Name, AccountType
        FROM accounting.Accounts
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND IsActive = 1
          AND IsBlocked = 0
          AND AllowsPosting = 1
          AND AccountType = @AccountType
          AND Classification = @SlotTag
        ORDER BY AccountId;
      `,
      this.slotParameters(context, slot)
    );

    if (!rows[0]) {
      throw new NotFoundError(
        "No configured posting account was found for this semantic role.",
        { role: slot.role },
        "POSTING_ACCOUNT_RULE_NOT_CONFIGURED"
      );
    }

    return {
      accountId: rows[0].AccountId,
      code: rows[0].Code,
      name: rows[0].Name,
      accountType: rows[0].AccountType
    };
  }

  private slotParameters(context: PostingContextInput, slot: PostingAccountSlot): SqlParameter[] {
    return [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "AccountType", value: slot.accountType },
      { name: "SlotTag", value: slot.tag }
    ];
  }
}

export const postingAccountResolver = new PostingAccountResolver();
