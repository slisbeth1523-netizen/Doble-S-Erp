import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SupplierAdjustmentApplicationCreatePayload,
  SupplierAdjustmentCreatePayload,
  SupplierAdjustmentListQuery
} from "../validators/supplier-adjustment.validators.js";
import type { AccountsPayableDocumentStatus } from "./SupplierPaymentRepository.js";

export type SupplierAdjustmentType = "CREDIT_NOTE" | "DEBIT_NOTE";
export type SupplierAdjustmentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SupplierAdjustmentContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SupplierAdjustmentCreateInput = SupplierAdjustmentContextInput & SupplierAdjustmentCreatePayload;

export type SupplierAdjustmentApplicationResult = {
  id: string;
  supplierAdjustmentId: string;
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

export type SupplierAdjustmentResult = {
  id: string;
  adjustmentNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  adjustmentType: SupplierAdjustmentType;
  adjustmentDate: Date;
  status: SupplierAdjustmentStatus;
  amount: number;
  appliedAmount: number;
  unappliedAmount: number;
  applicationCount: number;
  generatedAccountsPayableDocumentId?: string;
  generatedDocumentNumber?: string;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  applications: SupplierAdjustmentApplicationResult[];
};

type AdjustmentSummaryRow = {
  SupplierAdjustmentId: string;
  AdjustmentNumber: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  AdjustmentType: SupplierAdjustmentType;
  AdjustmentDate: Date;
  Status: SupplierAdjustmentStatus;
  Amount: number;
  AppliedAmount: number;
  UnappliedAmount: number;
  ApplicationCount: number;
  GeneratedAccountsPayableDocumentId: string | null;
  GeneratedDocumentNumber: string | null;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
};

type ApplicationSummaryRow = {
  SupplierAdjustmentApplicationId: string;
  SupplierAdjustmentId: string;
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

type AdjustmentLockRow = {
  SupplierAdjustmentId: string;
  AdjustmentNumber: string;
  SupplierId: string;
  AdjustmentType: SupplierAdjustmentType;
  Status: SupplierAdjustmentStatus;
  Amount: number;
  AdjustmentDate: Date;
  Notes: string | null;
  GeneratedAccountsPayableDocumentId: string | null;
};

type DocumentLockRow = {
  AccountsPayableDocumentId: string;
  DocumentNumber: string;
  SupplierId: string;
  Status: AccountsPayableDocumentStatus;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
};

type ApplicationLockRow = {
  SupplierAdjustmentApplicationId: string;
  AccountsPayableDocumentId: string;
  AppliedAmount: number;
};

export class SupplierAdjustmentRepository extends BaseSqlRepository {
  async createSupplierAdjustment(input: SupplierAdjustmentCreateInput): Promise<SupplierAdjustmentResult> {
    const adjustmentId = await this.executeInTransaction(async (transaction) => {
      await this.validateSupplier(transaction, input, input.supplierId);

      const id = randomUUID();
      const adjustmentDate = input.adjustmentDate ? new Date(input.adjustmentDate) : new Date();
      const adjustmentNumber = await this.generateAdjustmentNumber(transaction, input, input.adjustmentType);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ap.SupplierAdjustments (
            SupplierAdjustmentId,
            TenantId,
            CompanyId,
            AdjustmentNumber,
            SupplierId,
            AdjustmentType,
            AdjustmentDate,
            Status,
            Amount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SupplierAdjustmentId,
            @TenantId,
            @CompanyId,
            @AdjustmentNumber,
            @SupplierId,
            @AdjustmentType,
            @AdjustmentDate,
            'DRAFT',
            @Amount,
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "SupplierAdjustmentId", value: id },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "AdjustmentNumber", value: adjustmentNumber },
          { name: "SupplierId", value: input.supplierId },
          { name: "AdjustmentType", value: input.adjustmentType },
          { name: "AdjustmentDate", value: adjustmentDate },
          { name: "Amount", value: input.amount },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return id;
    });

    return this.getSupplierAdjustment(input, adjustmentId);
  }

  async listSupplierAdjustments(
    context: SupplierAdjustmentContextInput,
    query: SupplierAdjustmentListQuery
  ): Promise<SupplierAdjustmentResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<AdjustmentSummaryRow>(
      `
        SELECT
          SupplierAdjustmentId,
          AdjustmentNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          AdjustmentType,
          AdjustmentDate,
          Status,
          Amount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          GeneratedAccountsPayableDocumentId,
          GeneratedDocumentNumber,
          Reference,
          Notes,
          PostedAt
        FROM ap.V_SupplierAdjustmentSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (@AdjustmentType IS NULL OR AdjustmentType = @AdjustmentType)
          AND (@SupplierId IS NULL OR SupplierId = @SupplierId)
          AND (
            @Search IS NULL
            OR AdjustmentNumber LIKE @Search
            OR SupplierCode LIKE @Search
            OR SupplierName LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY AdjustmentDate DESC, AdjustmentNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Status", value: query.status ?? null },
        { name: "AdjustmentType", value: query.adjustmentType ?? null },
        { name: "SupplierId", value: query.supplierId ?? null },
        { name: "Search", value: search },
        { name: "Offset", value: offset },
        { name: "PageSize", value: pageSize }
      ]
    );

    return rows.map((row) => this.mapAdjustment(row, []));
  }

  async getSupplierAdjustment(
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string
  ): Promise<SupplierAdjustmentResult> {
    const rows = await this.query<AdjustmentSummaryRow>(
      `
        SELECT
          SupplierAdjustmentId,
          AdjustmentNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          AdjustmentType,
          AdjustmentDate,
          Status,
          Amount,
          AppliedAmount,
          UnappliedAmount,
          ApplicationCount,
          GeneratedAccountsPayableDocumentId,
          GeneratedDocumentNumber,
          Reference,
          Notes,
          PostedAt
        FROM ap.V_SupplierAdjustmentSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierAdjustmentId = @SupplierAdjustmentId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierAdjustmentId", value: supplierAdjustmentId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError(
        "Supplier adjustment not found.",
        { supplierAdjustmentId },
        "SUPPLIER_ADJUSTMENT_NOT_FOUND"
      );
    }

    const applications = await this.getSupplierAdjustmentApplications(context, supplierAdjustmentId);
    return this.mapAdjustment(row, applications);
  }

  async addApplication(
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string,
    payload: SupplierAdjustmentApplicationCreatePayload
  ): Promise<SupplierAdjustmentResult> {
    await this.executeInTransaction(async (transaction) => {
      const adjustment = await this.lockAdjustment(transaction, context, supplierAdjustmentId);
      if (adjustment.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_ADJUSTMENT_NOT_DRAFT",
          message: "Applications can only be added to DRAFT supplier adjustments.",
          isOperational: true
        });
      }

      if (adjustment.AdjustmentType !== "CREDIT_NOTE") {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_DEBIT_NOTE_APPLICATION_NOT_ALLOWED",
          message: "Debit notes do not accept applications in this foundation.",
          isOperational: true
        });
      }

      const document = await this.lockAccountsPayableDocument(transaction, context, payload.accountsPayableDocumentId);

      if (document.SupplierId !== adjustment.SupplierId) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_ADJUSTMENT_DOCUMENT_SUPPLIER_MISMATCH",
          message: "The accounts payable document belongs to a different supplier.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_CREDIT_NOTE_DOCUMENT_NOT_OPEN",
          message: "Credit notes can only be applied to OPEN or PARTIALLY_PAID documents.",
          isOperational: true
        });
      }

      if (payload.appliedAmount > Number(document.RemainingAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_ADJUSTMENT_APPLICATION_EXCEEDS_BALANCE",
          message: "Applied amount cannot exceed the document pending balance.",
          isOperational: true
        });
      }

      const existingRows = await this.queryInTransaction<{ SupplierAdjustmentApplicationId: string; AppliedAmount: number }>(
        transaction,
        `
          SELECT SupplierAdjustmentApplicationId, AppliedAmount
          FROM ap.SupplierAdjustmentApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE SupplierAdjustmentId = @SupplierAdjustmentId
            AND AccountsPayableDocumentId = @AccountsPayableDocumentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SupplierAdjustmentId", value: supplierAdjustmentId },
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
          FROM ap.SupplierAdjustmentApplications WITH (UPDLOCK, HOLDLOCK)
          WHERE SupplierAdjustmentId = @SupplierAdjustmentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SupplierAdjustmentId", value: supplierAdjustmentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      const currentTotalApplied = Number(totalAppliedRows[0]?.TotalApplied ?? 0);
      const currentAmountForDocument = Number(existing?.AppliedAmount ?? 0);
      const nextTotalApplied = currentTotalApplied - currentAmountForDocument + payload.appliedAmount;

      if (nextTotalApplied > Number(adjustment.Amount)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_ADJUSTMENT_APPLICATIONS_EXCEED_TOTAL",
          message: "The sum of applications cannot exceed the adjustment amount.",
          isOperational: true
        });
      }

      if (existing) {
        await this.queryInTransaction(
          transaction,
          `
            UPDATE ap.SupplierAdjustmentApplications
            SET AppliedAmount = @AppliedAmount,
                Notes = @Notes,
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE SupplierAdjustmentApplicationId = @SupplierAdjustmentApplicationId;
          `,
          [
            { name: "SupplierAdjustmentApplicationId", value: existing.SupplierAdjustmentApplicationId },
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
            FROM ap.SupplierAdjustmentApplications
            WHERE SupplierAdjustmentId = @SupplierAdjustmentId;
          `,
          [{ name: "SupplierAdjustmentId", value: supplierAdjustmentId }]
        );

        await this.queryInTransaction(
          transaction,
          `
            INSERT INTO ap.SupplierAdjustmentApplications (
              SupplierAdjustmentApplicationId,
              SupplierAdjustmentId,
              TenantId,
              CompanyId,
              LineNumber,
              AccountsPayableDocumentId,
              AppliedAmount,
              Notes,
              CreatedBy
            )
            VALUES (
              @SupplierAdjustmentApplicationId,
              @SupplierAdjustmentId,
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
            { name: "SupplierAdjustmentApplicationId", value: randomUUID() },
            { name: "SupplierAdjustmentId", value: supplierAdjustmentId },
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
    });

    return this.getSupplierAdjustment(context, supplierAdjustmentId);
  }

  async postSupplierAdjustment(
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string
  ): Promise<SupplierAdjustmentResult> {
    await this.executeInTransaction(async (transaction) => {
      const adjustment = await this.lockAdjustment(transaction, context, supplierAdjustmentId);
      if (adjustment.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_ADJUSTMENT_ALREADY_POSTED",
          message: "Only DRAFT supplier adjustments can be posted.",
          isOperational: true
        });
      }

      if (adjustment.AdjustmentType === "CREDIT_NOTE") {
        await this.postCreditNote(transaction, context, adjustment);
      } else {
        await this.postDebitNote(transaction, context, adjustment);
      }
    });

    return this.getSupplierAdjustment(context, supplierAdjustmentId);
  }

  private async postCreditNote(
    transaction: sql.Transaction,
    context: SupplierAdjustmentContextInput,
    adjustment: AdjustmentLockRow
  ) {
    const applications = await this.queryInTransaction<ApplicationLockRow>(
      transaction,
      `
        SELECT SupplierAdjustmentApplicationId, AccountsPayableDocumentId, AppliedAmount
        FROM ap.SupplierAdjustmentApplications WITH (UPDLOCK, HOLDLOCK)
        WHERE SupplierAdjustmentId = @SupplierAdjustmentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId
        ORDER BY LineNumber;
      `,
      [
        { name: "SupplierAdjustmentId", value: adjustment.SupplierAdjustmentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    if (!applications.length) {
      throw new AppError({
        statusCode: 400,
        code: "SUPPLIER_CREDIT_NOTE_HAS_NO_APPLICATIONS",
        message: "Credit note must have at least one application before posting.",
        isOperational: true
      });
    }

    const totalApplied = applications.reduce((sum, application) => sum + Number(application.AppliedAmount), 0);
    if (Math.abs(totalApplied - Number(adjustment.Amount)) > 0.0001) {
      throw new AppError({
        statusCode: 400,
        code: "SUPPLIER_CREDIT_NOTE_TOTAL_MUST_MATCH_APPLICATIONS",
        message: "Total applied amount must match the credit note amount before posting.",
        isOperational: true
      });
    }

    for (const application of applications) {
      const document = await this.lockAccountsPayableDocument(
        transaction,
        context,
        application.AccountsPayableDocumentId
      );

      if (document.SupplierId !== adjustment.SupplierId) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_CREDIT_NOTE_SUPPLIER_MISMATCH",
          message: "Credit note application references a document from another supplier.",
          isOperational: true
        });
      }

      if (!["OPEN", "PARTIALLY_PAID"].includes(document.Status)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_CREDIT_NOTE_POST_DOCUMENT_NOT_OPEN",
          message: "Credit note application references a document that is no longer open.",
          isOperational: true
        });
      }

      if (Number(application.AppliedAmount) > Number(document.RemainingAmount)) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_CREDIT_NOTE_POST_EXCEEDS_DOCUMENT_BALANCE",
          message: "Credit note application exceeds the current document balance.",
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

    await this.markPosted(transaction, context, adjustment.SupplierAdjustmentId, null);
  }

  private async postDebitNote(
    transaction: sql.Transaction,
    context: SupplierAdjustmentContextInput,
    adjustment: AdjustmentLockRow
  ) {
    if (adjustment.GeneratedAccountsPayableDocumentId) {
      throw new AppError({
        statusCode: 409,
        code: "SUPPLIER_DEBIT_NOTE_DOCUMENT_ALREADY_GENERATED",
        message: "Debit note already generated an accounts payable document.",
        isOperational: true
      });
    }

    const documentId = randomUUID();
    const documentNumber = `CXP-${adjustment.AdjustmentNumber}`;

    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO ap.AccountsPayableDocuments (
          AccountsPayableDocumentId,
          TenantId,
          CompanyId,
          DocumentNumber,
          SupplierId,
          SourceModule,
          SourceDocumentId,
          SourceDocumentNumber,
          DocumentDate,
          DueDate,
          TotalAmount,
          PaidAmount,
          Status,
          Notes,
          IsActive,
          CreatedBy
        )
        VALUES (
          @AccountsPayableDocumentId,
          @TenantId,
          @CompanyId,
          @DocumentNumber,
          @SupplierId,
          'SUPPLIER_DEBIT_NOTE',
          @SourceDocumentId,
          @SourceDocumentNumber,
          @DocumentDate,
          @DueDate,
          @TotalAmount,
          0,
          'OPEN',
          @Notes,
          1,
          @UserId
        );
      `,
      [
        { name: "AccountsPayableDocumentId", value: documentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "DocumentNumber", value: documentNumber },
        { name: "SupplierId", value: adjustment.SupplierId },
        { name: "SourceDocumentId", value: adjustment.SupplierAdjustmentId },
        { name: "SourceDocumentNumber", value: adjustment.AdjustmentNumber },
        { name: "DocumentDate", value: adjustment.AdjustmentDate },
        { name: "DueDate", value: adjustment.AdjustmentDate },
        { name: "TotalAmount", value: adjustment.Amount },
        { name: "Notes", value: adjustment.Notes },
        { name: "UserId", value: context.userId ?? null }
      ]
    );

    await this.markPosted(transaction, context, adjustment.SupplierAdjustmentId, documentId);
  }

  private async markPosted(
    transaction: sql.Transaction,
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string,
    generatedAccountsPayableDocumentId: string | null
  ) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE ap.SupplierAdjustments
        SET Status = 'POSTED',
            GeneratedAccountsPayableDocumentId = COALESCE(@GeneratedAccountsPayableDocumentId, GeneratedAccountsPayableDocumentId),
            PostedAt = SYSUTCDATETIME(),
            PostedBy = @UserId,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE SupplierAdjustmentId = @SupplierAdjustmentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Status = 'DRAFT';
      `,
      [
        { name: "SupplierAdjustmentId", value: supplierAdjustmentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "GeneratedAccountsPayableDocumentId", value: generatedAccountsPayableDocumentId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async validateSupplier(transaction: sql.Transaction, context: SupplierAdjustmentContextInput, supplierId: string) {
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

  private async generateAdjustmentNumber(
    transaction: sql.Transaction,
    context: SupplierAdjustmentContextInput,
    adjustmentType: SupplierAdjustmentType
  ) {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const prefix = adjustmentType === "CREDIT_NOTE" ? `NC-${datePart}-` : `ND-${datePart}-`;
    const rows = await this.queryInTransaction<{ NextNumber: number }>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS NextNumber
        FROM ap.SupplierAdjustments WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND AdjustmentNumber LIKE @Prefix;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Prefix", value: `${prefix}%` }
      ]
    );

    return `${prefix}${String(rows[0]?.NextNumber ?? 1).padStart(4, "0")}`;
  }

  private async lockAdjustment(
    transaction: sql.Transaction,
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string
  ): Promise<AdjustmentLockRow> {
    const rows = await this.queryInTransaction<AdjustmentLockRow>(
      transaction,
      `
        SELECT
          SupplierAdjustmentId,
          AdjustmentNumber,
          SupplierId,
          AdjustmentType,
          Status,
          Amount,
          AdjustmentDate,
          Notes,
          GeneratedAccountsPayableDocumentId
        FROM ap.SupplierAdjustments WITH (UPDLOCK, HOLDLOCK)
        WHERE SupplierAdjustmentId = @SupplierAdjustmentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "SupplierAdjustmentId", value: supplierAdjustmentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const adjustment = rows[0];
    if (!adjustment) {
      throw new NotFoundError(
        "Supplier adjustment not found.",
        { supplierAdjustmentId },
        "SUPPLIER_ADJUSTMENT_NOT_FOUND"
      );
    }

    return adjustment;
  }

  private async lockAccountsPayableDocument(
    transaction: sql.Transaction,
    context: SupplierAdjustmentContextInput,
    accountsPayableDocumentId: string
  ): Promise<DocumentLockRow> {
    const rows = await this.queryInTransaction<DocumentLockRow>(
      transaction,
      `
        SELECT
          AccountsPayableDocumentId,
          DocumentNumber,
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

  private async getSupplierAdjustmentApplications(
    context: SupplierAdjustmentContextInput,
    supplierAdjustmentId: string
  ): Promise<SupplierAdjustmentApplicationResult[]> {
    const rows = await this.query<ApplicationSummaryRow>(
      `
        SELECT
          SupplierAdjustmentApplicationId,
          SupplierAdjustmentId,
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
        FROM ap.V_SupplierAdjustmentApplicationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierAdjustmentId = @SupplierAdjustmentId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierAdjustmentId", value: supplierAdjustmentId }
      ]
    );

    return rows.map((row) => ({
      id: row.SupplierAdjustmentApplicationId,
      supplierAdjustmentId: row.SupplierAdjustmentId,
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

  private mapAdjustment(
    row: AdjustmentSummaryRow,
    applications: SupplierAdjustmentApplicationResult[]
  ): SupplierAdjustmentResult {
    return {
      id: row.SupplierAdjustmentId,
      adjustmentNumber: row.AdjustmentNumber,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
      adjustmentType: row.AdjustmentType,
      adjustmentDate: row.AdjustmentDate,
      status: row.Status,
      amount: Number(row.Amount),
      appliedAmount: Number(row.AppliedAmount),
      unappliedAmount: Number(row.UnappliedAmount),
      applicationCount: Number(row.ApplicationCount),
      generatedAccountsPayableDocumentId: row.GeneratedAccountsPayableDocumentId ?? undefined,
      generatedDocumentNumber: row.GeneratedDocumentNumber ?? undefined,
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

export const supplierAdjustmentRepository = new SupplierAdjustmentRepository();
