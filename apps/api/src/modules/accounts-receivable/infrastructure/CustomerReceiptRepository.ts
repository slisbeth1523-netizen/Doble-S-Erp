import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  CustomerReceiptApplicationCreatePayload,
  CustomerReceiptCreatePayload,
  CustomerReceiptListQuery
} from "../validators/customer-receipt.validators.js";

export type CustomerReceiptStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type AccountsReceivableDocumentStatus = "OPEN" | "PARTIALLY_PAID" | "PAID";

export type CustomerReceiptContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type CustomerReceiptCreateInput = CustomerReceiptContextInput & CustomerReceiptCreatePayload;

export type CustomerReceiptApplicationResult = {
  id: string;
  customerReceiptId: string;
  lineNumber: number;
  accountsReceivableDocumentId: string;
  documentNumber: string;
  sourceDocumentNumber?: string;
  documentStatus: AccountsReceivableDocumentStatus;
  documentTotalAmount: number;
  documentPaidAmount: number;
  documentRemainingAmount: number;
  appliedAmount: number;
  notes?: string;
};

export type CustomerReceiptResult = {
  id: string;
  receiptNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  receiptDate: Date;
  status: CustomerReceiptStatus;
  receiptMethod: string;
  totalAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  applications: CustomerReceiptApplicationResult[];
};

type ReceiptSummaryRow = {
  CustomerReceiptId: string;
  ReceiptNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  ReceiptDate: Date;
  Status: CustomerReceiptStatus;
  ReceiptMethod: string;
  TotalAmount: number;
  AppliedAmount: number;
  UnappliedAmount: number;
  ApplicationCount: number;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
};

type ApplicationSummaryRow = {
  CustomerReceiptApplicationId: string;
  CustomerReceiptId: string;
  LineNumber: number;
  AccountsReceivableDocumentId: string;
  DocumentNumber: string;
  SourceDocumentNumber: string | null;
  DocumentStatus: AccountsReceivableDocumentStatus;
  DocumentTotalAmount: number;
  DocumentPaidAmount: number;
  DocumentRemainingAmount: number;
  AppliedAmount: number;
  Notes: string | null;
};

type CustomerRow = {
  CustomerId: string;
};

type ReceiptLockRow = {
  CustomerReceiptId: string;
  ReceiptNumber: string;
  CustomerId: string;
  Status: CustomerReceiptStatus;
  TotalAmount: number;
};

type DocumentLockRow = {
  AccountsReceivableDocumentId: string;
  CustomerId: string;
  Status: AccountsReceivableDocumentStatus;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
};

type ApplicationLockRow = {
  CustomerReceiptApplicationId: string;
  AccountsReceivableDocumentId: string;
  AppliedAmount: number;
};

export class CustomerReceiptRepository extends BaseSqlRepository {
  async createCustomerReceipt(input: CustomerReceiptCreateInput): Promise<CustomerReceiptResult> {
    const receiptId = await this.executeInTransaction(async (transaction) => {
      await this.validateCustomer(transaction, input, input.customerId);

      const id = randomUUID();
      const receiptDate = input.receiptDate ? new Date(input.receiptDate) : new Date();
      const receiptNumber = await this.generateReceiptNumber(transaction, input);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ar.CustomerReceipts (
            CustomerReceiptId,
            TenantId,
            CompanyId,
            ReceiptNumber,
            CustomerId,
            ReceiptDate,
            Status,
            ReceiptMethod,
            TotalAmount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @CustomerReceiptId,
            @TenantId,
            @CompanyId,
            @ReceiptNumber,
            @CustomerId,
            @ReceiptDate,
            'DRAFT',
            'MANUAL',
            @TotalAmount,
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "CustomerReceiptId", value: id },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "ReceiptNumber", value: receiptNumber },
          { name: "CustomerId", value: input.customerId },
          { name: "ReceiptDate", value: receiptDate },
          { name: "TotalAmount", value: input.totalAmount },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return id;
    });

