import { createHash, randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SalesCreditNoteCreateFromReturnPayload,
  SalesCreditNoteCreditableReturnListQuery,
  SalesCreditNoteListQuery,
  SalesCreditNotePostPayload
} from "../validators/sales-credit-note.validators.js";

export type SalesCreditNoteContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SalesCreditNoteContext = SalesCreditNoteContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type SalesCreditNoteStatus = "DRAFT" | "POSTED" | "CANCELLED";

type CreditableReturnRow = {
  SalesReturnCreditNotePendingId: string;
  TenantId: string;
  CompanyId: string;
  SalesReturnId: string;
  ReturnNumber: string;
  SalesInvoiceId: string;
  InvoiceNumber: string;
  AccountsReceivableDocumentId: string;
  AccountsReceivableDocumentNumber: string;
  AccountsReceivableStatus: string;
  AccountsReceivableRemainingAmount: number;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  ReturnedQuantity: number;
  ReturnedAmount: number;
  ReservedCreditAmount: number;
  PostedCreditAmount: number;
  PendingCreditAmount: number;
  CreditNoteCount: number;
};

type IntegrationRow = {
  SalesCreditNoteIntegrationId: string;
  CustomerCreditNoteId: string;
  CreditNoteNumber: string;
  SalesReturnId: string;
  ReturnNumber: string;
  SalesInvoiceId: string;
  InvoiceNumber: string;
  AccountsReceivableDocumentId: string;
  AccountsReceivableDocumentNumber: string;
  AccountsReceivableStatus: string;
  AccountsReceivableTotalAmount: number;
  AccountsReceivablePaidAmount: number;
  AccountsReceivableRemainingAmount: number;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  CreditNoteDate: Date;
  Status: SalesCreditNoteStatus;
  Amount: number;
  AppliedAmount: number;
  UnappliedAmount: number;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
};

type SourceLockRow = {
  SalesReturnId: string;
  ReturnNumber: string;
  SalesInvoiceId: string;
  InvoiceNumber: string;
  AccountsReceivableDocumentId: string;
  AccountsReceivableDocumentNumber: string;
  AccountsReceivableStatus: "OPEN" | "PARTIALLY_PAID" | "PAID" | "CANCELLED";
  AccountsReceivableTotalAmount: number;
  AccountsReceivablePaidAmount: number;
  AccountsReceivableRemainingAmount: number;
  CustomerId: string;
  ReturnedAmount: number;
  ReturnedQuantity: number;
  ReservedCreditAmount: number;
  PendingCreditAmount: number;
};

type OperationRow = {
  SalesCreditNoteOperationId: string;
  RequestHash: string;
  CustomerCreditNoteId: string | null;
  ResultStatus: SalesCreditNoteStatus;
};

type CreditNoteLockRow = {
  CustomerCreditNoteId: string;
  CreditNoteNumber: string;
  SourceSalesReturnId: string;
  SourceSalesInvoiceId: string;
  CustomerId: string;
  Status: SalesCreditNoteStatus;
  Amount: number;
};

type ApplicationLockRow = {
  CustomerCreditNoteApplicationId: string;
  AccountsReceivableDocumentId: string;
  AppliedAmount: number;
};

export type SalesCreditableReturnResult = {
  id: string;
  salesReturnId: string;
  returnNumber: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  accountsReceivableDocumentId: string;
  accountsReceivableDocumentNumber: string;
  accountsReceivableStatus: string;
  accountsReceivableRemainingAmount: number;
  customerId: string;
  customerCode: string;
  customerName: string;
  returnedQuantity: number;
  returnedAmount: number;
  reservedCreditAmount: number;
  postedCreditAmount: number;
  pendingCreditAmount: number;
  creditNoteCount: number;
};

export type SalesCreditNoteIntegrationResult = {
  id: string;
  customerCreditNoteId: string;
  creditNoteNumber: string;
  salesReturnId: string;
  returnNumber: string;
  salesInvoiceId: string;
  invoiceNumber: string;
  accountsReceivableDocumentId: string;
  accountsReceivableDocumentNumber: string;
  accountsReceivableStatus: string;
  accountsReceivableTotalAmount: number;
  accountsReceivablePaidAmount: number;
  accountsReceivableRemainingAmount: number;
  customerId: string;
  customerCode: string;
  customerName: string;
  creditNoteDate: Date;
  status: SalesCreditNoteStatus;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  idempotencyReplayed?: boolean;
};

