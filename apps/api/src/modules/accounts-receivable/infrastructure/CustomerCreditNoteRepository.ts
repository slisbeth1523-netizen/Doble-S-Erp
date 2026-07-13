import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  CustomerCreditNoteApplicationCreatePayload,
  CustomerCreditNoteCreatePayload,
  CustomerCreditNoteListQuery
} from "../validators/customer-credit-note.validators.js";

export type CustomerCreditNoteStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type AccountsReceivableDocumentStatus = "OPEN" | "PARTIALLY_PAID" | "PAID";

export type CustomerCreditNoteContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type CustomerCreditNoteCreateInput = CustomerCreditNoteContextInput & CustomerCreditNoteCreatePayload;

export type CustomerCreditNoteApplicationResult = {
  id: string;
  customerCreditNoteId: string;
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

export type CustomerCreditNoteResult = {
  id: string;
  creditNoteNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  creditNoteDate: Date;
  status: CustomerCreditNoteStatus;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  applications: CustomerCreditNoteApplicationResult[];
};

type CreditNoteSummaryRow = {
  CustomerCreditNoteId: string;
  CreditNoteNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  CreditNoteDate: Date;
  Status: CustomerCreditNoteStatus;
  Amount: number;
  AppliedAmount: number;
  UnappliedAmount: number;
  ApplicationCount: number;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
};

type ApplicationSummaryRow = {
  CustomerCreditNoteApplicationId: string;
  CustomerCreditNoteId: string;
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

type CreditNoteLockRow = {
  CustomerCreditNoteId: string;
  CreditNoteNumber: string;
  CustomerId: string;
  Status: CustomerCreditNoteStatus;
  Amount: number;
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
  CustomerCreditNoteApplicationId: string;
  AccountsReceivableDocumentId: string;
  AppliedAmount: number;
};

export class CustomerCreditNoteRepository extends BaseSqlRepository {
  async createCustomerCreditNote(input: CustomerCreditNoteCreateInput): Promise<CustomerCreditNoteResult> {
    const noteId = await this.executeInTransaction(async (transaction) => {
      await this.validateCustomer(transaction, input, input.customerId);

      const id = randomUUID();
      const creditNoteDate = input.creditNoteDate ? new Date(input.creditNoteDate) : new Date();
      const creditNoteNumber = await this.generateCreditNoteNumber(transaction, input);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ar.CustomerCreditNotes (
            CustomerCreditNoteId,
            TenantId,
            CompanyId,
            CreditNoteNumber,
            CustomerId,
            CreditNoteDate,
            Status,
            Amount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @CustomerCreditNoteId,
            @TenantId,
            @CompanyId,
            @CreditNoteNumber,
            @CustomerId,
            @CreditNoteDate,
            'DRAFT',
            @Amount,
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "CustomerCreditNoteId", value: id },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "CreditNoteNumber", value: creditNoteNumber },
          { name: "CustomerId", value: input.customerId },
          { name: "CreditNoteDate", value: creditNoteDate },
          { name: "Amount", value: input.amount },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return id;
    });

    return this.getCustomerCreditNote(input, noteId);
  }

  async listCustomerCreditNotes(
    context: CustomerCreditNoteContextInput,
    query: CustomerCreditNoteListQuery
  ): Promise<CustomerCreditNoteResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<CreditNoteSummaryRow>(
      `
        SELECT
          CustomerCreditNoteId,
          CreditNoteNumber,
          CustomerId,
          CustomerCode,
          CustomerName,
          CreditNoteDate,
          Status,
          Amount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          Reference,
          Notes,
          PostedAt
        FROM ar.V_CustomerCreditNoteSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
          AND (
            @Search IS NULL
            OR CreditNoteNumber LIKE @Search
            OR CustomerCode LIKE @Search
            OR CustomerName LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY CreditNoteDate DESC, CreditNoteNumber DESC
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

    return rows.map((row) => this.mapCreditNote(row, []));
  }

  async getCustomerCreditNote(
    context: CustomerCreditNoteContextInput,
    customerCreditNoteId: string
  ): Promise<CustomerCreditNoteResult> {
    const rows = await this.query<CreditNoteSummaryRow>(
      `
        SELECT
          CustomerCreditNoteId,
          CreditNoteNumber,
          CustomerId,
          CustomerCode,
          CustomerName,
          CreditNoteDate,
          Status,
          Amount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          Reference,
          Notes,
          PostedAt
        FROM ar.V_CustomerCreditNoteSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerCreditNoteId = @CustomerCreditNoteId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerCreditNoteId", value: customerCreditNoteId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError(
        "Customer credit note not found.",
        { customerCreditNoteId },
        "CUSTOMER_CREDIT_NOTE_NOT_FOUND"
      );
    }

    const applications = await this.getCustomerCreditNoteApplications(context, customerCreditNoteId);
    return this.mapCreditNote(row, applications);
  }

  async addApplication(
    context: CustomerCreditNoteContextInput,
    customerCreditNoteId: string,
    payload: CustomerCreditNoteApplicationCreatePayload
  ): Promise<CustomerCreditNoteResult> {
    await this.executeInTransaction(async (transaction) => {
      const note = await this.lockCreditNote(transaction, context, customerCreditNoteId);
      if (note.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "CUSTOMER_CREDIT_NOTE_NOT_DRAFT",
          message: "Applications can only be added to DRAFT customer credit notes.",
          isOperational: true
        });
      }

      const document = await this.lockAccountsReceivableDocument(
        transaction,
        context,
        payload.accountsReceivableDocumentId
      );

      if (document.CustomerId !== note.CustomerId) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_CREDIT_NOTE_DOCUMENT_CUSTOMER_MISMATCH",
          message: "The accounts receivable document belongs to a different customer.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_CREDIT_NOTE_DOCUMENT_NOT_OPEN",
          message: "Only OPEN or PARTIALLY_PAID accounts receivable documents can receive credit notes.",
          isOperational: true
        });
      }

      if (payload.appliedAmount > Number(document.RemainingAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_CREDIT_NOTE_APPLICATION_EXCEEDS_BALANCE",
          message: "Applied amount cannot exceed the document pending balance.",
          isOperational: true
        });
      }

      const existingRows = await this.queryInTransaction<{
        CustomerCreditNoteApplicationId: string;
        AppliedAmount: number;
      }>(
        transaction,
        `
          SELECT CustomerCreditNoteApplicationId, AppliedAmount
          FROM ar.CustomerCreditNoteApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE CustomerCreditNoteId = @CustomerCreditNoteId
            AND AccountsReceivableDocumentId = @AccountsReceivableDocumentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
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
          FROM ar.CustomerCreditNoteApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE CustomerCreditNoteId = @CustomerCreditNoteId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      const currentTotalApplied = Number(totalAppliedRows[0]?.TotalApplied ?? 0);
      const currentAmountForDocument = Number(existing?.AppliedAmount ?? 0);
      const nextTotalApplied = currentTotalApplied - currentAmountForDocument + payload.appliedAmount;

      if (nextTotalApplied > Number(note.Amount)) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_CREDIT_NOTE_APPLICATIONS_EXCEED_NOTE_AMOUNT",
          message: "The sum of applications cannot exceed the credit note amount.",
          isOperational: true
        });
      }

      if (existing) {
        await this.queryInTransaction(
          transaction,
          `
            UPDATE ar.CustomerCreditNoteApplications
            SET AppliedAmount = @AppliedAmount,
                Notes = @Notes,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE CustomerCreditNoteApplicationId = @CustomerCreditNoteApplicationId;
          `,
          [
            { name: "CustomerCreditNoteApplicationId", value: existing.CustomerCreditNoteApplicationId },
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
            FROM ar.CustomerCreditNoteApplications
            WHERE CustomerCreditNoteId = @CustomerCreditNoteId;
          `,
          [{ name: "CustomerCreditNoteId", value: customerCreditNoteId }]
        );

        await this.queryInTransaction(
          transaction,
          `
            INSERT INTO ar.CustomerCreditNoteApplications (
              CustomerCreditNoteApplicationId,
              CustomerCreditNoteId,
              TenantId,
              CompanyId,
              LineNumber,
              AccountsReceivableDocumentId,
              AppliedAmount,
              Notes,
              CreatedBy
            )
            VALUES (
              @CustomerCreditNoteApplicationId,
              @CustomerCreditNoteId,
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
            { name: "CustomerCreditNoteApplicationId", value: randomUUID() },
            { name: "CustomerCreditNoteId", value: customerCreditNoteId },
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
          UPDATE ar.CustomerCreditNotes
          SET UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE CustomerCreditNoteId = @CustomerCreditNoteId;
        `,
        [
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getCustomerCreditNote(context, customerCreditNoteId);
  }

  async postCustomerCreditNote(
    context: CustomerCreditNoteContextInput,
    customerCreditNoteId: string
  ): Promise<CustomerCreditNoteResult> {
    await this.executeInTransaction(async (transaction) => {
      const note = await this.lockCreditNote(transaction, context, customerCreditNoteId);
      if (note.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "CUSTOMER_CREDIT_NOTE_ALREADY_POSTED",
          message: "Only DRAFT customer credit notes can be posted.",
          isOperational: true
        });
      }

      const applications = await this.queryInTransaction<ApplicationLockRow>(
        transaction,
        `
          SELECT CustomerCreditNoteApplicationId, AccountsReceivableDocumentId, AppliedAmount
          FROM ar.CustomerCreditNoteApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE CustomerCreditNoteId = @CustomerCreditNoteId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
          ORDER BY LineNumber;
        `,
        [
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      if (!applications.length) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_CREDIT_NOTE_HAS_NO_APPLICATIONS",
          message: "Customer credit note must have at least one application before posting.",
          isOperational: true
        });
      }

      const totalApplied = applications.reduce((sum, application) => sum + Number(application.AppliedAmount), 0);
      if (Math.abs(totalApplied - Number(note.Amount)) > 0.0001) {
        throw new AppError({
          statusCode: 400,
          code: "CUSTOMER_CREDIT_NOTE_TOTAL_MUST_MATCH_APPLICATIONS",
          message: "Total applied amount must match the customer credit note amount before posting.",
          isOperational: true
        });
      }

      for (const application of applications) {
        const document = await this.lockAccountsReceivableDocument(
          transaction,
          context,
          application.AccountsReceivableDocumentId
        );

        if (document.CustomerId !== note.CustomerId) {
          throw new AppError({
            statusCode: 400,
            code: "CUSTOMER_CREDIT_NOTE_POST_CUSTOMER_MISMATCH",
            message: "Credit note application references a document from another customer.",
            isOperational: true
          });
        }

        if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
          throw new AppError({
            statusCode: 400,
            code: "CUSTOMER_CREDIT_NOTE_POST_DOCUMENT_NOT_OPEN",
            message: "Credit note application references a document that is no longer open.",
            isOperational: true
          });
        }

        if (Number(application.AppliedAmount) > Number(document.RemainingAmount)) {
          throw new AppError({
            statusCode: 400,
            code: "CUSTOMER_CREDIT_NOTE_POST_EXCEEDS_DOCUMENT_BALANCE",
            message: "Credit note application exceeds the current document balance.",
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
          UPDATE ar.CustomerCreditNotes
          SET Status = 'POSTED',
              PostedAt = SYSUTCDATETIME(),
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE CustomerCreditNoteId = @CustomerCreditNoteId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND Status = 'DRAFT';
        `,
        [
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getCustomerCreditNote(context, customerCreditNoteId);
  }

  private async validateCustomer(
    transaction: sql.Transaction,
    context: CustomerCreditNoteContextInput,
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

  private async generateCreditNoteNumber(
    transaction: sql.Transaction,
    context: CustomerCreditNoteContextInput
  ): Promise<string> {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const rows = await this.queryInTransaction<{ NextNumber: number }>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS NextNumber
        FROM ar.CustomerCreditNotes WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CreditNoteNumber LIKE @Prefix;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Prefix", value: `NC-CXC-${datePart}-%` }
      ]
    );

    const nextNumber = rows[0]?.NextNumber ?? 1;
    return `NC-CXC-${datePart}-${String(nextNumber).padStart(4, "0")}`;
  }

  private async lockCreditNote(
    transaction: sql.Transaction,
    context: CustomerCreditNoteContextInput,
    customerCreditNoteId: string
  ): Promise<CreditNoteLockRow> {
    const rows = await this.queryInTransaction<CreditNoteLockRow>(
      transaction,
      `
        SELECT CustomerCreditNoteId, CreditNoteNumber, CustomerId, Status, Amount
        FROM ar.CustomerCreditNotes WITH (UPDLOCK, HOLDLOCK)
        WHERE CustomerCreditNoteId = @CustomerCreditNoteId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "CustomerCreditNoteId", value: customerCreditNoteId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const note = rows[0];
    if (!note) {
      throw new NotFoundError(
        "Customer credit note not found.",
        { customerCreditNoteId },
        "CUSTOMER_CREDIT_NOTE_NOT_FOUND"
      );
    }

    return note;
  }

  private async lockAccountsReceivableDocument(
    transaction: sql.Transaction,
    context: CustomerCreditNoteContextInput,
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

  private async getCustomerCreditNoteApplications(
    context: CustomerCreditNoteContextInput,
    customerCreditNoteId: string
  ): Promise<CustomerCreditNoteApplicationResult[]> {
    const rows = await this.query<ApplicationSummaryRow>(
      `
        SELECT
          CustomerCreditNoteApplicationId,
          CustomerCreditNoteId,
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
        FROM ar.V_CustomerCreditNoteApplicationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerCreditNoteId = @CustomerCreditNoteId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerCreditNoteId", value: customerCreditNoteId }
      ]
    );

    return rows.map((row) => ({
      id: row.CustomerCreditNoteApplicationId,
      customerCreditNoteId: row.CustomerCreditNoteId,
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

  private mapCreditNote(
    row: CreditNoteSummaryRow,
    applications: CustomerCreditNoteApplicationResult[]
  ): CustomerCreditNoteResult {
    return {
      id: row.CustomerCreditNoteId,
      creditNoteNumber: row.CreditNoteNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      creditNoteDate: row.CreditNoteDate,
      status: row.Status,
      amount: Number(row.Amount),
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

export const customerCreditNoteRepository = new CustomerCreditNoteRepository();
