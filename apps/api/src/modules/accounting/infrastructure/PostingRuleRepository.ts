import sql from "mssql";

import { NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { PostingContextInput } from "../application/AccountingPostingEngine.js";

export type PostingDocument = {
  sourceModule: string;
  sourceDocumentType: string;
  documentId: string;
  documentNumber: string;
  documentDate: string;
  description: string;
  currencyCode: string;
  exchangeRate: number;
  totalAmount: number;
  taxAmount: number;
  costCenterId?: string;
  direction: "RECEIVABLE" | "PAYABLE";
};

export type PostingAccount = {
  accountId: string;
  code: string;
  name: string;
  accountType: string;
};

type DocumentRow = {
  DocumentId: string;
  DocumentNumber: string;
  DocumentDate: Date;
  Description: string;
  CurrencyCode: string;
  ExchangeRate: number;
  TotalAmount: number;
  TaxAmount: number;
  CostCenterId: string | null;
};

type AccountRow = {
  AccountId: string;
  Code: string;
  Name: string;
  AccountType: string;
};

export class PostingRuleRepository extends BaseSqlRepository {
  async resolveDocument(context: PostingContextInput, sourceModule: string, documentId: string): Promise<PostingDocument> {
    const normalized = this.normalizeSource(sourceModule);

    if (normalized === "AR_DOCUMENT") {
      const rows = await this.query<DocumentRow>(
        `
          SELECT
            document.AccountsReceivableDocumentId AS DocumentId,
            document.DocumentNumber,
            document.DocumentDate,
            CONCAT(N'Documento CxC ', document.DocumentNumber) AS Description,
            document.CurrencyCode,
            document.ExchangeRate,
            document.TotalAmount,
            CAST(0 AS decimal(18, 4)) AS TaxAmount,
            CAST(NULL AS uniqueidentifier) AS CostCenterId
          FROM ar.AccountsReceivableDocuments document
          WHERE document.TenantId = @TenantId
            AND document.CompanyId = @CompanyId
            AND document.AccountsReceivableDocumentId = @DocumentId
            AND document.IsActive = 1;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "ACCOUNTS_RECEIVABLE", "AR_DOCUMENT", "RECEIVABLE", documentId);
    }

    if (normalized === "AP_DOCUMENT") {
      const rows = await this.query<DocumentRow>(
        `
          SELECT
            document.AccountsPayableDocumentId AS DocumentId,
            document.DocumentNumber,
            document.DocumentDate,
            CONCAT(N'Documento CxP ', document.DocumentNumber) AS Description,
            document.CurrencyCode,
            document.ExchangeRate,
            document.TotalAmount,
            CAST(0 AS decimal(18, 4)) AS TaxAmount,
            CAST(NULL AS uniqueidentifier) AS CostCenterId
          FROM ap.AccountsPayableDocuments document
          WHERE document.TenantId = @TenantId
            AND document.CompanyId = @CompanyId
            AND document.AccountsPayableDocumentId = @DocumentId
            AND document.IsActive = 1;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "ACCOUNTS_PAYABLE", "AP_DOCUMENT", "PAYABLE", documentId);
    }

    if (normalized === "SALES_INVOICE") {
      const rows = await this.query<DocumentRow>(
        `
          SELECT
            invoice.SalesInvoiceId AS DocumentId,
            invoice.InvoiceNumber AS DocumentNumber,
            invoice.InvoiceDate AS DocumentDate,
            CONCAT(N'Factura de venta ', invoice.InvoiceNumber) AS Description,
            invoice.CurrencyCode,
            invoice.ExchangeRate,
            invoice.TotalAmount,
            invoice.TaxAmount,
            CAST(NULL AS uniqueidentifier) AS CostCenterId
          FROM sales.SalesInvoices invoice
          WHERE invoice.TenantId = @TenantId
            AND invoice.CompanyId = @CompanyId
            AND invoice.SalesInvoiceId = @DocumentId
            AND invoice.IsActive = 1;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "SALES", "SALES_INVOICE", "RECEIVABLE", documentId);
    }

    if (normalized === "SUPPLIER_INVOICE") {
      const rows = await this.query<DocumentRow>(
        `
          SELECT
            invoice.SupplierInvoiceId AS DocumentId,
            invoice.SupplierInvoiceNumber AS DocumentNumber,
            invoice.InvoiceDate AS DocumentDate,
            CONCAT(N'Factura proveedor ', invoice.SupplierInvoiceNumber) AS Description,
            CAST(N'DOP' AS nvarchar(3)) AS CurrencyCode,
            CAST(1 AS decimal(18, 6)) AS ExchangeRate,
            invoice.TotalAmount,
            invoice.TaxAmount,
            CAST(NULL AS uniqueidentifier) AS CostCenterId
          FROM purchasing.SupplierInvoices invoice
          WHERE invoice.TenantId = @TenantId
            AND invoice.CompanyId = @CompanyId
            AND invoice.SupplierInvoiceId = @DocumentId
            AND invoice.IsActive = 1;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "PURCHASING", "SUPPLIER_INVOICE", "PAYABLE", documentId);
    }

    throw new ValidationError(
      "Source module is not supported by the accounting posting engine.",
      { sourceModule },
      "POSTING_SOURCE_UNSUPPORTED"
    );
  }

  async resolveAccounts(context: PostingContextInput, document: PostingDocument) {
    if (document.direction === "RECEIVABLE") {
      return {
        debit: await this.findAccount(context, ["1-01-003"], "ASSET", "cuentas por cobrar"),
        credit: await this.findAccount(context, ["4-01", "4"], "REVENUE", "ingresos"),
        tax: document.taxAmount > 0 ? await this.findAccount(context, ["2-03"], "LIABILITY", "itbis por pagar") : undefined
      };
    }

    return {
      debit: await this.findAccount(context, ["5-01", "5"], "EXPENSE", "gasto"),
      credit: await this.findAccount(context, ["2-01"], "LIABILITY", "cuentas por pagar"),
      tax: document.taxAmount > 0 ? await this.findAccount(context, ["1-01-004"], "ASSET", "itbis adelantado") : undefined
    };
  }

  async validateAccountInTransaction(
    transaction: sql.Transaction,
    context: PostingContextInput,
    accountId: string,
    entryDate: string
  ): Promise<PostingAccount> {
    const rows = await this.queryInTransaction<AccountRow>(
      transaction,
      `
        SELECT AccountId, Code, Name, AccountType
        FROM accounting.Accounts WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND AccountId = @AccountId
          AND IsActive = 1
          AND IsBlocked = 0
          AND AllowsPosting = 1
          AND (ValidFrom IS NULL OR ValidFrom <= @EntryDate)
          AND (ValidTo IS NULL OR ValidTo >= @EntryDate);
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "AccountId", value: accountId },
        { name: "EntryDate", value: entryDate }
      ]
    );
    if (!rows[0]) {
      throw new ValidationError("Posting account is not available.", { accountId }, "POSTING_ACCOUNT_INVALID");
    }

    return this.mapAccount(rows[0]);
  }

  private async findAccount(
    context: PostingContextInput,
    preferredCodes: string[],
    accountType: string,
    nameSearch: string
  ): Promise<PostingAccount> {
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
          AND (
            Code IN (${preferredCodes.map((_, index) => `@Code${index}`).join(", ")})
            OR LOWER(Name) LIKE @NameSearch
          )
        ORDER BY
          CASE ${preferredCodes.map((_, index) => `WHEN Code = @Code${index} THEN ${index}`).join(" ")} ELSE 99 END,
          Code;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "AccountType", value: accountType },
        { name: "NameSearch", value: `%${nameSearch.toLowerCase()}%` },
        ...preferredCodes.map((code, index) => ({ name: `Code${index}`, value: code }))
      ]
    );
    if (!rows[0]) {
      throw new NotFoundError("No posting account rule could be resolved.", { accountType, preferredCodes }, "POSTING_ACCOUNT_NOT_FOUND");
    }

    return this.mapAccount(rows[0]);
  }

  private normalizeSource(sourceModule: string) {
    const source = sourceModule.toUpperCase();
    if (["AR", "ACCOUNTS_RECEIVABLE", "AR_DOCUMENT", "ACCOUNTS_RECEIVABLE_DOCUMENT"].includes(source)) return "AR_DOCUMENT";
    if (["AP", "ACCOUNTS_PAYABLE", "AP_DOCUMENT", "ACCOUNTS_PAYABLE_DOCUMENT"].includes(source)) return "AP_DOCUMENT";
    if (["SALES", "SALES_INVOICE"].includes(source)) return "SALES_INVOICE";
    if (["PURCHASING", "SUPPLIER_INVOICE"].includes(source)) return "SUPPLIER_INVOICE";
    return source;
  }

  private mapDocument(
    row: DocumentRow | undefined,
    sourceModule: string,
    sourceDocumentType: string,
    direction: PostingDocument["direction"],
    documentId: string
  ): PostingDocument {
    if (!row) {
      throw new NotFoundError("Source document was not found.", { documentId, sourceDocumentType }, "POSTING_DOCUMENT_NOT_FOUND");
    }

    return {
      sourceModule,
      sourceDocumentType,
      documentId: row.DocumentId,
      documentNumber: row.DocumentNumber,
      documentDate: this.toDateInput(row.DocumentDate),
      description: row.Description,
      currencyCode: row.CurrencyCode,
      exchangeRate: Number(row.ExchangeRate || 1),
      totalAmount: Number(row.TotalAmount),
      taxAmount: Number(row.TaxAmount ?? 0),
      costCenterId: row.CostCenterId ?? undefined,
      direction
    };
  }

  private mapAccount(row: AccountRow): PostingAccount {
    return {
      accountId: row.AccountId,
      code: row.Code,
      name: row.Name,
      accountType: row.AccountType
    };
  }

  private documentParameters(context: PostingContextInput, documentId: string): SqlParameter[] {
    return [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "DocumentId", value: documentId }
    ];
  }

  private toDateInput(value: Date | string) {
    if (typeof value === "string") return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
  }

  protected async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    const request = new sql.Request(transaction);
    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }
    const result = await request.query<TRecord>(sqlText);
    return result.recordset;
  }
}

export const postingRuleRepository = new PostingRuleRepository();