export class SalesCreditNoteRepository extends BaseSqlRepository {
  async listCreditableReturns(
    context: SalesCreditNoteContextInput,
    query: SalesCreditNoteCreditableReturnListQuery
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const records = await this.query<CreditableReturnRow>(
      `
        SELECT *
        FROM sales.V_SalesReturnCreditNotePending
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PendingCreditAmount > 0
          AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
          AND (@SalesInvoiceId IS NULL OR SalesInvoiceId = @SalesInvoiceId)
          AND (@SalesReturnId IS NULL OR SalesReturnId = @SalesReturnId)
          AND (
            @Search IS NULL
            OR ReturnNumber LIKE @Search
            OR InvoiceNumber LIKE @Search
            OR CustomerCode LIKE @Search
            OR CustomerName LIKE @Search
          )
        ORDER BY ReturnNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerId", value: query.customerId ?? null },
        { name: "SalesInvoiceId", value: query.salesInvoiceId ?? null },
        { name: "SalesReturnId", value: query.salesReturnId ?? null },
        { name: "Search", value: search },
        { name: "Offset", value: offset },
        { name: "PageSize", value: pageSize }
      ]
    );

    const counts = await this.query<{ TotalItems: number }>(
      `
        SELECT COUNT(1) AS TotalItems
        FROM sales.V_SalesReturnCreditNotePending
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PendingCreditAmount > 0
          AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
          AND (@SalesInvoiceId IS NULL OR SalesInvoiceId = @SalesInvoiceId)
          AND (@SalesReturnId IS NULL OR SalesReturnId = @SalesReturnId)
          AND (
            @Search IS NULL
            OR ReturnNumber LIKE @Search
            OR InvoiceNumber LIKE @Search
            OR CustomerCode LIKE @Search
            OR CustomerName LIKE @Search
          );
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerId", value: query.customerId ?? null },
        { name: "SalesInvoiceId", value: query.salesInvoiceId ?? null },
        { name: "SalesReturnId", value: query.salesReturnId ?? null },
        { name: "Search", value: search }
      ]
    );

