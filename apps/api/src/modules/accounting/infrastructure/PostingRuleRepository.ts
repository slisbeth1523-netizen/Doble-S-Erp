import sql from "mssql";

import { NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { PostingContextInput } from "../application/AccountingPostingEngine.js";
import { postingAccountResolver } from "./PostingAccountResolver.js";

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
  CurrencyCode: string | null;
  ExchangeRate: number | null;
  TotalAmount: number;
  TaxAmount: number;
  CostCenterId: string | null;
  Status: string;
  IsActive: boolean;
};

type AccountRow = {
  AccountId: string;
  Code: string;
  Name: string;
  AccountType: string;
};

export class PostingRuleRepository extends BaseSqlRepository {
  constructor(private readonly accountResolver = postingAccountResolver) {
    super();
  }

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
            CAST(NULL AS uniqueidentifier) AS CostCenterId,
            document.Status,
            document.IsActive
          FROM ar.AccountsReceivableDocuments document
          WHERE document.TenantId = @TenantId
            AND document.CompanyId = @CompanyId
            AND document.AccountsReceivableDocumentId = @DocumentId;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "ACCOUNTS_RECEIVABLE", "AR_DOCUMENT", "RECEIVABLE", documentId, {
        validStatuses: ["OPEN", "PARTIALLY_PAID", "PAID"]
      });
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
            CAST(NULL AS uniqueidentifier) AS CostCenterId,
            document.Status,
            document.IsActive
          FROM ap.AccountsPayableDocuments document
          WHERE document.TenantId = @TenantId
            AND document.CompanyId = @CompanyId
            AND document.AccountsPayableDocumentId = @DocumentId;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "ACCOUNTS_PAYABLE", "AP_DOCUMENT", "PAYABLE", documentId, {
        validStatuses: ["PENDING", "OPEN", "PARTIALLY_PAID", "PAID"]
      });
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
            CAST(NULL AS uniqueidentifier) AS CostCenterId,
            invoice.Status,
            invoice.IsActive
          FROM sales.SalesInvoices invoice
          WHERE invoice.TenantId = @TenantId
            AND invoice.CompanyId = @CompanyId
            AND invoice.SalesInvoiceId = @DocumentId;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "SALES", "SALES_INVOICE", "RECEIVABLE", documentId, {
        validStatuses: ["POSTED"]
      });
    }

    if (normalized === "SUPPLIER_INVOICE") {
      const currency = await this.supplierInvoiceCurrencyProjection();
      const rows = await this.query<DocumentRow>(
        `
          SELECT
            invoice.SupplierInvoiceId AS DocumentId,
            invoice.SupplierInvoiceNumber AS DocumentNumber,
            invoice.InvoiceDate AS DocumentDate,
            CONCAT(N'Factura proveedor ', invoice.SupplierInvoiceNumber) AS Description,
            ${currency.currencyCodeSql} AS CurrencyCode,
            ${currency.exchangeRateSql} AS ExchangeRate,
            invoice.TotalAmount,
            invoice.TaxAmount,
            CAST(NULL AS uniqueidentifier) AS CostCenterId,
            invoice.Status,
            invoice.IsActive
          FROM purchasing.SupplierInvoices invoice
          ${currency.joinSql}
          WHERE invoice.TenantId = @TenantId
            AND invoice.CompanyId = @CompanyId
            AND invoice.SupplierInvoiceId = @DocumentId;
        `,
        this.documentParameters(context, documentId)
      );

      return this.mapDocument(rows[0], "PURCHASING", "SUPPLIER_INVOICE", "PAYABLE", documentId, {
        validStatuses: ["POSTED"]
      });
    }

    throw new ValidationError(
      "Source module is not supported by the accounting posting engine.",
      { sourceModule },
      "POSTING_SOURCE_UNSUPPORTED"
    );
  }

  async resolveAccounts(context: PostingContextInput, document: PostingDocument) {
    return this.accountResolver.resolveAccounts(context, document);
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

  private normalizeSource(sourceModule: string) {
    // Foundation scope: AR/AP documents, sales invoices and supplier invoices only.
    // Cash, banks, receipts, payments, notes, inventory and transfers are intentionally deferred.
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
    documentId: string,
    rules: { validStatuses: string[] }
  ): PostingDocument {
    if (!row) {
      throw new NotFoundError("Source document was not found.", { documentId, sourceDocumentType }, "POSTING_DOCUMENT_NOT_FOUND");
    }

    if (!row.IsActive) {
      throw new ValidationError("Source document is not active.", { documentId, sourceDocumentType }, "POSTING_DOCUMENT_INACTIVE");
    }
    if (!rules.validStatuses.includes(row.Status)) {
      throw new ValidationError(
        "Source document status is not postable.",
        { documentId, sourceDocumentType, status: row.Status, validStatuses: rules.validStatuses },
        "POSTING_DOCUMENT_STATUS_INVALID"
      );
    }
    if (!row.CurrencyCode || row.CurrencyCode.trim().length !== 3) {
      throw new ValidationError(
        "Source document does not have a valid currency.",
        { documentId, sourceDocumentType },
        "POSTING_DOCUMENT_CURRENCY_REQUIRED"
      );
    }
    if (!row.ExchangeRate || Number(row.ExchangeRate) <= 0) {
      throw new ValidationError(
        "Source document does not have a valid exchange rate.",
        { documentId, sourceDocumentType },
        "POSTING_DOCUMENT_EXCHANGE_RATE_REQUIRED"
      );
    }
    if (Number(row.TotalAmount) <= 0) {
      throw new ValidationError(
        "Source document total must be greater than zero.",
        { documentId, sourceDocumentType },
        "POSTING_DOCUMENT_TOTAL_INVALID"
      );
    }

    return {
      sourceModule,
      sourceDocumentType,
      documentId: row.DocumentId,
      documentNumber: row.DocumentNumber,
      documentDate: this.toDateInput(row.DocumentDate),
      description: row.Description,
      currencyCode: row.CurrencyCode.trim().toUpperCase(),
      exchangeRate: Number(row.ExchangeRate),
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

  private async supplierInvoiceCurrencyProjection() {
    const hasInvoiceCurrency = await this.hasColumn("purchasing.SupplierInvoices", "CurrencyCode");
    const hasInvoiceExchangeRate = await this.hasColumn("purchasing.SupplierInvoices", "ExchangeRate");
    const hasApCurrency = await this.hasColumn("ap.AccountsPayableDocuments", "CurrencyCode");
    const hasApExchangeRate = await this.hasColumn("ap.AccountsPayableDocuments", "ExchangeRate");
    const joinSql =
      hasApCurrency || hasApExchangeRate
        ? `
          LEFT JOIN ap.AccountsPayableDocuments apDocument
            ON apDocument.TenantId = invoice.TenantId
           AND apDocument.CompanyId = invoice.CompanyId
           AND apDocument.SourceDocumentId = invoice.SupplierInvoiceId
           AND apDocument.IsActive = 1
        `
        : "";
    const currencySources: string[] = [];
    const exchangeSources: string[] = [];

    if (hasInvoiceCurrency) currencySources.push("invoice.CurrencyCode");
    if (hasApCurrency) currencySources.push("apDocument.CurrencyCode");
    if (hasInvoiceExchangeRate) exchangeSources.push("invoice.ExchangeRate");
    if (hasApExchangeRate) exchangeSources.push("apDocument.ExchangeRate");

    return {
      joinSql,
      currencyCodeSql: currencySources.length > 0 ? `COALESCE(${currencySources.join(", ")})` : "CAST(NULL AS nvarchar(3))",
      exchangeRateSql: exchangeSources.length > 0 ? `COALESCE(${exchangeSources.join(", ")})` : "CAST(NULL AS decimal(18, 6))"
    };
  }

  private async hasColumn(tableName: string, columnName: string) {
    const rows = await this.query<{ ExistsFlag: number }>(
      `
        SELECT CASE WHEN COL_LENGTH(@TableName, @ColumnName) IS NULL THEN 0 ELSE 1 END AS ExistsFlag;
      `,
      [
        { name: "TableName", value: tableName },
        { name: "ColumnName", value: columnName }
      ]
    );

    return rows[0]?.ExistsFlag === 1;
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
