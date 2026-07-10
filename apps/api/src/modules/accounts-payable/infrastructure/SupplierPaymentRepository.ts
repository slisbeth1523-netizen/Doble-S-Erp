import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SupplierPaymentApplicationCreatePayload,
  SupplierPaymentCreatePayload,
  SupplierPaymentListQuery
} from "../validators/supplier-payment.validators.js";

export type SupplierPaymentStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type AccountsPayableDocumentStatus = "OPEN" | "PARTIALLY_PAID" | "PAID";

export type SupplierPaymentContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SupplierPaymentCreateInput = SupplierPaymentContextInput & SupplierPaymentCreatePayload;

export type SupplierPaymentApplicationResult = {
  id: string;
  supplierPaymentId: string;
  lineNumber: number;
  accountsPayableDocumentId: string;
  documentNumber: string;
  sourceDocumentNumber?: string;
  documentStatus: AccountsPayableDocumentStatus;
  documentTotalAmount: number;
  documentPaidAmount: number;
  documentRemainingAmount: number;
  appliedAmount: number;
  notes?: string;
};

export type SupplierPaymentResult = {
  id: string;
  paymentNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  paymentDate: Date;
  status: SupplierPaymentStatus;
  paymentMethod: string;
  totalAmount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  applications: SupplierPaymentApplicationResult[];
};

type PaymentSummaryRow = {
  SupplierPaymentId: string;
  PaymentNumber: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  PaymentDate: Date;
  Status: SupplierPaymentStatus;
  PaymentMethod: string;
  TotalAmount: number;
  AppliedAmount: number;
  UnappliedAmount: number;
  ApplicationCount: number;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
};

type ApplicationSummaryRow = {
  SupplierPaymentApplicationId: string;
  SupplierPaymentId: string;
  LineNumber: number;
  AccountsPayableDocumentId: string;
  DocumentNumber: string;
  SourceDocumentNumber: string | null;
  DocumentStatus: AccountsPayableDocumentStatus;
  DocumentTotalAmount: number;
  DocumentPaidAmount: number;
  DocumentRemainingAmount: number;
  AppliedAmount: number;
  Notes: string | null;
};

type SupplierRow = {
  SupplierId: string;
};

type PaymentLockRow = {
  SupplierPaymentId: string;
  PaymentNumber: string;
  SupplierId: string;
  Status: SupplierPaymentStatus;
  TotalAmount: number;
};

type DocumentLockRow = {
  AccountsPayableDocumentId: string;
  SupplierId: string;
  Status: AccountsPayableDocumentStatus;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
};

type ApplicationLockRow = {
  SupplierPaymentApplicationId: string;
  AccountsPayableDocumentId: string;
  AppliedAmount: number;
};

export class SupplierPaymentRepository extends BaseSqlRepository {
  async createSupplierPayment(input: SupplierPaymentCreateInput): Promise<SupplierPaymentResult> {
    const paymentId = await this.executeInTransaction(async (transaction) => {
      await this.validateSupplier(transaction, input, input.supplierId);

      const id = randomUUID();
      const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date();
      const paymentNumber = await this.generatePaymentNumber(transaction, input);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ap.SupplierPayments (
            SupplierPaymentId,
            TenantId,
            CompanyId,
            PaymentNumber,
            SupplierId,
            PaymentDate,
            Status,
            PaymentMethod,
            TotalAmount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SupplierPaymentId,
            @TenantId,
            @CompanyId,
            @PaymentNumber,
            @SupplierId,
            @PaymentDate,
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
          { name: "SupplierPaymentId", value: id },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "PaymentNumber", value: paymentNumber },
          { name: "SupplierId", value: input.supplierId },
          { name: "PaymentDate", value: paymentDate },
          { name: "TotalAmount", value: input.totalAmount },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return id;
    });

    return this.getSupplierPayment(input, paymentId);
  }