    return {
      records: records.map((row) => this.mapCreditableReturn(row)),
      pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) }
    };
  }

  async listSalesCreditNotes(context: SalesCreditNoteContextInput, query: SalesCreditNoteListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const records = await this.query<IntegrationRow>(
      `
        SELECT *
        FROM sales.V_SalesCreditNoteIntegrationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
          AND (@SalesInvoiceId IS NULL OR SalesInvoiceId = @SalesInvoiceId)
          AND (@SalesReturnId IS NULL OR SalesReturnId = @SalesReturnId)
          AND (
            @Search IS NULL
            OR CreditNoteNumber LIKE @Search
            OR ReturnNumber LIKE @Search
            OR InvoiceNumber LIKE @Search
            OR CustomerCode LIKE @Search
            OR CustomerName LIKE @Search
          )
        ORDER BY CreditNoteDate DESC, CreditNoteNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Status", value: query.status ?? null },
        { name: "CustomerId", value: query.customerId ?? null },
        { name: "SalesInvoiceId", value: query.salesInvoiceId ?? null },
        { name: "SalesReturnId", value: query.salesReturnId ?? null },
        { name: "Search", value: search },
        { name: "Offset", value: offset },
        { name: "PageSize", value: pageSize }
      ]
    );

    const counts = await this.query<{ TotalItems: number }>(
      `
        SELECT COUNT(1) AS TotalItems
        FROM sales.V_SalesCreditNoteIntegrationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
          AND (@SalesInvoiceId IS NULL OR SalesInvoiceId = @SalesInvoiceId)
          AND (@SalesReturnId IS NULL OR SalesReturnId = @SalesReturnId)
          AND (
            @Search IS NULL
            OR CreditNoteNumber LIKE @Search
            OR ReturnNumber LIKE @Search
            OR InvoiceNumber LIKE @Search
            OR CustomerCode LIKE @Search
            OR CustomerName LIKE @Search
          );
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Status", value: query.status ?? null },
        { name: "CustomerId", value: query.customerId ?? null },
        { name: "SalesInvoiceId", value: query.salesInvoiceId ?? null },
        { name: "SalesReturnId", value: query.salesReturnId ?? null },
        { name: "Search", value: search }
      ]
    );

    return {
      records: records.map((row) => this.mapIntegration(row)),
      pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) }
    };
  }

  async getSalesCreditNote(context: SalesCreditNoteContextInput, customerCreditNoteId: string) {
    const rows = await this.query<IntegrationRow>(
      `
        SELECT *
        FROM sales.V_SalesCreditNoteIntegrationSummary
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
      throw new NotFoundError("Sales credit note integration not found.", { customerCreditNoteId }, "SALES_CREDIT_NOTE_NOT_FOUND");
    }

    return this.mapIntegration(row);
  }

  async createFromReturn(context: SalesCreditNoteContextInput, payload: SalesCreditNoteCreateFromReturnPayload) {
    const requestHash = this.hashPayload({
      salesReturnId: payload.salesReturnId,
      amount: payload.amount ?? null,
      creditNoteDate: payload.creditNoteDate ? new Date(payload.creditNoteDate).toISOString() : null,
      reference: payload.reference ?? null,
      notes: payload.notes ?? null
    });

    const noteId = await this.executeInTransaction(async (transaction) => {
      const operation = await this.lockOperation(transaction, context, "CREATE", payload.idempotencyKey);
      if (operation) {
        this.assertSameRequest(operation, requestHash);
        return operation.CustomerCreditNoteId!;
      }

      const source = await this.lockSourceReturn(transaction, context, payload.salesReturnId);
      const requestedAmount = payload.amount ?? Number(source.PendingCreditAmount);
      const maxAmount = Math.min(Number(source.PendingCreditAmount), Number(source.AccountsReceivableRemainingAmount));

      if (requestedAmount <= 0 || requestedAmount - maxAmount > 0.0001) {
        throw new AppError({
          statusCode: 400,
          code: "SALES_CREDIT_NOTE_AMOUNT_EXCEEDS_PENDING",
          message: "Credit note amount cannot exceed the pending returned amount or current accounts receivable balance.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(source.AccountsReceivableStatus)) {
        throw new AppError({
          statusCode: 400,
          code: "SALES_CREDIT_NOTE_AR_DOCUMENT_NOT_OPEN",
          message: "Only OPEN or PARTIALLY_PAID accounts receivable documents can receive sales credit notes.",
          isOperational: true
        });
      }

      const customerCreditNoteId = randomUUID();
      const applicationId = randomUUID();
      const creditNoteNumber = await this.generateCreditNoteNumber(transaction, context);
      const creditNoteDate = payload.creditNoteDate ? new Date(payload.creditNoteDate) : new Date();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ar.CustomerCreditNotes (
            CustomerCreditNoteId, TenantId, CompanyId, CreditNoteNumber, CustomerId,
            CreditNoteDate, Status, Amount, Reference, Notes, SourceType,
            SourceDocumentId, SourceSalesInvoiceId, SourceSalesReturnId, IsActive, CreatedBy
          )
          VALUES (
            @CustomerCreditNoteId, @TenantId, @CompanyId, @CreditNoteNumber, @CustomerId,
            @CreditNoteDate, 'DRAFT', @Amount, @Reference, @Notes, 'SALES_RETURN',
            @SourceDocumentId, @SalesInvoiceId, @SalesReturnId, 1, @UserId
          );
        `,
        [
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "CreditNoteNumber", value: creditNoteNumber },
          { name: "CustomerId", value: source.CustomerId },
          { name: "CreditNoteDate", value: creditNoteDate },
          { name: "Amount", value: requestedAmount },
          { name: "Reference", value: payload.reference ?? source.ReturnNumber },
          { name: "Notes", value: payload.notes ?? `Nota de credito por devolucion ${source.ReturnNumber}` },
          { name: "SourceDocumentId", value: source.SalesReturnId },
          { name: "SalesInvoiceId", value: source.SalesInvoiceId },
          { name: "SalesReturnId", value: source.SalesReturnId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ar.CustomerCreditNoteApplications (
            CustomerCreditNoteApplicationId, CustomerCreditNoteId, TenantId, CompanyId,
            LineNumber, AccountsReceivableDocumentId, AppliedAmount, Notes, CreatedBy
          )
          VALUES (
            @ApplicationId, @CustomerCreditNoteId, @TenantId, @CompanyId,
            1, @AccountsReceivableDocumentId, @AppliedAmount, @Notes, @UserId
          );
        `,
        [
          { name: "ApplicationId", value: applicationId },
          { name: "CustomerCreditNoteId", value: customerCreditNoteId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "AccountsReceivableDocumentId", value: source.AccountsReceivableDocumentId },
          { name: "AppliedAmount", value: requestedAmount },
          { name: "Notes", value: `Aplicacion automatica factura ${source.InvoiceNumber}` },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.insertOperation(transaction, context, {
        operationType: "CREATE",
        idempotencyKey: payload.idempotencyKey,
        requestHash,
        salesReturnId: source.SalesReturnId,
        salesInvoiceId: source.SalesInvoiceId,
        customerCreditNoteId,
        accountsReceivableDocumentId: source.AccountsReceivableDocumentId,
        resultStatus: "DRAFT",
        resultAmount: requestedAmount
      });

      return customerCreditNoteId;
    });

    return this.getSalesCreditNote(context, noteId);
  }

  async postSalesCreditNote(
    context: SalesCreditNoteContextInput,
    customerCreditNoteId: string,
    payload: SalesCreditNotePostPayload
  ) {
    const requestHash = this.hashPayload({ customerCreditNoteId });

    const postedId = await this.executeInTransaction(async (transaction) => {
      const operation = await this.lockOperation(transaction, context, "POST", payload.idempotencyKey);
      if (operation) {
        this.assertSameRequest(operation, requestHash);
        return operation.CustomerCreditNoteId!;
      }

      const note = await this.lockCreditNote(transaction, context, customerCreditNoteId);
      if (note.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SALES_CREDIT_NOTE_ALREADY_POSTED",
          message: "Only DRAFT sales credit notes can be posted by the sales integration.",
          isOperational: true
        });
      }

      const source = await this.lockSourceReturn(transaction, context, note.SourceSalesReturnId);
      const application = await this.lockSingleApplication(transaction, context, customerCreditNoteId);
      if (application.AccountsReceivableDocumentId !== source.AccountsReceivableDocumentId) {
        throw new AppError({
          statusCode: 409,
          code: "SALES_CREDIT_NOTE_APPLICATION_DOCUMENT_MISMATCH",
          message: "Sales credit note application does not match the source invoice accounts receivable document.",
          isOperational: true
        });
      }

      if (Math.abs(Number(application.AppliedAmount) - Number(note.Amount)) > 0.0001) {
        throw new AppError({
          statusCode: 400,
          code: "SALES_CREDIT_NOTE_APPLICATION_TOTAL_MISMATCH",
          message: "Sales credit note amount must match its accounts receivable application.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(source.AccountsReceivableStatus)) {
        throw new AppError({
          statusCode: 400,
          code: "SALES_CREDIT_NOTE_AR_DOCUMENT_NOT_OPEN",
          message: "The accounts receivable document is no longer open for credit.",
          isOperational: true
        });
      }

      if (Number(note.Amount) - Number(source.AccountsReceivableRemainingAmount) > 0.0001) {
        throw new AppError({
          statusCode: 400,
          code: "SALES_CREDIT_NOTE_EXCEEDS_AR_BALANCE",
          message: "Sales credit note amount exceeds the current accounts receivable balance.",
          isOperational: true
        });
      }

      const nextPaidAmount = Number(source.AccountsReceivablePaidAmount) + Number(note.Amount);
      const nextStatus = Number(source.AccountsReceivableTotalAmount) - nextPaidAmount <= 0.0001 ? "PAID" : "PARTIALLY_PAID";

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
          { name: "AccountsReceivableDocumentId", value: source.AccountsReceivableDocumentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "PaidAmount", value: nextPaidAmount },
          { name: "Status", value: nextStatus },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

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

      await this.insertOperation(transaction, context, {
        operationType: "POST",
        idempotencyKey: payload.idempotencyKey,
        requestHash,
        salesReturnId: note.SourceSalesReturnId,
        salesInvoiceId: note.SourceSalesInvoiceId,
        customerCreditNoteId,
        accountsReceivableDocumentId: source.AccountsReceivableDocumentId,
        resultStatus: "POSTED",
        resultAmount: Number(note.Amount)
      });

      return customerCreditNoteId;
    });

    return this.getSalesCreditNote(context, postedId);
  }

  private async lockSourceReturn(
    transaction: sql.Transaction,
    context: SalesCreditNoteContextInput,
    salesReturnId: string
  ): Promise<SourceLockRow> {
    const rows = await this.queryInTransaction<SourceLockRow>(
      transaction,
      `
        WITH ReturnAmounts AS (
          SELECT
            salesReturn.SalesReturnId,
            salesReturn.ReturnNumber,
            salesReturn.SalesInvoiceId,
            invoice.InvoiceNumber,
            invoice.AccountsReceivableDocumentId,
            arDocument.DocumentNumber AS AccountsReceivableDocumentNumber,
            arDocument.Status AS AccountsReceivableStatus,
            arDocument.TotalAmount AS AccountsReceivableTotalAmount,
            arDocument.PaidAmount AS AccountsReceivablePaidAmount,
            arDocument.RemainingAmount AS AccountsReceivableRemainingAmount,
            salesReturn.CustomerId,
            CAST(SUM(returnLine.Quantity * (invoiceLine.LineTotal / NULLIF(invoiceLine.Quantity, 0))) AS DECIMAL(18,4)) AS ReturnedAmount,
            CAST(SUM(returnLine.Quantity) AS DECIMAL(18,4)) AS ReturnedQuantity
          FROM sales.SalesReturns salesReturn WITH (UPDLOCK, HOLDLOCK)
          INNER JOIN sales.SalesReturnLines returnLine WITH (UPDLOCK, HOLDLOCK)
            ON returnLine.SalesReturnId = salesReturn.SalesReturnId
          INNER JOIN sales.SalesInvoices invoice WITH (UPDLOCK, HOLDLOCK)
            ON invoice.SalesInvoiceId = salesReturn.SalesInvoiceId
          INNER JOIN sales.SalesInvoiceLines invoiceLine WITH (UPDLOCK, HOLDLOCK)
            ON invoiceLine.SalesInvoiceLineId = returnLine.SalesInvoiceLineId
           AND invoiceLine.SalesInvoiceId = invoice.SalesInvoiceId
          INNER JOIN ar.AccountsReceivableDocuments arDocument WITH (UPDLOCK, HOLDLOCK)
            ON arDocument.AccountsReceivableDocumentId = invoice.AccountsReceivableDocumentId
          WHERE salesReturn.TenantId = @TenantId
            AND salesReturn.CompanyId = @CompanyId
            AND salesReturn.SalesReturnId = @SalesReturnId
            AND salesReturn.Status = 'POSTED'
            AND invoice.Status = 'POSTED'
            AND salesReturn.SalesInvoiceId IS NOT NULL
            AND invoice.AccountsReceivableDocumentId IS NOT NULL
          GROUP BY
            salesReturn.SalesReturnId,
            salesReturn.ReturnNumber,
            salesReturn.SalesInvoiceId,
            invoice.InvoiceNumber,
            invoice.AccountsReceivableDocumentId,
            arDocument.DocumentNumber,
            arDocument.Status,
            arDocument.TotalAmount,
            arDocument.PaidAmount,
            arDocument.RemainingAmount,
            salesReturn.CustomerId
        ),
        Credits AS (
          SELECT
            SourceSalesReturnId AS SalesReturnId,
            CAST(SUM(CASE WHEN Status <> 'CANCELLED' THEN Amount ELSE 0 END) AS DECIMAL(18,4)) AS ReservedCreditAmount
          FROM ar.CustomerCreditNotes WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND SourceType = 'SALES_RETURN'
            AND SourceSalesReturnId = @SalesReturnId
          GROUP BY SourceSalesReturnId
        )
        SELECT
          amount.*,
          CAST(COALESCE(credit.ReservedCreditAmount, 0) AS DECIMAL(18,4)) AS ReservedCreditAmount,
          CAST(amount.ReturnedAmount - COALESCE(credit.ReservedCreditAmount, 0) AS DECIMAL(18,4)) AS PendingCreditAmount
        FROM ReturnAmounts amount
        LEFT JOIN Credits credit
          ON credit.SalesReturnId = amount.SalesReturnId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: salesReturnId }
      ]
    );

    const source = rows[0];
    if (!source) {
      throw new NotFoundError(
        "Posted sales return with posted invoice was not found for credit note integration.",
        { salesReturnId },
        "SALES_RETURN_CREDIT_SOURCE_NOT_FOUND"
      );
    }

    return source;
  }

  private async lockCreditNote(
    transaction: sql.Transaction,
    context: SalesCreditNoteContextInput,
    customerCreditNoteId: string
  ): Promise<CreditNoteLockRow> {
    const rows = await this.queryInTransaction<CreditNoteLockRow>(
      transaction,
      `
        SELECT
          CustomerCreditNoteId,
          CreditNoteNumber,
          SourceSalesReturnId,
          SourceSalesInvoiceId,
          CustomerId,
          Status,
          Amount
        FROM ar.CustomerCreditNotes WITH (UPDLOCK, HOLDLOCK)
        WHERE CustomerCreditNoteId = @CustomerCreditNoteId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceType = 'SALES_RETURN';
      `,
      [
        { name: "CustomerCreditNoteId", value: customerCreditNoteId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const note = rows[0];
    if (!note) {
      throw new NotFoundError("Sales credit note integration not found.", { customerCreditNoteId }, "SALES_CREDIT_NOTE_NOT_FOUND");
    }

    return note;
  }

  private async lockSingleApplication(
    transaction: sql.Transaction,
    context: SalesCreditNoteContextInput,
    customerCreditNoteId: string
  ): Promise<ApplicationLockRow> {
    const rows = await this.queryInTransaction<ApplicationLockRow>(
      transaction,
      `
        SELECT CustomerCreditNoteApplicationId, AccountsReceivableDocumentId, AppliedAmount
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

    if (rows.length !== 1) {
      throw new AppError({
        statusCode: 409,
        code: "SALES_CREDIT_NOTE_APPLICATION_INVALID",
        message: "Sales credit note integration must have exactly one accounts receivable application.",
        isOperational: true
      });
    }

    return rows[0]!;
  }

  private async lockOperation(
    transaction: sql.Transaction,
    context: SalesCreditNoteContextInput,
    operationType: "CREATE" | "POST",
    idempotencyKey: string
  ) {
    const rows = await this.queryInTransaction<OperationRow>(
      transaction,
      `
        SELECT SalesCreditNoteOperationId, RequestHash, CustomerCreditNoteId, ResultStatus
        FROM sales.SalesCreditNoteOperations WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND OperationType = @OperationType
          AND IdempotencyKey = @IdempotencyKey;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "OperationType", value: operationType },
        { name: "IdempotencyKey", value: idempotencyKey }
      ]
    );

    return rows[0];
  }

  private assertSameRequest(operation: OperationRow, requestHash: string) {
    if (operation.RequestHash !== requestHash) {
      throw new AppError({
        statusCode: 409,
        code: "SALES_CREDIT_NOTE_IDEMPOTENCY_CONFLICT",
        message: "The same idempotency key was already used with a different payload.",
        isOperational: true
      });
    }
  }

  private async insertOperation(
    transaction: sql.Transaction,
    context: SalesCreditNoteContextInput,
    input: {
      operationType: "CREATE" | "POST";
      idempotencyKey: string;
      requestHash: string;
      salesReturnId: string;
      salesInvoiceId: string;
      customerCreditNoteId: string;
      accountsReceivableDocumentId: string;
      resultStatus: SalesCreditNoteStatus;
      resultAmount: number;
    }
  ) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO sales.SalesCreditNoteOperations (
          SalesCreditNoteOperationId, TenantId, CompanyId, SalesReturnId,
          SalesInvoiceId, CustomerCreditNoteId, AccountsReceivableDocumentId,
          OperationType, IdempotencyKey, RequestHash, ResultStatus, ResultAmount, CreatedBy
        )
        VALUES (
          @OperationId, @TenantId, @CompanyId, @SalesReturnId,
          @SalesInvoiceId, @CustomerCreditNoteId, @AccountsReceivableDocumentId,
          @OperationType, @IdempotencyKey, @RequestHash, @ResultStatus, @ResultAmount, @UserId
        );
      `,
      [
        { name: "OperationId", value: randomUUID() },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: input.salesReturnId },
        { name: "SalesInvoiceId", value: input.salesInvoiceId },
        { name: "CustomerCreditNoteId", value: input.customerCreditNoteId },
        { name: "AccountsReceivableDocumentId", value: input.accountsReceivableDocumentId },
        { name: "OperationType", value: input.operationType },
        { name: "IdempotencyKey", value: input.idempotencyKey },
        { name: "RequestHash", value: input.requestHash },
        { name: "ResultStatus", value: input.resultStatus },
        { name: "ResultAmount", value: input.resultAmount },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async generateCreditNoteNumber(transaction: sql.Transaction, context: SalesCreditNoteContextInput) {
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

    return `NC-CXC-${datePart}-${String(rows[0]?.NextNumber ?? 1).padStart(4, "0")}`;
  }

  private hashPayload(payload: unknown) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private mapCreditableReturn(row: CreditableReturnRow): SalesCreditableReturnResult {
    return {
      id: row.SalesReturnCreditNotePendingId,
      salesReturnId: row.SalesReturnId,
      returnNumber: row.ReturnNumber,
      salesInvoiceId: row.SalesInvoiceId,
      invoiceNumber: row.InvoiceNumber,
      accountsReceivableDocumentId: row.AccountsReceivableDocumentId,
      accountsReceivableDocumentNumber: row.AccountsReceivableDocumentNumber,
      accountsReceivableStatus: row.AccountsReceivableStatus,
      accountsReceivableRemainingAmount: Number(row.AccountsReceivableRemainingAmount),
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      returnedQuantity: Number(row.ReturnedQuantity),
      returnedAmount: Number(row.ReturnedAmount),
      reservedCreditAmount: Number(row.ReservedCreditAmount),
      postedCreditAmount: Number(row.PostedCreditAmount),
      pendingCreditAmount: Number(row.PendingCreditAmount),
      creditNoteCount: Number(row.CreditNoteCount)
    };
  }

  private mapIntegration(row: IntegrationRow): SalesCreditNoteIntegrationResult {
    return {
      id: row.SalesCreditNoteIntegrationId,
      customerCreditNoteId: row.CustomerCreditNoteId,
      creditNoteNumber: row.CreditNoteNumber,
      salesReturnId: row.SalesReturnId,
      returnNumber: row.ReturnNumber,
      salesInvoiceId: row.SalesInvoiceId,
      invoiceNumber: row.InvoiceNumber,
      accountsReceivableDocumentId: row.AccountsReceivableDocumentId,
      accountsReceivableDocumentNumber: row.AccountsReceivableDocumentNumber,
      accountsReceivableStatus: row.AccountsReceivableStatus,
      accountsReceivableTotalAmount: Number(row.AccountsReceivableTotalAmount),
      accountsReceivablePaidAmount: Number(row.AccountsReceivablePaidAmount),
      accountsReceivableRemainingAmount: Number(row.AccountsReceivableRemainingAmount),
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      creditNoteDate: row.CreditNoteDate,
      status: row.Status,
      amount: Number(row.Amount),
      appliedAmount: Number(row.AppliedAmount),
      unappliedAmount: Number(row.UnappliedAmount),
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      postedAt: row.PostedAt ?? undefined
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

export const salesCreditNoteRepository = new SalesCreditNoteRepository();
