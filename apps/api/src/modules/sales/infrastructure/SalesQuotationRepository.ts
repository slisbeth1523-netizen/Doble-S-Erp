import { randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SalesQuotationCreatePayload,
  SalesQuotationLineCreatePayload,
  SalesQuotationLineUpdatePayload,
  SalesQuotationListQuery,
  SalesQuotationUpdatePayload
} from "../validators/sales-quotation.validators.js";

export type SalesQuotationStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" | "CONVERTED";

export type SalesQuotationContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SalesQuotationContext = SalesQuotationContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type SalesQuotationCreateInput = SalesQuotationContextInput & SalesQuotationCreatePayload;
export type SalesQuotationUpdateInput = SalesQuotationContextInput & SalesQuotationUpdatePayload;

export type SalesQuotationLineResult = {
  id: string;
  salesQuotationId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  unitOfMeasureName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  notes?: string;
};

export type SalesQuotationResult = {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  quotationDate: Date;
  validUntil: Date;
  currencyCode: string;
  exchangeRate: number;
  status: SalesQuotationStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineCount: number;
  reference?: string;
  notes?: string;
  sentAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  expiredAt?: Date;
  lines: SalesQuotationLineResult[];
};

export type SalesQuotationListResult = {
  records: SalesQuotationResult[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
};

type QuotationRow = {
  SalesQuotationId: string;
  QuotationNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  QuotationDate: Date;
  ValidUntil: Date;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: SalesQuotationStatus;
  SubtotalAmount: number;
  DiscountAmount: number;
  TaxAmount: number;
  TotalAmount: number;
  LineCount: number;
  Reference: string | null;
  Notes: string | null;
  SentAt: Date | null;
  ApprovedAt: Date | null;
  RejectedAt: Date | null;
  ExpiredAt: Date | null;
};

type LineRow = {
  SalesQuotationLineId: string;
  SalesQuotationId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  UnitOfMeasureId: string;
  UnitOfMeasureCode: string;
  UnitOfMeasureName: string;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  DiscountPercent: number;
  DiscountAmount: number;
  TaxPercent: number;
  TaxAmount: number;
  LineSubtotal: number;
  LineTotal: number;
  Notes: string | null;
};

type CountRow = {
  TotalItems: number;
};

type EntityExistsRow = {
  EntityId: string;
};

type ItemRow = {
  ItemId: string;
  Description: string;
};

type StatusRow = {
  Status: SalesQuotationStatus;
  ValidUntil: Date;
  TotalAmount: number;
  LineCount: number;
};

type NumberRow = {
  QuotationNumber: string;
};

type ExistingLineRow = {
  SalesQuotationLineId: string;
  ItemId: string;
  UnitOfMeasureId: string;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  DiscountPercent: number;
  TaxPercent: number;
  Notes: string | null;
};

type CalculatedLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
};

export class SalesQuotationRepository extends BaseSqlRepository {
  async createQuotation(input: SalesQuotationCreateInput): Promise<SalesQuotationResult> {
    const quotationId = await this.executeInTransaction(async (transaction) => {
      const quotationDate = input.quotationDate ? new Date(input.quotationDate) : new Date();
      const validUntil = new Date(input.validUntil);

      this.validateDates(quotationDate, validUntil);
      await this.ensureCustomerExists(transaction, input, input.customerId);

      const salesQuotationId = randomUUID();
      const quotationNumber = await this.generateQuotationNumber(transaction, input);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesQuotations (
            SalesQuotationId,
            TenantId,
            CompanyId,
            QuotationNumber,
            CustomerId,
            QuotationDate,
            ValidUntil,
            CurrencyCode,
            ExchangeRate,
            Status,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SalesQuotationId,
            @TenantId,
            @CompanyId,
            @QuotationNumber,
            @CustomerId,
            @QuotationDate,
            @ValidUntil,
            @CurrencyCode,
            @ExchangeRate,
            'DRAFT',
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "SalesQuotationId", value: salesQuotationId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "QuotationNumber", value: quotationNumber },
          { name: "CustomerId", value: input.customerId },
          { name: "QuotationDate", value: quotationDate },
          { name: "ValidUntil", value: validUntil },
          { name: "CurrencyCode", value: input.currencyCode },
          { name: "ExchangeRate", value: input.exchangeRate ?? 1 },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return salesQuotationId;
    });

    return this.getQuotation(input, quotationId);
  }

