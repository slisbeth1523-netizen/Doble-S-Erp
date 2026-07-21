import { randomUUID } from "node:crypto";
import sql from "mssql";

import { ConflictError, NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { PostingContextInput } from "../application/AccountingPostingEngine.js";
import { postingRuleResolver } from "../application/PostingRuleResolver.js";
import type { PostingRuleListQuery, PostingRulePayload } from "../validators/posting-rule.validators.js";

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

export type PostingRuleResult = {
  postingRuleId: string;
  tenantId: string;
  companyId: string;
  ruleCode: string;
  name: string;
  description?: string;
  sourceModule: string;
  sourceDocumentType: string;
  direction: PostingDocument["direction"];
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  taxAccountId?: string;
  taxAccountCode?: string;
  taxAccountName?: string;
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;
  appliesTax: boolean;
  priority: number;
  isDefault: boolean;
  validFrom?: string;
  validTo?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
};

export type ResolvedPostingRule = {
  postingRuleId: string;
  appliesTax: boolean;
  costCenterId?: string;
  validFrom?: string;
  validTo?: string;
  debit: PostingAccount;
  credit: PostingAccount;
  tax?: PostingAccount;
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

type RuleRow = PostingRuleResult;
type CountRow = { totalItems: number };

export class PostingRuleRepository extends BaseSqlRepository {
  constructor(private readonly resolver = postingRuleResolver) {
    super();
  }

  async listRules(context: PostingContextInput, query: PostingRuleListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const offset = (page - 1) * pageSize;
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "Offset", value: offset },
      { name: "Limit", value: pageSize }
    ];
    const where = ["tenantId = @TenantId", "companyId = @CompanyId"];

    if (query.sourceModule) {
      where.push("sourceModule = @SourceModule");
      parameters.push({ name: "SourceModule", value: query.sourceModule });
    }
    if (query.sourceDocumentType) {
      where.push("sourceDocumentType = @SourceDocumentType");
      parameters.push({ name: "SourceDocumentType", value: query.sourceDocumentType });
    }
    if (query.direction) {
      where.push("direction = @Direction");
      parameters.push({ name: "Direction", value: query.direction });
    }
    if (typeof query.isActive === "boolean") {
      where.push("isActive = @IsActive");
      parameters.push({ name: "IsActive", value: query.isActive });
    }
    if (query.search) {
      where.push("(ruleCode LIKE @Search OR name LIKE @Search OR description LIKE @Search)");
      parameters.push({ name: "Search", value: `%${query.search}%` });
    }

    const whereSql = where.join(" AND ");
    const rows = await this.query<RuleRow>(
      `
        SELECT *
        FROM accounting.V_PostingRuleSummary
        WHERE ${whereSql}
        ORDER BY priority ASC, isDefault DESC, ruleCode ASC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      parameters
    );
    const count = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.V_PostingRuleSummary
        WHERE ${whereSql};
      `,
      parameters.filter((parameter) => parameter.name !== "Offset" && parameter.name !== "Limit")
    );

    return {
      records: rows.map((row) => this.mapRule(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize
    };
  }

  async getRule(context: PostingContextInput, postingRuleId: string) {
    const row = await this.getRuleRow(context, postingRuleId);
    if (!row) {
      throw new NotFoundError("Posting rule not found.", { postingRuleId }, "POSTING_RULE_NOT_FOUND");
    }

    return this.mapRule(row);
  }

  async createRule(context: PostingContextInput, payload: PostingRulePayload) {
    const id = await this.executeInTransaction(async (transaction) => {
      await this.ensureUniqueRuleCode(transaction, context, payload.ruleCode);
      await this.validateConfiguredAccounts(transaction, context, payload);
      if (payload.costCenterId) {
        await this.validateCostCenter(transaction, context, payload.costCenterId);
      }

      const postingRuleId = randomUUID();
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.PostingRules (
            PostingRuleId, TenantId, CompanyId, RuleCode, Name, Description, SourceModule,
            SourceDocumentType, Direction, DebitAccountId, CreditAccountId, TaxAccountId,
            CostCenterId, AppliesTax, Priority, IsDefault, ValidFrom, ValidTo, IsActive, CreatedBy
          )
          VALUES (
            @PostingRuleId, @TenantId, @CompanyId, @RuleCode, @Name, @Description, @SourceModule,
            @SourceDocumentType, @Direction, @DebitAccountId, @CreditAccountId, @TaxAccountId,
            @CostCenterId, @AppliesTax, @Priority, @IsDefault, @ValidFrom, @ValidTo, @IsActive, @UserId
          );
        `,
        this.ruleParameters(context, payload, postingRuleId)
      );

      return postingRuleId;
    });

    return this.getRule(context, id);
  }

  async updateRule(context: PostingContextInput, postingRuleId: string, payload: PostingRulePayload) {
    await this.executeInTransaction(async (transaction) => {
      await this.lockRule(transaction, context, postingRuleId);
      await this.ensureUniqueRuleCode(transaction, context, payload.ruleCode, postingRuleId);
      await this.validateConfiguredAccounts(transaction, context, payload);
      if (payload.costCenterId) {
        await this.validateCostCenter(transaction, context, payload.costCenterId);
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.PostingRules
             SET RuleCode = @RuleCode,
                 Name = @Name,
                 Description = @Description,
                 SourceModule = @SourceModule,
                 SourceDocumentType = @SourceDocumentType,
                 Direction = @Direction,
                 DebitAccountId = @DebitAccountId,
                 CreditAccountId = @CreditAccountId,
                 TaxAccountId = @TaxAccountId,
                 CostCenterId = @CostCenterId,
                 AppliesTax = @AppliesTax,
                 Priority = @Priority,
                 IsDefault = @IsDefault,
                 ValidFrom = @ValidFrom,
                 ValidTo = @ValidTo,
                 IsActive = @IsActive,
                 UpdatedAt = SYSUTCDATETIME(),
                 UpdatedBy = @UserId
           WHERE PostingRuleId = @PostingRuleId
             AND TenantId = @TenantId
             AND CompanyId = @CompanyId;
        `,
        this.ruleParameters(context, payload, postingRuleId)
      );
    });

    return this.getRule(context, postingRuleId);
  }

  async deleteRule(context: PostingContextInput, postingRuleId: string) {
    await this.executeInTransaction(async (transaction) => {
      await this.lockRule(transaction, context, postingRuleId);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.PostingRules
             SET IsActive = 0,
                 UpdatedAt = SYSUTCDATETIME(),
                 UpdatedBy = @UserId
           WHERE PostingRuleId = @PostingRuleId
             AND TenantId = @TenantId
             AND CompanyId = @CompanyId;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "PostingRuleId", value: postingRuleId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getRule(context, postingRuleId);
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
    return this.resolver.resolveAccounts(this, context, document);
  }

  async listRulesForResolution(context: PostingContextInput, document: PostingDocument): Promise<ResolvedPostingRule[]> {
    const rows = await this.query<{
      PostingRuleId: string;
      AppliesTax: boolean;
      CostCenterId: string | null;
      ValidFrom: Date | string | null;
      ValidTo: Date | string | null;
      DebitAccountId: string;
      DebitAccountCode: string;
      DebitAccountName: string;
      DebitAccountType: string;
      CreditAccountId: string;
      CreditAccountCode: string;
      CreditAccountName: string;
      CreditAccountType: string;
      TaxAccountId: string | null;
      TaxAccountCode: string | null;
      TaxAccountName: string | null;
      TaxAccountType: string | null;
    }>(
      `
        SELECT
          postingRule.PostingRuleId,
          postingRule.AppliesTax,
          postingRule.CostCenterId,
          postingRule.ValidFrom,
          postingRule.ValidTo,
          debit.AccountId AS DebitAccountId,
          debit.Code AS DebitAccountCode,
          debit.Name AS DebitAccountName,
          debit.AccountType AS DebitAccountType,
          credit.AccountId AS CreditAccountId,
          credit.Code AS CreditAccountCode,
          credit.Name AS CreditAccountName,
          credit.AccountType AS CreditAccountType,
          tax.AccountId AS TaxAccountId,
          tax.Code AS TaxAccountCode,
          tax.Name AS TaxAccountName,
          tax.AccountType AS TaxAccountType
        FROM accounting.PostingRules postingRule
        INNER JOIN accounting.Accounts debit ON debit.AccountId = postingRule.DebitAccountId
        INNER JOIN accounting.Accounts credit ON credit.AccountId = postingRule.CreditAccountId
        LEFT JOIN accounting.Accounts tax ON tax.AccountId = postingRule.TaxAccountId
        WHERE postingRule.TenantId = @TenantId
          AND postingRule.CompanyId = @CompanyId
          AND postingRule.SourceModule = @SourceModule
          AND postingRule.SourceDocumentType = @SourceDocumentType
          AND postingRule.Direction = @Direction
          AND postingRule.IsActive = 1
          AND debit.IsActive = 1
          AND debit.IsBlocked = 0
          AND debit.AllowsPosting = 1
          AND credit.IsActive = 1
          AND credit.IsBlocked = 0
          AND credit.AllowsPosting = 1
          AND (tax.AccountId IS NULL OR (tax.IsActive = 1 AND tax.IsBlocked = 0 AND tax.AllowsPosting = 1))
        ORDER BY postingRule.Priority ASC, postingRule.IsDefault DESC, postingRule.CreatedAt ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SourceModule", value: document.sourceModule },
        { name: "SourceDocumentType", value: document.sourceDocumentType },
        { name: "Direction", value: document.direction }
      ]
    );

    return rows.map((row) => ({
      postingRuleId: row.PostingRuleId,
      appliesTax: Boolean(row.AppliesTax),
      costCenterId: row.CostCenterId ?? undefined,
      validFrom: row.ValidFrom ? this.toDateInput(row.ValidFrom) : undefined,
      validTo: row.ValidTo ? this.toDateInput(row.ValidTo) : undefined,
      debit: {
        accountId: row.DebitAccountId,
        code: row.DebitAccountCode,
        name: row.DebitAccountName,
        accountType: row.DebitAccountType
      },
      credit: {
        accountId: row.CreditAccountId,
        code: row.CreditAccountCode,
        name: row.CreditAccountName,
        accountType: row.CreditAccountType
      },
      tax: row.TaxAccountId
        ? {
            accountId: row.TaxAccountId,
            code: row.TaxAccountCode ?? "",
            name: row.TaxAccountName ?? "",
            accountType: row.TaxAccountType ?? ""
          }
        : undefined
    }));
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

  private mapRule(row: RuleRow): PostingRuleResult {
    return {
      postingRuleId: row.postingRuleId,
      tenantId: row.tenantId,
      companyId: row.companyId,
      ruleCode: row.ruleCode,
      name: row.name,
      description: row.description ?? undefined,
      sourceModule: row.sourceModule,
      sourceDocumentType: row.sourceDocumentType,
      direction: row.direction,
      debitAccountId: row.debitAccountId,
      debitAccountCode: row.debitAccountCode,
      debitAccountName: row.debitAccountName,
      creditAccountId: row.creditAccountId,
      creditAccountCode: row.creditAccountCode,
      creditAccountName: row.creditAccountName,
      taxAccountId: row.taxAccountId ?? undefined,
      taxAccountCode: row.taxAccountCode ?? undefined,
      taxAccountName: row.taxAccountName ?? undefined,
      costCenterId: row.costCenterId ?? undefined,
      costCenterCode: row.costCenterCode ?? undefined,
      costCenterName: row.costCenterName ?? undefined,
      appliesTax: Boolean(row.appliesTax),
      priority: Number(row.priority),
      isDefault: Boolean(row.isDefault),
      validFrom: row.validFrom ? this.toDateInput(row.validFrom) : undefined,
      validTo: row.validTo ? this.toDateInput(row.validTo) : undefined,
      isActive: Boolean(row.isActive),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined
    };
  }

  private async getRuleRow(context: PostingContextInput, postingRuleId: string) {
    const rows = await this.query<RuleRow>(
      `
        SELECT *
        FROM accounting.V_PostingRuleSummary
        WHERE tenantId = @TenantId
          AND companyId = @CompanyId
          AND postingRuleId = @PostingRuleId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PostingRuleId", value: postingRuleId }
      ]
    );

    return rows[0];
  }

  private async lockRule(transaction: sql.Transaction, context: PostingContextInput, postingRuleId: string) {
    const rows = await this.queryInTransaction<{ PostingRuleId: string }>(
      transaction,
      `
        SELECT PostingRuleId
        FROM accounting.PostingRules WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PostingRuleId = @PostingRuleId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PostingRuleId", value: postingRuleId }
      ]
    );

    if (!rows[0]) {
      throw new NotFoundError("Posting rule not found.", { postingRuleId }, "POSTING_RULE_NOT_FOUND");
    }
  }

  private async ensureUniqueRuleCode(
    transaction: sql.Transaction,
    context: PostingContextInput,
    ruleCode: string,
    excludeId?: string
  ) {
    const rows = await this.queryInTransaction<{ ExistingId: string }>(
      transaction,
      `
        SELECT TOP (1) PostingRuleId AS ExistingId
        FROM accounting.PostingRules WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND RuleCode = @RuleCode
          ${excludeId ? "AND PostingRuleId <> @ExcludeId" : ""};
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "RuleCode", value: ruleCode },
        ...(excludeId ? [{ name: "ExcludeId", value: excludeId }] : [])
      ]
    );

    if (rows[0]) {
      throw new ConflictError("Posting rule code already exists.", { ruleCode }, "POSTING_RULE_CODE_EXISTS");
    }
  }

  private async validateConfiguredAccounts(
    transaction: sql.Transaction,
    context: PostingContextInput,
    payload: PostingRulePayload
  ) {
    const validationDate = payload.validFrom ?? new Date().toISOString().slice(0, 10);
    await this.validateAccountInTransaction(transaction, context, payload.debitAccountId, validationDate);
    await this.validateAccountInTransaction(transaction, context, payload.creditAccountId, validationDate);
    if (payload.taxAccountId) {
      await this.validateAccountInTransaction(transaction, context, payload.taxAccountId, validationDate);
    }
  }

  private async validateCostCenter(transaction: sql.Transaction, context: PostingContextInput, costCenterId: string) {
    const rows = await this.queryInTransaction<{ CostCenterId: string }>(
      transaction,
      `
        SELECT CostCenterId
        FROM accounting.CostCenters WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CostCenterId = @CostCenterId
          AND IsActive = 1
          AND AllowsPosting = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CostCenterId", value: costCenterId }
      ]
    );

    if (!rows[0]) {
      throw new ValidationError("Posting rule cost center is not available.", { costCenterId }, "POSTING_RULE_COST_CENTER_INVALID");
    }
  }

  private ruleParameters(context: PostingContextInput, payload: PostingRulePayload, postingRuleId: string): SqlParameter[] {
    return [
      { name: "PostingRuleId", value: postingRuleId },
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "RuleCode", value: payload.ruleCode },
      { name: "Name", value: payload.name },
      { name: "Description", value: payload.description ?? null },
      { name: "SourceModule", value: payload.sourceModule },
      { name: "SourceDocumentType", value: payload.sourceDocumentType },
      { name: "Direction", value: payload.direction },
      { name: "DebitAccountId", value: payload.debitAccountId },
      { name: "CreditAccountId", value: payload.creditAccountId },
      { name: "TaxAccountId", value: payload.taxAccountId ?? null },
      { name: "CostCenterId", value: payload.costCenterId ?? null },
      { name: "AppliesTax", value: payload.appliesTax },
      { name: "Priority", value: payload.priority },
      { name: "IsDefault", value: payload.isDefault },
      { name: "ValidFrom", value: payload.validFrom ?? null },
      { name: "ValidTo", value: payload.validTo ?? null },
      { name: "IsActive", value: payload.isActive },
      { name: "UserId", value: context.userId ?? null }
    ];
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
