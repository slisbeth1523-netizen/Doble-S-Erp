import type { PostingDocument } from "../infrastructure/PostingRuleRepository.js";
import { postingRuleRepository } from "../infrastructure/PostingRuleRepository.js";
import type { PostingContextInput } from "./AccountingPostingEngine.js";

export type PostingLinePreview = {
  lineNumber: number;
  side: "DEBIT" | "CREDIT";
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  currencyCode: string;
  exchangeRate: number;
  debitBaseAmount: number;
  creditBaseAmount: number;
  taxAmount: number;
};

export type PostingPreview = {
  sourceModule: string;
  sourceDocumentType: string;
  documentId: string;
  documentNumber: string;
  postingDate: string;
  description: string;
  reference: string;
  currencyCode: string;
  exchangeRate: number;
  totalDebit: number;
  totalCredit: number;
  totalDebitBase: number;
  totalCreditBase: number;
  difference: number;
  baseDifference: number;
  taxAmount: number;
  lines: PostingLinePreview[];
};

export class PostingPreviewService {
  constructor(private readonly rules = postingRuleRepository) {}

  async buildPreview(context: PostingContextInput, document: PostingDocument, postingDate?: string, reference?: string): Promise<PostingPreview> {
    const accounts = await this.rules.resolveAccounts(context, document);
    const taxableBase = Math.max(document.totalAmount - document.taxAmount, 0);
    const entryDate = postingDate ?? document.documentDate;
    const costCenterId = accounts.costCenterId ?? document.costCenterId;
    const lines: PostingLinePreview[] = [];

    if (document.direction === "RECEIVABLE") {
      lines.push(this.line(1, "DEBIT", accounts.debit, document, document.totalAmount, 0, entryDate, "Cuenta por cobrar", 0, costCenterId));
      if (taxableBase > 0) {
        lines.push(this.line(lines.length + 1, "CREDIT", accounts.credit, document, 0, taxableBase, entryDate, "Ingreso", 0, costCenterId));
      }
      if (document.taxAmount > 0 && accounts.tax) {
        lines.push(this.line(lines.length + 1, "CREDIT", accounts.tax, document, 0, document.taxAmount, entryDate, "Impuesto por pagar", document.taxAmount, costCenterId));
      }
    } else {
      if (taxableBase > 0) {
        lines.push(this.line(1, "DEBIT", accounts.debit, document, taxableBase, 0, entryDate, "Gasto o costo", 0, costCenterId));
      }
      if (document.taxAmount > 0 && accounts.tax) {
        lines.push(this.line(lines.length + 1, "DEBIT", accounts.tax, document, document.taxAmount, 0, entryDate, "Impuesto acreditable", document.taxAmount, costCenterId));
      }
      lines.push(this.line(lines.length + 1, "CREDIT", accounts.credit, document, 0, document.totalAmount, entryDate, "Cuenta por pagar", 0, costCenterId));
    }

    const totalDebit = this.round(lines.reduce((sum, line) => sum + line.debitAmount, 0));
    const totalCredit = this.round(lines.reduce((sum, line) => sum + line.creditAmount, 0));
    const totalDebitBase = this.round(lines.reduce((sum, line) => sum + line.debitBaseAmount, 0));
    const totalCreditBase = this.round(lines.reduce((sum, line) => sum + line.creditBaseAmount, 0));

    return {
      sourceModule: document.sourceModule,
      sourceDocumentType: document.sourceDocumentType,
      documentId: document.documentId,
      documentNumber: document.documentNumber,
      postingDate: entryDate,
      description: `Asiento automatico - ${document.description}`,
      reference: reference ?? document.documentNumber,
      currencyCode: document.currencyCode,
      exchangeRate: document.exchangeRate,
      totalDebit,
      totalCredit,
      totalDebitBase,
      totalCreditBase,
      difference: this.round(totalDebit - totalCredit),
      baseDifference: this.round(totalDebitBase - totalCreditBase),
      taxAmount: document.taxAmount,
      lines
    };
  }

  private line(
    lineNumber: number,
    side: "DEBIT" | "CREDIT",
    account: { accountId: string; code: string; name: string },
    document: PostingDocument,
    debitAmount: number,
    creditAmount: number,
    postingDate: string,
    label: string,
    taxAmount = 0,
    costCenterId?: string
  ): PostingLinePreview {
    return {
      lineNumber,
      side,
      accountId: account.accountId,
      accountCode: account.code,
      accountName: account.name,
      costCenterId,
      description: `${label} - ${document.documentNumber}`,
      debitAmount: this.round(debitAmount),
      creditAmount: this.round(creditAmount),
      currencyCode: document.currencyCode,
      exchangeRate: document.exchangeRate,
      debitBaseAmount: this.round(debitAmount * document.exchangeRate),
      creditBaseAmount: this.round(creditAmount * document.exchangeRate),
      taxAmount
    };
  }

  private round(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
  }
}

export const postingPreviewService = new PostingPreviewService();