  async listQuotations(
    context: SalesQuotationContextInput,
    query: SalesQuotationListQuery
  ): Promise<SalesQuotationListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "DateFrom", value: query.dateFrom ?? null },
      { name: "DateTo", value: query.dateTo ?? null },
      { name: "ValidUntilFrom", value: query.validUntilFrom ?? null },
      { name: "ValidUntilTo", value: query.validUntilTo ?? null },
      { name: "Search", value: search }
    ];

    const whereClause = `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@DateFrom IS NULL OR CAST(QuotationDate AS date) >= CAST(@DateFrom AS date))
      AND (@DateTo IS NULL OR CAST(QuotationDate AS date) <= CAST(@DateTo AS date))
      AND (@ValidUntilFrom IS NULL OR CAST(ValidUntil AS date) >= CAST(@ValidUntilFrom AS date))
      AND (@ValidUntilTo IS NULL OR CAST(ValidUntil AS date) <= CAST(@ValidUntilTo AS date))
      AND (
        @Search IS NULL
        OR QuotationNumber LIKE @Search
        OR CustomerCode LIKE @Search
        OR CustomerName LIKE @Search
        OR Reference LIKE @Search
      )
    `;

    const [rows, countRows] = await Promise.all([
      this.query<QuotationRow>(
        `
          SELECT *
          FROM sales.V_SalesQuotationSummary
          WHERE ${whereClause}
          ORDER BY QuotationDate DESC, QuotationNumber DESC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        [
          ...parameters,
          { name: "Offset", value: offset },
          { name: "PageSize", value: pageSize }
        ]
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM sales.V_SalesQuotationSummary
          WHERE ${whereClause};
        `,
        parameters
      )
    ]);

    return {
      records: rows.map((row) => this.mapQuotation(row, [])),
      pagination: {
        page,
        pageSize,
        totalItems: Number(countRows[0]?.TotalItems ?? 0)
      }
    };
  }

  async getQuotation(
    context: SalesQuotationContextInput,
    salesQuotationId: string
  ): Promise<SalesQuotationResult> {
    const rows = await this.query<QuotationRow>(
      `
        SELECT *
        FROM sales.V_SalesQuotationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesQuotationId = @SalesQuotationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError("Sales quotation not found.", { salesQuotationId }, "SALES_QUOTATION_NOT_FOUND");
    }

    const lines = await this.getQuotationLines(context, salesQuotationId);
    return this.mapQuotation(row, lines);
  }

  async updateQuotation(
    context: SalesQuotationContextInput,
    salesQuotationId: string,
    payload: SalesQuotationUpdatePayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      const current = await this.lockQuotation(transaction, context, salesQuotationId);

      if (current.Status !== "DRAFT") {
        throw this.invalidStatus("SALES_QUOTATION_UPDATE_INVALID_STATUS", "Solo se pueden editar cotizaciones en borrador.");
      }

      const quotationDate = payload.quotationDate ? new Date(payload.quotationDate) : undefined;
      const validUntil = payload.validUntil ? new Date(payload.validUntil) : undefined;

      if (quotationDate || validUntil) {
        const currentDates = await this.getQuotationDates(transaction, context, salesQuotationId);
        this.validateDates(quotationDate ?? currentDates.quotationDate, validUntil ?? currentDates.validUntil);
      }

      if (payload.customerId) {
        await this.ensureCustomerExists(transaction, context, payload.customerId);
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesQuotations
          SET CustomerId = COALESCE(@CustomerId, CustomerId),
              QuotationDate = COALESCE(@QuotationDate, QuotationDate),
              ValidUntil = COALESCE(@ValidUntil, ValidUntil),
              CurrencyCode = COALESCE(@CurrencyCode, CurrencyCode),
              ExchangeRate = COALESCE(@ExchangeRate, ExchangeRate),
              Reference = COALESCE(@Reference, Reference),
              Notes = COALESCE(@Notes, Notes),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND SalesQuotationId = @SalesQuotationId;
        `,
        [
          { name: "SalesQuotationId", value: salesQuotationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "CustomerId", value: payload.customerId ?? null },
          { name: "QuotationDate", value: quotationDate ?? null },
          { name: "ValidUntil", value: validUntil ?? null },
          { name: "CurrencyCode", value: payload.currencyCode ?? null },
          { name: "ExchangeRate", value: payload.exchangeRate ?? null },
          { name: "Reference", value: payload.reference ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getQuotation(context, salesQuotationId);
  }

  async addLine(
    context: SalesQuotationContextInput,
    salesQuotationId: string,
    payload: SalesQuotationLineCreatePayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      await this.ensureEditableDraft(transaction, context, salesQuotationId);
      const item = await this.ensureItemExists(transaction, context, payload.itemId);
      await this.ensureUnitOfMeasureExists(transaction, context, payload.unitOfMeasureId);
      const calculated = this.calculateLine({
        ...payload,
        description: payload.description ?? item.Description
      });
      const lineNumber = await this.getNextLineNumber(transaction, context, salesQuotationId);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesQuotationLines (
            SalesQuotationLineId,
            SalesQuotationId,
            TenantId,
            CompanyId,
            LineNumber,
            ItemId,
            UnitOfMeasureId,
            Description,
            Quantity,
            UnitPrice,
            DiscountPercent,
            DiscountAmount,
            TaxPercent,
            TaxAmount,
            LineSubtotal,
            LineTotal,
            Notes,
            CreatedBy
          )
          VALUES (
            @SalesQuotationLineId,
            @SalesQuotationId,
            @TenantId,
            @CompanyId,
            @LineNumber,
            @ItemId,
            @UnitOfMeasureId,
            @Description,
            @Quantity,
            @UnitPrice,
            @DiscountPercent,
            @DiscountAmount,
            @TaxPercent,
            @TaxAmount,
            @LineSubtotal,
            @LineTotal,
            @Notes,
            @UserId
          );
        `,
        [
          { name: "SalesQuotationLineId", value: randomUUID() },
          { name: "SalesQuotationId", value: salesQuotationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "LineNumber", value: lineNumber },
          { name: "ItemId", value: payload.itemId },
          { name: "UnitOfMeasureId", value: payload.unitOfMeasureId },
          { name: "Description", value: calculated.description },
          { name: "Quantity", value: calculated.quantity },
          { name: "UnitPrice", value: calculated.unitPrice },
          { name: "DiscountPercent", value: calculated.discountPercent },
          { name: "DiscountAmount", value: calculated.discountAmount },
          { name: "TaxPercent", value: calculated.taxPercent },
          { name: "TaxAmount", value: calculated.taxAmount },
          { name: "LineSubtotal", value: calculated.lineSubtotal },
          { name: "LineTotal", value: calculated.lineTotal },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.recalculateTotals(transaction, context, salesQuotationId);
    });

    return this.getQuotation(context, salesQuotationId);
  }

  async updateLine(
    context: SalesQuotationContextInput,
    salesQuotationId: string,
    salesQuotationLineId: string,
    payload: SalesQuotationLineUpdatePayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      await this.ensureEditableDraft(transaction, context, salesQuotationId);
      const existing = await this.getLineForUpdate(transaction, context, salesQuotationId, salesQuotationLineId);
      const itemId = payload.itemId ?? existing.ItemId;
      const unitOfMeasureId = payload.unitOfMeasureId ?? existing.UnitOfMeasureId;
      const item = await this.ensureItemExists(transaction, context, itemId);
      await this.ensureUnitOfMeasureExists(transaction, context, unitOfMeasureId);
      const calculated = this.calculateLine({
        itemId,
        unitOfMeasureId,
        description: payload.description ?? existing.Description ?? item.Description,
        quantity: payload.quantity ?? Number(existing.Quantity),
        unitPrice: payload.unitPrice ?? Number(existing.UnitPrice),
        discountPercent: payload.discountPercent ?? Number(existing.DiscountPercent),
        taxPercent: payload.taxPercent ?? Number(existing.TaxPercent),
        notes: payload.notes ?? existing.Notes
      });

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesQuotationLines
          SET ItemId = @ItemId,
              UnitOfMeasureId = @UnitOfMeasureId,
              Description = @Description,
              Quantity = @Quantity,
              UnitPrice = @UnitPrice,
              DiscountPercent = @DiscountPercent,
              DiscountAmount = @DiscountAmount,
              TaxPercent = @TaxPercent,
              TaxAmount = @TaxAmount,
              LineSubtotal = @LineSubtotal,
              LineTotal = @LineTotal,
              Notes = @Notes,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesQuotationLineId = @SalesQuotationLineId
            AND SalesQuotationId = @SalesQuotationId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SalesQuotationLineId", value: salesQuotationLineId },
          { name: "SalesQuotationId", value: salesQuotationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "ItemId", value: itemId },
          { name: "UnitOfMeasureId", value: unitOfMeasureId },
          { name: "Description", value: calculated.description },
          { name: "Quantity", value: calculated.quantity },
          { name: "UnitPrice", value: calculated.unitPrice },
          { name: "DiscountPercent", value: calculated.discountPercent },
          { name: "DiscountAmount", value: calculated.discountAmount },
          { name: "TaxPercent", value: calculated.taxPercent },
          { name: "TaxAmount", value: calculated.taxAmount },
          { name: "LineSubtotal", value: calculated.lineSubtotal },
          { name: "LineTotal", value: calculated.lineTotal },
          { name: "Notes", value: payload.notes ?? existing.Notes },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.recalculateTotals(transaction, context, salesQuotationId);
    });

    return this.getQuotation(context, salesQuotationId);
  }

  async deleteLine(
    context: SalesQuotationContextInput,
    salesQuotationId: string,
    salesQuotationLineId: string
  ) {
    await this.executeInTransaction(async (transaction) => {
      await this.ensureEditableDraft(transaction, context, salesQuotationId);
      await this.getLineForUpdate(transaction, context, salesQuotationId, salesQuotationLineId);

      await this.queryInTransaction(
        transaction,
        `
          DELETE FROM sales.SalesQuotationLines
          WHERE SalesQuotationLineId = @SalesQuotationLineId
            AND SalesQuotationId = @SalesQuotationId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SalesQuotationLineId", value: salesQuotationLineId },
          { name: "SalesQuotationId", value: salesQuotationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      await this.recalculateTotals(transaction, context, salesQuotationId);
    });

    return this.getQuotation(context, salesQuotationId);
  }

  async transition(context: SalesQuotationContextInput, salesQuotationId: string, action: "send" | "approve" | "reject" | "expire") {
    await this.executeInTransaction(async (transaction) => {
      const current = await this.lockQuotation(transaction, context, salesQuotationId);
      const nowColumn =
        action === "send" ? "SentAt" : action === "approve" ? "ApprovedAt" : action === "reject" ? "RejectedAt" : "ExpiredAt";
      const byColumn =
        action === "send" ? "SentBy" : action === "approve" ? "ApprovedBy" : action === "reject" ? "RejectedBy" : "ExpiredBy";
      const nextStatus =
        action === "send" ? "SENT" : action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "EXPIRED";

      if (action === "send") {
        if (current.Status !== "DRAFT") {
          throw this.invalidStatus("SALES_QUOTATION_SEND_INVALID_STATUS", "Solo cotizaciones en borrador pueden enviarse.");
        }
        if (Number(current.LineCount) < 1 || Number(current.TotalAmount) <= 0) {
          throw this.invalidStatus("SALES_QUOTATION_SEND_EMPTY", "La cotizacion debe tener lineas y total mayor que cero.");
        }
        if (new Date(current.ValidUntil).getTime() < Date.now()) {
          throw this.invalidStatus("SALES_QUOTATION_SEND_EXPIRED", "La cotizacion esta vencida y no puede enviarse.");
        }
      } else if (action === "approve" && current.Status !== "SENT") {
        throw this.invalidStatus("SALES_QUOTATION_APPROVE_INVALID_STATUS", "Solo cotizaciones enviadas pueden aprobarse.");
      } else if (action === "reject" && current.Status !== "SENT") {
        throw this.invalidStatus("SALES_QUOTATION_REJECT_INVALID_STATUS", "Solo cotizaciones enviadas pueden rechazarse.");
      } else if (action === "expire" && current.Status !== "DRAFT" && current.Status !== "SENT") {
        throw this.invalidStatus("SALES_QUOTATION_EXPIRE_INVALID_STATUS", "Solo cotizaciones en borrador o enviadas pueden expirar.");
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesQuotations
          SET Status = @Status,
              ${nowColumn} = SYSUTCDATETIME(),
              ${byColumn} = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND SalesQuotationId = @SalesQuotationId;
        `,
        [
          { name: "SalesQuotationId", value: salesQuotationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "Status", value: nextStatus },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

    });

    return this.getQuotation(context, salesQuotationId);
  }

  private async getQuotationLines(context: SalesQuotationContextInput, salesQuotationId: string) {
    const rows = await this.query<LineRow>(
      `
        SELECT *
        FROM sales.V_SalesQuotationLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesQuotationId = @SalesQuotationId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId }
      ]
    );

    return rows.map((row) => this.mapLine(row));
  }

  private async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ) {
    const request = new sql.Request(transaction);

    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }

    const result = await request.query<TRecord>(sqlText);
    return result.recordset;
  }

  private async ensureCustomerExists(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    customerId: string
  ) {
    const rows = await this.queryInTransaction<EntityExistsRow>(
      transaction,
      `
        SELECT CustomerId AS EntityId
        FROM crm.Customers
        WHERE TenantId = @TenantId
          AND (CompanyId = @CompanyId OR CompanyId IS NULL)
          AND CustomerId = @CustomerId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerId", value: customerId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_QUOTATION_CUSTOMER_NOT_FOUND",
        message: "El cliente no existe o no esta activo.",
        isOperational: true
      });
    }
  }

  private async ensureItemExists(transaction: sql.Transaction, context: SalesQuotationContextInput, itemId: string) {
    const rows = await this.queryInTransaction<ItemRow>(
      transaction,
      `
        SELECT ItemId, Description
        FROM inventory.Items
        WHERE TenantId = @TenantId
          AND (CompanyId = @CompanyId OR CompanyId IS NULL)
          AND ItemId = @ItemId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ItemId", value: itemId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_QUOTATION_ITEM_NOT_FOUND",
        message: "El articulo no existe o no esta activo.",
        isOperational: true
      });
    }

    return row;
  }

  private async ensureUnitOfMeasureExists(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    unitOfMeasureId: string
  ) {
    const rows = await this.queryInTransaction<EntityExistsRow>(
      transaction,
      `
        SELECT UnitOfMeasureId AS EntityId
        FROM core.UnitsOfMeasure
        WHERE TenantId = @TenantId
          AND (CompanyId = @CompanyId OR CompanyId IS NULL)
          AND UnitOfMeasureId = @UnitOfMeasureId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "UnitOfMeasureId", value: unitOfMeasureId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_QUOTATION_UNIT_NOT_FOUND",
        message: "La unidad de medida no existe o no esta activa.",
        isOperational: true
      });
    }
  }

  private async ensureEditableDraft(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    salesQuotationId: string
  ) {
    const current = await this.lockQuotation(transaction, context, salesQuotationId);

    if (current.Status !== "DRAFT") {
      throw this.invalidStatus("SALES_QUOTATION_LINE_INVALID_STATUS", "Solo se pueden editar lineas en cotizaciones en borrador.");
    }
  }

  private async lockQuotation(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    salesQuotationId: string
  ) {
    const rows = await this.queryInTransaction<StatusRow>(
      transaction,
      `
        SELECT
          quotation.Status,
          quotation.ValidUntil,
          quotation.TotalAmount,
          COUNT(line.SalesQuotationLineId) AS LineCount
        FROM sales.SalesQuotations quotation WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        LEFT JOIN sales.SalesQuotationLines line
          ON line.SalesQuotationId = quotation.SalesQuotationId
        WHERE quotation.TenantId = @TenantId
          AND quotation.CompanyId = @CompanyId
          AND quotation.SalesQuotationId = @SalesQuotationId
        GROUP BY quotation.Status, quotation.ValidUntil, quotation.TotalAmount;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales quotation not found.", { salesQuotationId }, "SALES_QUOTATION_NOT_FOUND");
    }

    return row;
  }

  private async getQuotationDates(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    salesQuotationId: string
  ) {
    const rows = await this.queryInTransaction<{ QuotationDate: Date; ValidUntil: Date }>(
      transaction,
      `
        SELECT QuotationDate, ValidUntil
        FROM sales.SalesQuotations
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesQuotationId = @SalesQuotationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId }
      ]
    );

    return {
      quotationDate: rows[0]!.QuotationDate,
      validUntil: rows[0]!.ValidUntil
    };
  }

  private async getLineForUpdate(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    salesQuotationId: string,
    salesQuotationLineId: string
  ) {
    const rows = await this.queryInTransaction<ExistingLineRow>(
      transaction,
      `
        SELECT
          SalesQuotationLineId,
          ItemId,
          UnitOfMeasureId,
          Description,
          Quantity,
          UnitPrice,
          DiscountPercent,
          TaxPercent,
          Notes
        FROM sales.SalesQuotationLines WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesQuotationId = @SalesQuotationId
          AND SalesQuotationLineId = @SalesQuotationLineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId },
        { name: "SalesQuotationLineId", value: salesQuotationLineId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales quotation line not found.", { salesQuotationLineId }, "SALES_QUOTATION_LINE_NOT_FOUND");
    }

    return row;
  }

  private async getNextLineNumber(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    salesQuotationId: string
  ) {
    const rows = await this.queryInTransaction<{ NextLineNumber: number }>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS NextLineNumber
        FROM sales.SalesQuotationLines WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesQuotationId = @SalesQuotationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId }
      ]
    );

    return Number(rows[0]?.NextLineNumber ?? 1);
  }

  private async recalculateTotals(
    transaction: sql.Transaction,
    context: SalesQuotationContextInput,
    salesQuotationId: string
  ) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE quotation
        SET SubtotalAmount = totals.SubtotalAmount,
            DiscountAmount = totals.DiscountAmount,
            TaxAmount = totals.TaxAmount,
            TotalAmount = totals.TotalAmount,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        FROM sales.SalesQuotations quotation
        CROSS APPLY (
          SELECT
            COALESCE(SUM(LineSubtotal), 0) AS SubtotalAmount,
            COALESCE(SUM(DiscountAmount), 0) AS DiscountAmount,
            COALESCE(SUM(TaxAmount), 0) AS TaxAmount,
            COALESCE(SUM(LineTotal), 0) AS TotalAmount
          FROM sales.SalesQuotationLines line
          WHERE line.SalesQuotationId = quotation.SalesQuotationId
        ) totals
        WHERE quotation.TenantId = @TenantId
          AND quotation.CompanyId = @CompanyId
          AND quotation.SalesQuotationId = @SalesQuotationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesQuotationId", value: salesQuotationId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async generateQuotationNumber(transaction: sql.Transaction, context: SalesQuotationContextInput) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const quotationNumber = this.buildQuotationNumber();
      const rows = await this.queryInTransaction<NumberRow>(
        transaction,
        `
          SELECT QuotationNumber
          FROM sales.SalesQuotations WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND QuotationNumber = @QuotationNumber;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "QuotationNumber", value: quotationNumber }
        ]
      );

      if (!rows[0]) {
        return quotationNumber;
      }
    }

    throw new AppError({
      statusCode: 409,
      code: "SALES_QUOTATION_NUMBER_COLLISION",
      message: "No se pudo generar un numero unico de cotizacion.",
      isOperational: true
    });
  }

  private buildQuotationNumber() {
    const now = new Date();
    const date = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 8);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    return `COT-${date}-${suffix}`;
  }

  private validateDates(quotationDate: Date, validUntil: Date) {
    if (Number.isNaN(quotationDate.getTime()) || Number.isNaN(validUntil.getTime())) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_QUOTATION_INVALID_DATES",
        message: "Las fechas de la cotizacion no son validas.",
        isOperational: true
      });
    }

    if (validUntil.getTime() < quotationDate.getTime()) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_QUOTATION_VALID_UNTIL_BEFORE_DATE",
        message: "La vigencia no puede ser menor que la fecha de cotizacion.",
        isOperational: true
      });
    }
  }

  private calculateLine(payload: SalesQuotationLineCreatePayload): CalculatedLine {
    const quantity = this.round(payload.quantity);
    const unitPrice = this.round(payload.unitPrice);
    const discountPercent = this.round(payload.discountPercent ?? 0);
    const taxPercent = this.round(payload.taxPercent ?? 0);
    const lineSubtotal = this.round(quantity * unitPrice);
    const discountAmount = this.round((lineSubtotal * discountPercent) / 100);
    const baseAfterDiscount = this.round(lineSubtotal - discountAmount);
    const taxAmount = this.round((baseAfterDiscount * taxPercent) / 100);
    const lineTotal = this.round(baseAfterDiscount + taxAmount);

    if (lineTotal < 0) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_QUOTATION_NEGATIVE_LINE_TOTAL",
        message: "El total de la linea no puede ser negativo.",
        isOperational: true
      });
    }

    return {
      description: payload.description?.trim() || "Articulo cotizado",
      quantity,
      unitPrice,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      lineSubtotal,
      lineTotal
    };
  }

  private round(value: number) {
    return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
  }

  private invalidStatus(code: string, message: string) {
    return new AppError({
      statusCode: 409,
      code,
      message,
      isOperational: true
    });
  }

  private mapQuotation(row: QuotationRow, lines: SalesQuotationLineResult[]): SalesQuotationResult {
    return {
      id: row.SalesQuotationId,
      quotationNumber: row.QuotationNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      quotationDate: row.QuotationDate,
      validUntil: row.ValidUntil,
      currencyCode: row.CurrencyCode,
      exchangeRate: Number(row.ExchangeRate),
      status: row.Status,
      subtotalAmount: Number(row.SubtotalAmount),
      discountAmount: Number(row.DiscountAmount),
      taxAmount: Number(row.TaxAmount),
      totalAmount: Number(row.TotalAmount),
      lineCount: Number(row.LineCount),
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      sentAt: row.SentAt ?? undefined,
      approvedAt: row.ApprovedAt ?? undefined,
      rejectedAt: row.RejectedAt ?? undefined,
      expiredAt: row.ExpiredAt ?? undefined,
      lines
    };
  }

  private mapLine(row: LineRow): SalesQuotationLineResult {
    return {
      id: row.SalesQuotationLineId,
      salesQuotationId: row.SalesQuotationId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      unitOfMeasureId: row.UnitOfMeasureId,
      unitOfMeasureCode: row.UnitOfMeasureCode,
      unitOfMeasureName: row.UnitOfMeasureName,
      description: row.Description,
      quantity: Number(row.Quantity),
      unitPrice: Number(row.UnitPrice),
      discountPercent: Number(row.DiscountPercent),
      discountAmount: Number(row.DiscountAmount),
      taxPercent: Number(row.TaxPercent),
      taxAmount: Number(row.TaxAmount),
      lineSubtotal: Number(row.LineSubtotal),
      lineTotal: Number(row.LineTotal),
      notes: row.Notes ?? undefined
    };
  }
}

export const salesQuotationRepository = new SalesQuotationRepository();