    return this.getCustomerReceipt(input, receiptId);
  }

  async listCustomerReceipts(
    context: CustomerReceiptContextInput,
    query: CustomerReceiptListQuery
  ): Promise<CustomerReceiptResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<ReceiptSummaryRow>(
      `
        SELECT
          CustomerReceiptId,
          ReceiptNumber,
          CustomerId,
          CustomerCode,
          CustomerName,
          ReceiptDate,
          Status,
          ReceiptMethod,
          TotalAmount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          Reference,
          Notes,
          PostedAt
        FROM ar.V_CustomerReceiptSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
          AND (
            @Search IS NULL
            OR ReceiptNumber LIKE @Search
            OR CustomerCode LIKE @Search
            OR CustomerName LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY ReceiptDate DESC, ReceiptNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Status", value: query.status ?? null },
        { name: "CustomerId", value: query.customerId ?? null },
        { name: "Search", value: search },
        { name: "Offset", value: offset },
        { name: "PageSize", value: pageSize }
      ]
    );

    return rows.map((row) => this.mapReceipt(row, []));
  }

  async getCustomerReceipt(context: CustomerReceiptContextInput, customerReceiptId: string): Promise<CustomerReceiptResult> {
    const rows = await this.query<ReceiptSummaryRow>(
      `
        SELECT
          CustomerReceiptId,
          ReceiptNumber,
          CustomerId,
          CustomerCode,
          CustomerName,
          ReceiptDate,
          Status,
          ReceiptMethod,
          TotalAmount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          Reference,
          Notes,
          PostedAt
        FROM ar.V_CustomerReceiptSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerReceiptId = @CustomerReceiptId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerReceiptId", value: customerReceiptId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Customer receipt not found.", { customerReceiptId }, "CUSTOMER_RECEIPT_NOT_FOUND");
    }

    const applications = await this.getCustomerReceiptApplications(context, customerReceiptId);
    return this.mapReceipt(row, applications);
  }

  async addApplication(
    context: CustomerReceiptContextInput,
    customerReceiptId: string,
    payload: CustomerReceiptApplicationCreatePayload
  ): Promise<CustomerReceiptResult> {
    await this.executeInTransaction(async (transaction) => {
      const receipt = await this.lockReceipt(transaction, context, customerReceiptId);
      if (receipt.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "CUSTOMER_RECEIPT_NOT_DRAFT",
          message: "Applications can only be added to DRAFT customer receipts.",
          isOperational: true
        });
      }

      const document = await this.lockAccountsReceivableDocument(
        transaction,
        context,
        payload.accountsReceivableDocumentId
      );

      if (document.CustomerId !== receipt.CustomerId) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_RECEIPT_DOCUMENT_CUSTOMER_MISMATCH",
          message: "The accounts receivable document belongs to a different customer.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_RECEIPT_DOCUMENT_NOT_OPEN",
          message: "Only OPEN or PARTIALLY_PAID accounts receivable documents can be collected.",
          isOperational: true
        });
      }

      if (payload.appliedAmount > Number(document.RemainingAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_RECEIPT_APPLICATION_EXCEEDS_BALANCE",
          message: "Applied amount cannot exceed the document pending balance.",
          isOperational: true
        });
      }

      const existingRows = await this.queryInTransaction<{
        CustomerReceiptApplicationId: string;
        AppliedAmount: number;
      }>(
        transaction,
        `
          SELECT CustomerReceiptApplicationId, AppliedAmount
          FROM ar.CustomerReceiptApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE CustomerReceiptId = @CustomerReceiptId
            AND AccountsReceivableDocumentId = @AccountsReceivableDocumentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "CustomerReceiptId", value: customerReceiptId },
          { name: "AccountsReceivableDocumentId", value: payload.accountsReceivableDocumentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      const existing = existingRows[0];

      const totalAppliedRows = await this.queryInTransaction<{ TotalApplied: number }>(
        transaction,
        `
          SELECT COALESCE(SUM(AppliedAmount), 0) AS TotalApplied
          FROM ar.CustomerReceiptApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE CustomerReceiptId = @CustomerReceiptId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "CustomerReceiptId", value: customerReceiptId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      const currentTotalApplied = Number(totalAppliedRows[0]?.TotalApplied ?? 0);
      const currentAmountForDocument = Number(existing?.AppliedAmount ?? 0);
      const nextTotalApplied = currentTotalApplied - currentAmountForDocument + payload.appliedAmount;

      if (nextTotalApplied > Number(receipt.TotalAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_RECEIPT_APPLICATIONS_EXCEED_RECEIPT_TOTAL",
          message: "The sum of applications cannot exceed the receipt total.",
          isOperational: true
        });
      }

      if (existing) {
        await this.queryInTransaction(
          transaction,
          `
            UPDATE ar.CustomerReceiptApplications
            SET AppliedAmount = @AppliedAmount,
                Notes = @Notes,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE CustomerReceiptApplicationId = @CustomerReceiptApplicationId;
          `,
          [
            { name: "CustomerReceiptApplicationId", value: existing.CustomerReceiptApplicationId },
            { name: "AppliedAmount", value: payload.appliedAmount },
            { name: "Notes", value: payload.notes ?? null },
            { name: "UserId", value: context.userId ?? null }
          ]
        );
      } else {
        const lineRows = await this.queryInTransaction<{ NextLine: number }>(
          transaction,
          `
            SELECT COALESCE(MAX(LineNumber), 0) + 1 AS NextLine
            FROM ar.CustomerReceiptApplications
            WHERE CustomerReceiptId = @CustomerReceiptId;
          `,
          [{ name: "CustomerReceiptId", value: customerReceiptId }]
        );

        await this.queryInTransaction(
          transaction,
          `
            INSERT INTO ar.CustomerReceiptApplications (
              CustomerReceiptApplicationId,
              CustomerReceiptId,
              TenantId,
              CompanyId,
              LineNumber,
              AccountsReceivableDocumentId,
              AppliedAmount,
              Notes,
              CreatedBy
            )
            VALUES (
              @CustomerReceiptApplicationId,
              @CustomerReceiptId,
              @TenantId,
              @CompanyId,
              @LineNumber,
              @AccountsReceivableDocumentId,
              @AppliedAmount,
              @Notes,
              @UserId
            );
          `,
          [
            { name: "CustomerReceiptApplicationId", value: randomUUID() },
            { name: "CustomerReceiptId", value: customerReceiptId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "LineNumber", value: lineRows[0]?.NextLine ?? 1 },
            { name: "AccountsReceivableDocumentId", value: payload.accountsReceivableDocumentId },
            { name: "AppliedAmount", value: payload.appliedAmount },
            { name: "Notes", value: payload.notes ?? null },
            { name: "UserId", value: context.userId ?? null }
          ]
        );
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE ar.CustomerReceipts
          SET UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE CustomerReceiptId = @CustomerReceiptId;
        `,
        [
          { name: "CustomerReceiptId", value: customerReceiptId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getCustomerReceipt(context, customerReceiptId);
  }

  async postCustomerReceipt(context: CustomerReceiptContextInput, customerReceiptId: string): Promise<CustomerReceiptResult> {
    await this.executeInTransaction(async (transaction) => {
      const receipt = await this.lockReceipt(transaction, context, customerReceiptId);
      if (receipt.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "CUSTOMER_RECEIPT_ALREADY_POSTED",
          message: "Only DRAFT customer receipts can be posted.",
          isOperational: true
        });
      }

      const applications = await this.queryInTransaction<ApplicationLockRow>(
        transaction,
        `
          SELECT CustomerReceiptApplicationId, AccountsReceivableDocumentId, AppliedAmount
          FROM ar.CustomerReceiptApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE CustomerReceiptId = @CustomerReceiptId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
          ORDER BY LineNumber;
        `,
        [
          { name: "CustomerReceiptId", value: customerReceiptId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      if (!applications.length) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_RECEIPT_HAS_NO_APPLICATIONS",
          message: "Customer receipt must have at least one application before posting.",
          isOperational: true
        });
      }

      const totalApplied = applications.reduce((sum, application) => sum + Number(application.AppliedAmount), 0);
      if (Math.abs(totalApplied - Number(receipt.TotalAmount)) > 0.0001) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_RECEIPT_TOTAL_MUST_MATCH_APPLICATIONS",
          message: "Total applied amount must match the customer receipt total before posting.",
          isOperational: true
        });
      }

      for (const application of applications) {
        const document = await this.lockAccountsReceivableDocument(
          transaction,
          context,
          application.AccountsReceivableDocumentId
        );

        if (document.CustomerId !== receipt.CustomerId) {
          throw new AppError({
            statusCode: 400,
            code: "CUSTOMER_RECEIPT_POST_CUSTOMER_MISMATCH",
            message: "Receipt application references a document from another customer.",
            isOperational: true
          });
        }

        if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
          throw new AppError({
            statusCode: 400,
            code: "CUSTOMER_RECEIPT_POST_DOCUMENT_NOT_OPEN",
            message: "Receipt application references a document that is no longer open.",
            isOperational: true
          });
        }

        if (Number(application.AppliedAmount) > Number(document.RemainingAmount)) {
          throw new AppError({
            statusCode: 400,
            code: "CUSTOMER_RECEIPT_POST_EXCEEDS_DOCUMENT_BALANCE",
            message: "Receipt application exceeds the current document balance.",
            isOperational: true
          });
        }

        const nextPaidAmount = Number(document.PaidAmount) + Number(application.AppliedAmount);
        const nextStatus: AccountsReceivableDocumentStatus =
          Number(document.TotalAmount) - nextPaidAmount <= 0.0001 ? "PAID" : "PARTIALLY_PAID";

        await this.queryInTransaction(
          transaction,
          `
            UPDATE ar.AccountsReceivableDocuments
            SET PaidAmount = @PaidAmount,
                Status = @Status,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE AccountsReceivableDocumentId = @AccountsReceivableDocumentId
              AND TenantId = @TenantId
              AND CompanyId = @CompanyId;
          `,
          [
            { name: "AccountsReceivableDocumentId", value: document.AccountsReceivableDocumentId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "PaidAmount", value: nextPaidAmount },
            { name: "Status", value: nextStatus },
            { name: "UserId", value: context.userId ?? null }
          ]
        );
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE ar.CustomerReceipts
          SET Status = 'POSTED',
              PostedAt = SYSUTCDATETIME(),
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE CustomerReceiptId = @CustomerReceiptId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND Status = 'DRAFT';
        `,
        [
          { name: "CustomerReceiptId", value: customerReceiptId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getCustomerReceipt(context, customerReceiptId);
  }

  private async validateCustomer(
    transaction: sql.Transaction,
    context: CustomerReceiptContextInput,
    customerId: string
  ): Promise<CustomerRow> {
    const rows = await this.queryInTransaction<CustomerRow>(
      transaction,
      `
        SELECT CustomerId
        FROM crm.Customers WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerId = @CustomerId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerId", value: customerId }
      ]
    );

    const customer = rows[0];
    if (!customer) {
      throw new NotFoundError("Customer not found.", { customerId }, "CUSTOMER_NOT_FOUND");
    }

    return customer;
  }

  private async generateReceiptNumber(transaction: sql.Transaction, context: CustomerReceiptContextInput): Promise<string> {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const rows = await this.queryInTransaction<{ NextNumber: number }>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS NextNumber
        FROM ar.CustomerReceipts WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ReceiptNumber LIKE @Prefix;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Prefix", value: `REC-${datePart}-%` }
      ]
    );

    const nextNumber = rows[0]?.NextNumber ?? 1;
    return `REC-${datePart}-${String(nextNumber).padStart(4, "0")}`;
  }

  private async lockReceipt(
    transaction: sql.Transaction,
    context: CustomerReceiptContextInput,
    customerReceiptId: string
  ): Promise<ReceiptLockRow> {
    const rows = await this.queryInTransaction<ReceiptLockRow>(
      transaction,
      `
        SELECT CustomerReceiptId, ReceiptNumber, CustomerId, Status, TotalAmount
        FROM ar.CustomerReceipts WITH (UPDLOCK, HOLDLOCK)
        WHERE CustomerReceiptId = @CustomerReceiptId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "CustomerReceiptId", value: customerReceiptId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const receipt = rows[0];
    if (!receipt) {
      throw new NotFoundError("Customer receipt not found.", { customerReceiptId }, "CUSTOMER_RECEIPT_NOT_FOUND");
    }

    return receipt;
  }

  private async lockAccountsReceivableDocument(
    transaction: sql.Transaction,
    context: CustomerReceiptContextInput,
    accountsReceivableDocumentId: string
  ): Promise<DocumentLockRow> {
    const rows = await this.queryInTransaction<DocumentLockRow>(
      transaction,
      `
        SELECT
          AccountsReceivableDocumentId,
          CustomerId,
          Status,
          TotalAmount,
          PaidAmount,
          RemainingAmount
        FROM ar.AccountsReceivableDocuments WITH (UPDLOCK, HOLDLOCK)
        WHERE AccountsReceivableDocumentId = @AccountsReceivableDocumentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "AccountsReceivableDocumentId", value: accountsReceivableDocumentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const document = rows[0];
    if (!document) {
      throw new NotFoundError(
        "Accounts receivable document not found.",
        { accountsReceivableDocumentId },
        "ACCOUNTS_RECEIVABLE_DOCUMENT_NOT_FOUND"
      );
    }

    return document;
  }

  private async getCustomerReceiptApplications(
    context: CustomerReceiptContextInput,
    customerReceiptId: string
  ): Promise<CustomerReceiptApplicationResult[]> {
    const rows = await this.query<ApplicationSummaryRow>(
      `
        SELECT
          CustomerReceiptApplicationId,
          CustomerReceiptId,
          LineNumber,
          AccountsReceivableDocumentId,
          DocumentNumber,
          SourceDocumentNumber,
          DocumentStatus,
          DocumentTotalAmount,
          DocumentPaidAmount,
          DocumentRemainingAmount,
          AppliedAmount,
          Notes
        FROM ar.V_CustomerReceiptApplicationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerReceiptId = @CustomerReceiptId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerReceiptId", value: customerReceiptId }
      ]
    );

    return rows.map((row) => ({
      id: row.CustomerReceiptApplicationId,
      customerReceiptId: row.CustomerReceiptId,
      lineNumber: Number(row.LineNumber),
      accountsReceivableDocumentId: row.AccountsReceivableDocumentId,
      documentNumber: row.DocumentNumber,
      sourceDocumentNumber: row.SourceDocumentNumber ?? undefined,
      documentStatus: row.DocumentStatus,
      documentTotalAmount: Number(row.DocumentTotalAmount),
      documentPaidAmount: Number(row.DocumentPaidAmount),
      documentRemainingAmount: Number(row.DocumentRemainingAmount),
      appliedAmount: Number(row.AppliedAmount),
      notes: row.Notes ?? undefined
    }));
  }

  private mapReceipt(row: ReceiptSummaryRow, applications: CustomerReceiptApplicationResult[]): CustomerReceiptResult {
    return {
      id: row.CustomerReceiptId,
      receiptNumber: row.ReceiptNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      receiptDate: row.ReceiptDate,
      status: row.Status,
      receiptMethod: row.ReceiptMethod,
      totalAmount: Number(row.TotalAmount),
      appliedAmount: Number(row.AppliedAmount),
      unappliedAmount: Number(row.UnappliedAmount),
      applicationCount: Number(row.ApplicationCount),
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      postedAt: row.PostedAt ?? undefined,
      applications
    };
  }

  private async queryInTransaction<TRecord>(
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

export const customerReceiptRepository = new CustomerReceiptRepository();