  async listSupplierPayments(
    context: SupplierPaymentContextInput,
    query: SupplierPaymentListQuery
  ): Promise<SupplierPaymentResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<PaymentSummaryRow>(
      `
        SELECT
          SupplierPaymentId,
          PaymentNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          PaymentDate,
          Status,
          PaymentMethod,
          TotalAmount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          Reference,
          Notes,
          PostedAt
        FROM ap.V_SupplierPaymentSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (@SupplierId IS NULL OR SupplierId = @SupplierId)
          AND (
            @Search IS NULL
            OR PaymentNumber LIKE @Search
            OR SupplierCode LIKE @Search
            OR SupplierName LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY PaymentDate DESC, PaymentNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Status", value: query.status ?? null },
        { name: "SupplierId", value: query.supplierId ?? null },
        { name: "Search", value: search },
        { name: "Offset", value: offset },
        { name: "PageSize", value: pageSize }
      ]
    );

    return rows.map((row) => this.mapPayment(row, []));
  }

  async getSupplierPayment(context: SupplierPaymentContextInput, supplierPaymentId: string): Promise<SupplierPaymentResult> {
    const rows = await this.query<PaymentSummaryRow>(
      `
        SELECT
          SupplierPaymentId,
          PaymentNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          PaymentDate,
          Status,
          PaymentMethod,
          TotalAmount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          Reference,
          Notes,
          PostedAt
        FROM ap.V_SupplierPaymentSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierPaymentId = @SupplierPaymentId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierPaymentId", value: supplierPaymentId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Supplier payment not found.", { supplierPaymentId }, "SUPPLIER_PAYMENT_NOT_FOUND");
    }

    const applications = await this.getSupplierPaymentApplications(context, supplierPaymentId);
    return this.mapPayment(row, applications);
  }

  async addApplication(
    context: SupplierPaymentContextInput,
    supplierPaymentId: string,
    payload: SupplierPaymentApplicationCreatePayload
  ): Promise<SupplierPaymentResult> {
    await this.executeInTransaction(async (transaction) => {
      const payment = await this.lockPayment(transaction, context, supplierPaymentId);
      if (payment.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_PAYMENT_NOT_DRAFT",
          message: "Applications can only be added to DRAFT supplier payments.",
          isOperational: true
        });
      }

      const document = await this.lockAccountsPayableDocument(
        transaction,
        context,
        payload.accountsPayableDocumentId
      );

      if (document.SupplierId !== payment.SupplierId) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_PAYMENT_DOCUMENT_SUPPLIER_MISMATCH",
          message: "The accounts payable document belongs to a different supplier.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_PAYMENT_DOCUMENT_NOT_OPEN",
          message: "Only OPEN or PARTIALLY_PAID accounts payable documents can be paid.",
          isOperational: true
        });
      }

      if (payload.appliedAmount > Number(document.RemainingAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_PAYMENT_APPLICATION_EXCEEDS_BALANCE",
          message: "Applied amount cannot exceed the document pending balance.",
          isOperational: true
        });
      }

      const existingRows = await this.queryInTransaction<{
        SupplierPaymentApplicationId: string;
        AppliedAmount: number;
      }>(
        transaction,
        `
          SELECT SupplierPaymentApplicationId, AppliedAmount
          FROM ap.SupplierPaymentApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE SupplierPaymentId = @SupplierPaymentId
            AND AccountsPayableDocumentId = @AccountsPayableDocumentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SupplierPaymentId", value: supplierPaymentId },
          { name: "AccountsPayableDocumentId", value: payload.accountsPayableDocumentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      const existing = existingRows[0];

      const totalAppliedRows = await this.queryInTransaction<{ TotalApplied: number }>(
        transaction,
        `
          SELECT COALESCE(SUM(AppliedAmount), 0) AS TotalApplied
          FROM ap.SupplierPaymentApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE SupplierPaymentId = @SupplierPaymentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SupplierPaymentId", value: supplierPaymentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      const currentTotalApplied = Number(totalAppliedRows[0]?.TotalApplied ?? 0);
      const currentAmountForDocument = Number(existing?.AppliedAmount ?? 0);
      const nextTotalApplied = currentTotalApplied - currentAmountForDocument + payload.appliedAmount;

      if (nextTotalApplied > Number(payment.TotalAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_PAYMENT_APPLICATIONS_EXCEED_PAYMENT_TOTAL",
          message: "The sum of applications cannot exceed the payment total.",
          isOperational: true
        });
      }

      if (existing) {
        await this.queryInTransaction(
          transaction,
          `
            UPDATE ap.SupplierPaymentApplications
            SET AppliedAmount = @AppliedAmount,
                Notes = @Notes,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE SupplierPaymentApplicationId = @SupplierPaymentApplicationId;
          `,
          [
            { name: "SupplierPaymentApplicationId", value: existing.SupplierPaymentApplicationId },
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
            FROM ap.SupplierPaymentApplications
            WHERE SupplierPaymentId = @SupplierPaymentId;
          `,
          [{ name: "SupplierPaymentId", value: supplierPaymentId }]
        );

        await this.queryInTransaction(
          transaction,
          `
            INSERT INTO ap.SupplierPaymentApplications (
              SupplierPaymentApplicationId,
              SupplierPaymentId,
              TenantId,
              CompanyId,
              LineNumber,
              AccountsPayableDocumentId,
              AppliedAmount,
              Notes,
              CreatedBy
            )
            VALUES (
              @SupplierPaymentApplicationId,
              @SupplierPaymentId,
              @TenantId,
              @CompanyId,
              @LineNumber,
              @AccountsPayableDocumentId,
              @AppliedAmount,
              @Notes,
              @UserId
            );
          `,
          [
            { name: "SupplierPaymentApplicationId", value: randomUUID() },
            { name: "SupplierPaymentId", value: supplierPaymentId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "LineNumber", value: lineRows[0]?.NextLine ?? 1 },
            { name: "AccountsPayableDocumentId", value: payload.accountsPayableDocumentId },
            { name: "AppliedAmount", value: payload.appliedAmount },
            { name: "Notes", value: payload.notes ?? null },
            { name: "UserId", value: context.userId ?? null }
          ]
        );
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE ap.SupplierPayments
          SET UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SupplierPaymentId = @SupplierPaymentId;
        `,
        [
          { name: "SupplierPaymentId", value: supplierPaymentId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getSupplierPayment(context, supplierPaymentId);
  }

  async postSupplierPayment(context: SupplierPaymentContextInput, supplierPaymentId: string): Promise<SupplierPaymentResult> {
    await this.executeInTransaction(async (transaction) => {
      const payment = await this.lockPayment(transaction, context, supplierPaymentId);
      if (payment.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_PAYMENT_ALREADY_POSTED",
          message: "Only DRAFT supplier payments can be posted.",
          isOperational: true
        });
      }

      const applications = await this.queryInTransaction<ApplicationLockRow>(
        transaction,
        `
          SELECT SupplierPaymentApplicationId, AccountsPayableDocumentId, AppliedAmount
          FROM ap.SupplierPaymentApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE SupplierPaymentId = @SupplierPaymentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
          ORDER BY LineNumber;
        `,
        [
          { name: "SupplierPaymentId", value: supplierPaymentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      if (!applications.length) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_PAYMENT_HAS_NO_APPLICATIONS",
          message: "Supplier payment must have at least one application before posting.",
          isOperational: true
        });
      }

      const totalApplied = applications.reduce((sum, application) => sum + Number(application.AppliedAmount), 0);
      if (Math.abs(totalApplied - Number(payment.TotalAmount)) > 0.0001) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_PAYMENT_TOTAL_MUST_MATCH_APPLICATIONS",
          message: "Total applied amount must match the supplier payment total before posting.",
          isOperational: true
        });
      }

      for (const application of applications) {
        const document = await this.lockAccountsPayableDocument(
          transaction,
          context,
          application.AccountsPayableDocumentId
        );

        if (document.SupplierId !== payment.SupplierId) {
          throw new AppError({
            statusCode: 400,
            code: "SUPPLIER_PAYMENT_POST_SUPPLIER_MISMATCH",
            message: "Payment application references a document from another supplier.",
            isOperational: true
          });
        }

        if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
          throw new AppError({
            statusCode: 400,
            code: "SUPPLIER_PAYMENT_POST_DOCUMENT_NOT_OPEN",
            message: "Payment application references a document that is no longer open.",
            isOperational: true
          });
        }

        if (Number(application.AppliedAmount) > Number(document.RemainingAmount)) {
          throw new AppError({
            statusCode: 400,
            code: "SUPPLIER_PAYMENT_POST_EXCEEDS_DOCUMENT_BALANCE",
            message: "Payment application exceeds the current document balance.",
            isOperational: true
          });
        }

        const nextPaidAmount = Number(document.PaidAmount) + Number(application.AppliedAmount);
        const nextStatus: AccountsPayableDocumentStatus =
          Number(document.TotalAmount) - nextPaidAmount <= 0.0001 ? "PAID" : "PARTIALLY_PAID";

        await this.queryInTransaction(
          transaction,
          `
            UPDATE ap.AccountsPayableDocuments
            SET PaidAmount = @PaidAmount,
                Status = @Status,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE AccountsPayableDocumentId = @AccountsPayableDocumentId
              AND TenantId = @TenantId
              AND CompanyId = @CompanyId;
          `,
          [
            { name: "AccountsPayableDocumentId", value: document.AccountsPayableDocumentId },
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
          UPDATE ap.SupplierPayments
          SET Status = 'POSTED',
              PostedAt = SYSUTCDATETIME(),
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SupplierPaymentId = @SupplierPaymentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND Status = 'DRAFT';
        `,
        [
          { name: "SupplierPaymentId", value: supplierPaymentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getSupplierPayment(context, supplierPaymentId);
  }

  private async validateSupplier(
    transaction: sql.Transaction,
    context: SupplierPaymentContextInput,
    supplierId: string
  ): Promise<SupplierRow> {
    const rows = await this.queryInTransaction<SupplierRow>(
      transaction,
      `
        SELECT SupplierId
        FROM purchasing.Suppliers WITH (UPDLOCK, HOLDLOCK)
        WHERE SupplierId = @SupplierId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND IsActive = 1;
      `,
      [
        { name: "SupplierId", value: supplierId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const supplier = rows[0];
    if (!supplier) {
      throw new NotFoundError("Supplier not found.", { supplierId }, "SUPPLIER_NOT_FOUND");
    }

    return supplier;
  }

  private async generatePaymentNumber(
    transaction: sql.Transaction,
    context: SupplierPaymentContextInput
  ): Promise<string> {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const rows = await this.queryInTransaction<{ NextNumber: number }>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS NextNumber
        FROM ap.SupplierPayments WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PaymentNumber LIKE @Prefix;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Prefix", value: `PAY-${datePart}-%` }
      ]
    );

    const nextNumber = rows[0]?.NextNumber ?? 1;
    return `PAY-${datePart}-${String(nextNumber).padStart(4, "0")}`;
  }

  private async lockPayment(
    transaction: sql.Transaction,
    context: SupplierPaymentContextInput,
    supplierPaymentId: string
  ): Promise<PaymentLockRow> {
    const rows = await this.queryInTransaction<PaymentLockRow>(
      transaction,
      `
        SELECT SupplierPaymentId, PaymentNumber, SupplierId, Status, TotalAmount
        FROM ap.SupplierPayments WITH (UPDLOCK, HOLDLOCK)
        WHERE SupplierPaymentId = @SupplierPaymentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "SupplierPaymentId", value: supplierPaymentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const payment = rows[0];
    if (!payment) {
      throw new NotFoundError("Supplier payment not found.", { supplierPaymentId }, "SUPPLIER_PAYMENT_NOT_FOUND");
    }

    return payment;
  }

  private async lockAccountsPayableDocument(
    transaction: sql.Transaction,
    context: SupplierPaymentContextInput,
    accountsPayableDocumentId: string
  ): Promise<DocumentLockRow> {
    const rows = await this.queryInTransaction<DocumentLockRow>(
      transaction,
      `
        SELECT
          AccountsPayableDocumentId,
          SupplierId,
          Status,
          TotalAmount,
          PaidAmount,
          RemainingAmount
        FROM ap.AccountsPayableDocuments WITH (UPDLOCK, HOLDLOCK)
        WHERE AccountsPayableDocumentId = @AccountsPayableDocumentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "AccountsPayableDocumentId", value: accountsPayableDocumentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const document = rows[0];
    if (!document) {
      throw new NotFoundError(
        "Accounts payable document not found.",
        { accountsPayableDocumentId },
        "ACCOUNTS_PAYABLE_DOCUMENT_NOT_FOUND"
      );
    }

    return document;
  }

  private async getSupplierPaymentApplications(
    context: SupplierPaymentContextInput,
    supplierPaymentId: string
  ): Promise<SupplierPaymentApplicationResult[]> {
    const rows = await this.query<ApplicationSummaryRow>(
      `
        SELECT
          SupplierPaymentApplicationId,
          SupplierPaymentId,
          LineNumber,
          AccountsPayableDocumentId,
          DocumentNumber,
          SourceDocumentNumber,
          DocumentStatus,
          DocumentTotalAmount,
          DocumentPaidAmount,
          DocumentRemainingAmount,
          AppliedAmount,
          Notes
        FROM ap.V_SupplierPaymentApplicationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierPaymentId = @SupplierPaymentId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierPaymentId", value: supplierPaymentId }
      ]
    );

    return rows.map((row) => ({
      id: row.SupplierPaymentApplicationId,
      supplierPaymentId: row.SupplierPaymentId,
      lineNumber: Number(row.LineNumber),
      accountsPayableDocumentId: row.AccountsPayableDocumentId,
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

  private mapPayment(row: PaymentSummaryRow, applications: SupplierPaymentApplicationResult[]): SupplierPaymentResult {
    return {
      id: row.SupplierPaymentId,
      paymentNumber: row.PaymentNumber,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
      paymentDate: row.PaymentDate,
      status: row.Status,
      paymentMethod: row.PaymentMethod,
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

    for (const p of parameters) {
      request.input(p.name, p.value);
    }

    const result = await request.query(sqlText);
    return result.recordset as TRecord[];
  }
}

export const supplierPaymentRepository = new SupplierPaymentRepository();
