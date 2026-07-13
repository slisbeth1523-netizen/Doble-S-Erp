import { randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SalesOrderCancelPayload,
  SalesOrderCreatePayload,
  SalesOrderLineCreatePayload,
  SalesOrderLineUpdatePayload,
  SalesOrderListQuery,
  SalesOrderUpdatePayload
} from "../validators/sales-order.validators.js";

export type SalesOrderStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED" | "CLOSED";

export type SalesOrderContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SalesOrderContext = SalesOrderContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type SalesOrderCreateInput = SalesOrderContextInput & SalesOrderCreatePayload;
export type SalesOrderUpdateInput = SalesOrderContextInput & SalesOrderUpdatePayload;

export type SalesOrderLineResult = {
  id: string;
  salesOrderId: string;
  sourceQuotationLineId?: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  unitOfMeasureName: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
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

export type SalesOrderResult = {
  id: string;
  orderNumber: string;
  sourceQuotationId?: string;
  sourceQuotationNumber?: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  orderDate: Date;
  requestedDeliveryDate?: Date;
  currencyCode: string;
  exchangeRate: number;
  status: SalesOrderStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  lineCount: number;
  reference?: string;
  notes?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  lines: SalesOrderLineResult[];
};

export type SalesOrderListResult = {
  records: SalesOrderResult[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
};

type OrderRow = {
  SalesOrderId: string;
  OrderNumber: string;
  SourceQuotationId: string | null;
  SourceQuotationNumber: string | null;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  OrderDate: Date;
  RequestedDeliveryDate: Date | null;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: SalesOrderStatus;
  SubtotalAmount: number;
  DiscountAmount: number;
  TaxAmount: number;
  TotalAmount: number;
  LineCount: number;
  Reference: string | null;
  Notes: string | null;
  SubmittedAt: Date | null;
  ApprovedAt: Date | null;
  RejectedAt: Date | null;
  CancelledAt: Date | null;
  CancellationReason: string | null;
};

type LineRow = {
  SalesOrderLineId: string;
  SalesOrderId: string;
  SourceQuotationLineId: string | null;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  UnitOfMeasureId: string;
  UnitOfMeasureCode: string;
  UnitOfMeasureName: string;
  WarehouseId: string | null;
  WarehouseCode: string | null;
  WarehouseName: string | null;
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

type NumberRow = {
  OrderNumber: string;
};

type StatusRow = {
  Status: SalesOrderStatus;
  TotalAmount: number;
  LineCount: number;
};

type DatesRow = {
  OrderDate: Date;
  RequestedDeliveryDate: Date | null;
};

type ExistingLineRow = {
  SalesOrderLineId: string;
  ItemId: string;
  UnitOfMeasureId: string;
  WarehouseId: string | null;
  Description: string;
  Quantity: number;
  UnitPrice: number;
  DiscountPercent: number;
  TaxPercent: number;
  Notes: string | null;
};

type QuotationForConversionRow = {
  SalesQuotationId: string;
  QuotationNumber: string;
  CustomerId: string;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: string;
  SubtotalAmount: number;
  DiscountAmount: number;
  TaxAmount: number;
  TotalAmount: number;
  Reference: string | null;
  Notes: string | null;
  LineCount: number;
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

export class SalesOrderRepository extends BaseSqlRepository {
  async createOrder(input: SalesOrderCreateInput): Promise<SalesOrderResult> {
    const orderId = await this.executeInTransaction(async (transaction) => {
      const orderDate = input.orderDate ? new Date(input.orderDate) : new Date();
      const requestedDeliveryDate = input.requestedDeliveryDate ? new Date(input.requestedDeliveryDate) : null;

      this.validateDates(orderDate, requestedDeliveryDate);
      await this.ensureCustomerExists(transaction, input, input.customerId);

      const salesOrderId = randomUUID();
      const orderNumber = await this.generateOrderNumber(transaction, input);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesOrders (
            SalesOrderId,
            TenantId,
            CompanyId,
            OrderNumber,
            CustomerId,
            OrderDate,
            RequestedDeliveryDate,
            CurrencyCode,
            ExchangeRate,
            Status,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SalesOrderId,
            @TenantId,
            @CompanyId,
            @OrderNumber,
            @CustomerId,
            @OrderDate,
            @RequestedDeliveryDate,
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
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "OrderNumber", value: orderNumber },
          { name: "CustomerId", value: input.customerId },
          { name: "OrderDate", value: orderDate },
          { name: "RequestedDeliveryDate", value: requestedDeliveryDate },
          { name: "CurrencyCode", value: input.currencyCode },
          { name: "ExchangeRate", value: input.exchangeRate ?? 1 },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return salesOrderId;
    });

    return this.getOrder(input, orderId);
  }

  async createFromQuotation(
    context: SalesOrderContextInput,
    sourceQuotationId: string
  ): Promise<{ order: SalesOrderResult; reusedExisting: boolean }> {
    const result = await this.executeInTransaction(async (transaction) => {
      const quotation = await this.lockQuotationForConversion(transaction, context, sourceQuotationId);
      const existingOrderId = await this.getExistingOrderIdForQuotation(transaction, context, sourceQuotationId);

      if (existingOrderId) {
        return { salesOrderId: existingOrderId, reusedExisting: true };
      }

      if (quotation.Status !== "APPROVED") {
        throw new AppError({
          statusCode: 409,
          code: "SALES_ORDER_QUOTATION_NOT_APPROVED",
          message: "Solo se pueden convertir cotizaciones aprobadas sin pedido previo.",
          isOperational: true
        });
      }

      if (Number(quotation.LineCount) < 1 || Number(quotation.TotalAmount) <= 0) {
        throw new AppError({
          statusCode: 409,
          code: "SALES_ORDER_QUOTATION_EMPTY",
          message: "La cotizacion debe tener lineas y total mayor que cero para convertirse.",
          isOperational: true
        });
      }

      const salesOrderId = randomUUID();
      const orderNumber = await this.generateOrderNumber(transaction, context);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesOrders (
            SalesOrderId,
            TenantId,
            CompanyId,
            OrderNumber,
            SourceQuotationId,
            SourceQuotationNumber,
            CustomerId,
            OrderDate,
            RequestedDeliveryDate,
            CurrencyCode,
            ExchangeRate,
            Status,
            SubtotalAmount,
            DiscountAmount,
            TaxAmount,
            TotalAmount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SalesOrderId,
            @TenantId,
            @CompanyId,
            @OrderNumber,
            @SourceQuotationId,
            @SourceQuotationNumber,
            @CustomerId,
            SYSUTCDATETIME(),
            NULL,
            @CurrencyCode,
            @ExchangeRate,
            'DRAFT',
            @SubtotalAmount,
            @DiscountAmount,
            @TaxAmount,
            @TotalAmount,
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "OrderNumber", value: orderNumber },
          { name: "SourceQuotationId", value: sourceQuotationId },
          { name: "SourceQuotationNumber", value: quotation.QuotationNumber },
          { name: "CustomerId", value: quotation.CustomerId },
          { name: "CurrencyCode", value: quotation.CurrencyCode },
          { name: "ExchangeRate", value: quotation.ExchangeRate },
          { name: "SubtotalAmount", value: quotation.SubtotalAmount },
          { name: "DiscountAmount", value: quotation.DiscountAmount },
          { name: "TaxAmount", value: quotation.TaxAmount },
          { name: "TotalAmount", value: quotation.TotalAmount },
          { name: "Reference", value: quotation.Reference },
          { name: "Notes", value: quotation.Notes },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesOrderLines (
            SalesOrderLineId,
            SalesOrderId,
            TenantId,
            CompanyId,
            SourceQuotationLineId,
            LineNumber,
            ItemId,
            UnitOfMeasureId,
            WarehouseId,
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
          SELECT
            NEWID(),
            @SalesOrderId,
            quotationLine.TenantId,
            quotationLine.CompanyId,
            quotationLine.SalesQuotationLineId,
            quotationLine.LineNumber,
            quotationLine.ItemId,
            quotationLine.UnitOfMeasureId,
            NULL,
            quotationLine.Description,
            quotationLine.Quantity,
            quotationLine.UnitPrice,
            quotationLine.DiscountPercent,
            quotationLine.DiscountAmount,
            quotationLine.TaxPercent,
            quotationLine.TaxAmount,
            quotationLine.LineSubtotal,
            quotationLine.LineTotal,
            quotationLine.Notes,
            @UserId
          FROM sales.SalesQuotationLines quotationLine
          WHERE quotationLine.TenantId = @TenantId
            AND quotationLine.CompanyId = @CompanyId
            AND quotationLine.SalesQuotationId = @SourceQuotationId
          ORDER BY quotationLine.LineNumber ASC;
        `,
        [
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "SourceQuotationId", value: sourceQuotationId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesQuotations
          SET Status = 'CONVERTED',
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND SalesQuotationId = @SourceQuotationId;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "SourceQuotationId", value: sourceQuotationId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      return { salesOrderId, reusedExisting: false };
    });

    return {
      order: await this.getOrder(context, result.salesOrderId),
      reusedExisting: result.reusedExisting
    };
  }

  async listOrders(context: SalesOrderContextInput, query: SalesOrderListQuery): Promise<SalesOrderListResult> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "SourceQuotationId", value: query.sourceQuotationId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "DateFrom", value: query.dateFrom ?? null },
      { name: "DateTo", value: query.dateTo ?? null },
      { name: "RequestedDeliveryFrom", value: query.requestedDeliveryFrom ?? null },
      { name: "RequestedDeliveryTo", value: query.requestedDeliveryTo ?? null },
      { name: "Search", value: search }
    ];

    const whereClause = `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@SourceQuotationId IS NULL OR SourceQuotationId = @SourceQuotationId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@DateFrom IS NULL OR CAST(OrderDate AS date) >= CAST(@DateFrom AS date))
      AND (@DateTo IS NULL OR CAST(OrderDate AS date) <= CAST(@DateTo AS date))
      AND (@RequestedDeliveryFrom IS NULL OR CAST(RequestedDeliveryDate AS date) >= CAST(@RequestedDeliveryFrom AS date))
      AND (@RequestedDeliveryTo IS NULL OR CAST(RequestedDeliveryDate AS date) <= CAST(@RequestedDeliveryTo AS date))
      AND (
        @Search IS NULL
        OR OrderNumber LIKE @Search
        OR SourceQuotationNumber LIKE @Search
        OR CustomerCode LIKE @Search
        OR CustomerName LIKE @Search
        OR Reference LIKE @Search
      )
    `;

    const [rows, countRows] = await Promise.all([
      this.query<OrderRow>(
        `
          SELECT *
          FROM sales.V_SalesOrderSummary
          WHERE ${whereClause}
          ORDER BY OrderDate DESC, OrderNumber DESC
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
          FROM sales.V_SalesOrderSummary
          WHERE ${whereClause};
        `,
        parameters
      )
    ]);

    return {
      records: rows.map((row) => this.mapOrder(row, [])),
      pagination: {
        page,
        pageSize,
        totalItems: Number(countRows[0]?.TotalItems ?? 0)
      }
    };
  }

  async getOrder(context: SalesOrderContextInput, salesOrderId: string): Promise<SalesOrderResult> {
    const rows = await this.query<OrderRow>(
      `
        SELECT *
        FROM sales.V_SalesOrderSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderId = @SalesOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales order not found.", { salesOrderId }, "SALES_ORDER_NOT_FOUND");
    }

    const lines = await this.getOrderLines(context, salesOrderId);
    return this.mapOrder(row, lines);
  }

  async updateOrder(
    context: SalesOrderContextInput,
    salesOrderId: string,
    payload: SalesOrderUpdatePayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      const current = await this.lockOrder(transaction, context, salesOrderId);

      if (current.Status !== "DRAFT") {
        throw this.invalidStatus("SALES_ORDER_UPDATE_INVALID_STATUS", "Solo se pueden editar pedidos en borrador.");
      }

      const orderDate = payload.orderDate ? new Date(payload.orderDate) : undefined;
      const requestedDeliveryDate =
        payload.requestedDeliveryDate === null
          ? null
          : payload.requestedDeliveryDate
            ? new Date(payload.requestedDeliveryDate)
            : undefined;

      if (orderDate || requestedDeliveryDate !== undefined) {
        const currentDates = await this.getOrderDates(transaction, context, salesOrderId);
        this.validateDates(
          orderDate ?? currentDates.OrderDate,
          requestedDeliveryDate === undefined ? currentDates.RequestedDeliveryDate : requestedDeliveryDate
        );
      }

      if (payload.customerId) {
        await this.ensureCustomerExists(transaction, context, payload.customerId);
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesOrders
          SET CustomerId = COALESCE(@CustomerId, CustomerId),
              OrderDate = COALESCE(@OrderDate, OrderDate),
              RequestedDeliveryDate = CASE WHEN @ClearRequestedDeliveryDate = 1 THEN NULL ELSE COALESCE(@RequestedDeliveryDate, RequestedDeliveryDate) END,
              CurrencyCode = COALESCE(@CurrencyCode, CurrencyCode),
              ExchangeRate = COALESCE(@ExchangeRate, ExchangeRate),
              Reference = COALESCE(@Reference, Reference),
              Notes = COALESCE(@Notes, Notes),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND SalesOrderId = @SalesOrderId;
        `,
        [
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "CustomerId", value: payload.customerId ?? null },
          { name: "OrderDate", value: orderDate ?? null },
          { name: "RequestedDeliveryDate", value: requestedDeliveryDate instanceof Date ? requestedDeliveryDate : null },
          { name: "ClearRequestedDeliveryDate", value: payload.requestedDeliveryDate === null ? 1 : 0 },
          { name: "CurrencyCode", value: payload.currencyCode ?? null },
          { name: "ExchangeRate", value: payload.exchangeRate ?? null },
          { name: "Reference", value: payload.reference ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getOrder(context, salesOrderId);
  }

  async addLine(context: SalesOrderContextInput, salesOrderId: string, payload: SalesOrderLineCreatePayload) {
    await this.executeInTransaction(async (transaction) => {
      await this.ensureEditableDraft(transaction, context, salesOrderId);
      const item = await this.ensureItemExists(transaction, context, payload.itemId);
      await this.ensureUnitOfMeasureExists(transaction, context, payload.unitOfMeasureId);
      if (payload.warehouseId) {
        await this.ensureWarehouseExists(transaction, context, payload.warehouseId);
      }
      const calculated = this.calculateLine({ ...payload, description: payload.description ?? item.Description });
      const lineNumber = await this.getNextLineNumber(transaction, context, salesOrderId);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesOrderLines (
            SalesOrderLineId,
            SalesOrderId,
            TenantId,
            CompanyId,
            LineNumber,
            ItemId,
            UnitOfMeasureId,
            WarehouseId,
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
            @SalesOrderLineId,
            @SalesOrderId,
            @TenantId,
            @CompanyId,
            @LineNumber,
            @ItemId,
            @UnitOfMeasureId,
            @WarehouseId,
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
          { name: "SalesOrderLineId", value: randomUUID() },
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "LineNumber", value: lineNumber },
          { name: "ItemId", value: payload.itemId },
          { name: "UnitOfMeasureId", value: payload.unitOfMeasureId },
          { name: "WarehouseId", value: payload.warehouseId ?? null },
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

      await this.recalculateTotals(transaction, context, salesOrderId);
    });

    return this.getOrder(context, salesOrderId);
  }

  async updateLine(
    context: SalesOrderContextInput,
    salesOrderId: string,
    salesOrderLineId: string,
    payload: SalesOrderLineUpdatePayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      await this.ensureEditableDraft(transaction, context, salesOrderId);
      const existing = await this.getLineForUpdate(transaction, context, salesOrderId, salesOrderLineId);
      const itemId = payload.itemId ?? existing.ItemId;
      const unitOfMeasureId = payload.unitOfMeasureId ?? existing.UnitOfMeasureId;
      const warehouseId = payload.warehouseId === undefined ? existing.WarehouseId : payload.warehouseId;
      const item = await this.ensureItemExists(transaction, context, itemId);
      await this.ensureUnitOfMeasureExists(transaction, context, unitOfMeasureId);
      if (warehouseId) {
        await this.ensureWarehouseExists(transaction, context, warehouseId);
      }
      const calculated = this.calculateLine({
        itemId,
        unitOfMeasureId,
        warehouseId,
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
          UPDATE sales.SalesOrderLines
          SET ItemId = @ItemId,
              UnitOfMeasureId = @UnitOfMeasureId,
              WarehouseId = @WarehouseId,
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
          WHERE SalesOrderLineId = @SalesOrderLineId
            AND SalesOrderId = @SalesOrderId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SalesOrderLineId", value: salesOrderLineId },
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "ItemId", value: itemId },
          { name: "UnitOfMeasureId", value: unitOfMeasureId },
          { name: "WarehouseId", value: warehouseId ?? null },
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

      await this.recalculateTotals(transaction, context, salesOrderId);
    });

    return this.getOrder(context, salesOrderId);
  }

  async deleteLine(context: SalesOrderContextInput, salesOrderId: string, salesOrderLineId: string) {
    await this.executeInTransaction(async (transaction) => {
      await this.ensureEditableDraft(transaction, context, salesOrderId);
      await this.getLineForUpdate(transaction, context, salesOrderId, salesOrderLineId);

      await this.queryInTransaction(
        transaction,
        `
          DELETE FROM sales.SalesOrderLines
          WHERE SalesOrderLineId = @SalesOrderLineId
            AND SalesOrderId = @SalesOrderId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SalesOrderLineId", value: salesOrderLineId },
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      await this.recalculateTotals(transaction, context, salesOrderId);
    });

    return this.getOrder(context, salesOrderId);
  }

  async transition(
    context: SalesOrderContextInput,
    salesOrderId: string,
    action: "submit" | "approve" | "reject" | "cancel",
    payload?: SalesOrderCancelPayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      const current = await this.lockOrder(transaction, context, salesOrderId);
      const nowColumn =
        action === "submit" ? "SubmittedAt" : action === "approve" ? "ApprovedAt" : action === "reject" ? "RejectedAt" : "CancelledAt";
      const byColumn =
        action === "submit" ? "SubmittedBy" : action === "approve" ? "ApprovedBy" : action === "reject" ? "RejectedBy" : "CancelledBy";
      const nextStatus =
        action === "submit" ? "SUBMITTED" : action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "CANCELLED";

      if (action === "submit") {
        if (current.Status !== "DRAFT") {
          throw this.invalidStatus("SALES_ORDER_SUBMIT_INVALID_STATUS", "Solo pedidos en borrador pueden someterse.");
        }
        if (Number(current.LineCount) < 1 || Number(current.TotalAmount) <= 0) {
          throw this.invalidStatus("SALES_ORDER_SUBMIT_EMPTY", "El pedido debe tener lineas y total mayor que cero.");
        }
      } else if (action === "approve" && current.Status !== "SUBMITTED") {
        throw this.invalidStatus("SALES_ORDER_APPROVE_INVALID_STATUS", "Solo pedidos sometidos pueden aprobarse.");
      } else if (action === "reject" && current.Status !== "SUBMITTED") {
        throw this.invalidStatus("SALES_ORDER_REJECT_INVALID_STATUS", "Solo pedidos sometidos pueden rechazarse.");
      } else if (action === "cancel") {
        if (current.Status !== "DRAFT" && current.Status !== "SUBMITTED") {
          throw this.invalidStatus("SALES_ORDER_CANCEL_INVALID_STATUS", "Solo pedidos en borrador o sometidos pueden cancelarse.");
        }
        if (!payload?.reason?.trim()) {
          throw new AppError({
            statusCode: 400,
            code: "SALES_ORDER_CANCEL_REASON_REQUIRED",
            message: "El motivo de cancelacion es obligatorio.",
            isOperational: true
          });
        }
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesOrders
          SET Status = @Status,
              ${nowColumn} = SYSUTCDATETIME(),
              ${byColumn} = @UserId,
              CancellationReason = CASE WHEN @Status = 'CANCELLED' THEN @CancellationReason ELSE CancellationReason END,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND SalesOrderId = @SalesOrderId;
        `,
        [
          { name: "SalesOrderId", value: salesOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "Status", value: nextStatus },
          { name: "CancellationReason", value: payload?.reason ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getOrder(context, salesOrderId);
  }

  private async getOrderLines(context: SalesOrderContextInput, salesOrderId: string) {
    const rows = await this.query<LineRow>(
      `
        SELECT *
        FROM sales.V_SalesOrderLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderId = @SalesOrderId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId }
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

  private async ensureCustomerExists(transaction: sql.Transaction, context: SalesOrderContextInput, customerId: string) {
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
        code: "SALES_ORDER_CUSTOMER_NOT_FOUND",
        message: "El cliente no existe o no esta activo.",
        isOperational: true
      });
    }
  }

  private async ensureItemExists(transaction: sql.Transaction, context: SalesOrderContextInput, itemId: string) {
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
        code: "SALES_ORDER_ITEM_NOT_FOUND",
        message: "El articulo no existe o no esta activo.",
        isOperational: true
      });
    }

    return row;
  }

  private async ensureUnitOfMeasureExists(
    transaction: sql.Transaction,
    context: SalesOrderContextInput,
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
        code: "SALES_ORDER_UNIT_NOT_FOUND",
        message: "La unidad de medida no existe o no esta activa.",
        isOperational: true
      });
    }
  }

  private async ensureWarehouseExists(transaction: sql.Transaction, context: SalesOrderContextInput, warehouseId: string) {
    const rows = await this.queryInTransaction<EntityExistsRow>(
      transaction,
      `
        SELECT WarehouseId AS EntityId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND WarehouseId = @WarehouseId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_ORDER_WAREHOUSE_NOT_FOUND",
        message: "El almacen no existe o no esta activo.",
        isOperational: true
      });
    }
  }

  private async ensureEditableDraft(transaction: sql.Transaction, context: SalesOrderContextInput, salesOrderId: string) {
    const current = await this.lockOrder(transaction, context, salesOrderId);

    if (current.Status !== "DRAFT") {
      throw this.invalidStatus("SALES_ORDER_LINE_INVALID_STATUS", "Solo se pueden editar lineas en pedidos en borrador.");
    }
  }

  private async lockOrder(transaction: sql.Transaction, context: SalesOrderContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<StatusRow>(
      transaction,
      `
        SELECT
          salesOrder.Status,
          salesOrder.TotalAmount,
          COUNT(line.SalesOrderLineId) AS LineCount
        FROM sales.SalesOrders salesOrder WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        LEFT JOIN sales.SalesOrderLines line
          ON line.SalesOrderId = salesOrder.SalesOrderId
        WHERE salesOrder.TenantId = @TenantId
          AND salesOrder.CompanyId = @CompanyId
          AND salesOrder.SalesOrderId = @SalesOrderId
        GROUP BY salesOrder.Status, salesOrder.TotalAmount;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales order not found.", { salesOrderId }, "SALES_ORDER_NOT_FOUND");
    }

    return row;
  }

  private async lockQuotationForConversion(
    transaction: sql.Transaction,
    context: SalesOrderContextInput,
    sourceQuotationId: string
  ) {
    const rows = await this.queryInTransaction<QuotationForConversionRow>(
      transaction,
      `
        SELECT
          quotation.SalesQuotationId,
          quotation.QuotationNumber,
          quotation.CustomerId,
          quotation.CurrencyCode,
          quotation.ExchangeRate,
          quotation.Status,
          quotation.SubtotalAmount,
          quotation.DiscountAmount,
          quotation.TaxAmount,
          quotation.TotalAmount,
          quotation.Reference,
          quotation.Notes,
          COUNT(line.SalesQuotationLineId) AS LineCount
        FROM sales.SalesQuotations quotation WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        LEFT JOIN sales.SalesQuotationLines line
          ON line.SalesQuotationId = quotation.SalesQuotationId
        WHERE quotation.TenantId = @TenantId
          AND quotation.CompanyId = @CompanyId
          AND quotation.SalesQuotationId = @SourceQuotationId
        GROUP BY
          quotation.SalesQuotationId,
          quotation.QuotationNumber,
          quotation.CustomerId,
          quotation.CurrencyCode,
          quotation.ExchangeRate,
          quotation.Status,
          quotation.SubtotalAmount,
          quotation.DiscountAmount,
          quotation.TaxAmount,
          quotation.TotalAmount,
          quotation.Reference,
          quotation.Notes;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SourceQuotationId", value: sourceQuotationId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales quotation not found.", { sourceQuotationId }, "SALES_QUOTATION_NOT_FOUND");
    }

    return row;
  }

  private async getExistingOrderIdForQuotation(
    transaction: sql.Transaction,
    context: SalesOrderContextInput,
    sourceQuotationId: string
  ) {
    const rows = await this.queryInTransaction<{ SalesOrderId: string }>(
      transaction,
      `
        SELECT SalesOrderId
        FROM sales.SalesOrders WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceQuotationId = @SourceQuotationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SourceQuotationId", value: sourceQuotationId }
      ]
    );

    return rows[0]?.SalesOrderId;
  }

  private async getOrderDates(transaction: sql.Transaction, context: SalesOrderContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<DatesRow>(
      transaction,
      `
        SELECT OrderDate, RequestedDeliveryDate
        FROM sales.SalesOrders
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderId = @SalesOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId }
      ]
    );

    return rows[0]!;
  }

  private async getLineForUpdate(
    transaction: sql.Transaction,
    context: SalesOrderContextInput,
    salesOrderId: string,
    salesOrderLineId: string
  ) {
    const rows = await this.queryInTransaction<ExistingLineRow>(
      transaction,
      `
        SELECT
          SalesOrderLineId,
          ItemId,
          UnitOfMeasureId,
          WarehouseId,
          Description,
          Quantity,
          UnitPrice,
          DiscountPercent,
          TaxPercent,
          Notes
        FROM sales.SalesOrderLines WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderId = @SalesOrderId
          AND SalesOrderLineId = @SalesOrderLineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId },
        { name: "SalesOrderLineId", value: salesOrderLineId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales order line not found.", { salesOrderLineId }, "SALES_ORDER_LINE_NOT_FOUND");
    }

    return row;
  }

  private async getNextLineNumber(transaction: sql.Transaction, context: SalesOrderContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<{ NextLineNumber: number }>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS NextLineNumber
        FROM sales.SalesOrderLines WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderId = @SalesOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId }
      ]
    );

    return Number(rows[0]?.NextLineNumber ?? 1);
  }

  private async recalculateTotals(transaction: sql.Transaction, context: SalesOrderContextInput, salesOrderId: string) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE salesOrder
        SET SubtotalAmount = totals.SubtotalAmount,
            DiscountAmount = totals.DiscountAmount,
            TaxAmount = totals.TaxAmount,
            TotalAmount = totals.TotalAmount,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        FROM sales.SalesOrders salesOrder
        CROSS APPLY (
          SELECT
            COALESCE(SUM(LineSubtotal), 0) AS SubtotalAmount,
            COALESCE(SUM(DiscountAmount), 0) AS DiscountAmount,
            COALESCE(SUM(TaxAmount), 0) AS TaxAmount,
            COALESCE(SUM(LineTotal), 0) AS TotalAmount
          FROM sales.SalesOrderLines line
          WHERE line.SalesOrderId = salesOrder.SalesOrderId
        ) totals
        WHERE salesOrder.TenantId = @TenantId
          AND salesOrder.CompanyId = @CompanyId
          AND salesOrder.SalesOrderId = @SalesOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async generateOrderNumber(transaction: sql.Transaction, context: SalesOrderContextInput) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const orderNumber = this.buildOrderNumber();
      const rows = await this.queryInTransaction<NumberRow>(
        transaction,
        `
          SELECT OrderNumber
          FROM sales.SalesOrders WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND OrderNumber = @OrderNumber;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "OrderNumber", value: orderNumber }
        ]
      );

      if (!rows[0]) {
        return orderNumber;
      }
    }

    throw new AppError({
      statusCode: 409,
      code: "SALES_ORDER_NUMBER_COLLISION",
      message: "No se pudo generar un numero unico de pedido.",
      isOperational: true
    });
  }

  private buildOrderNumber() {
    const now = new Date();
    const date = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 8);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
    return `PED-${date}-${suffix}`;
  }

  private validateDates(orderDate: Date, requestedDeliveryDate?: Date | null) {
    if (Number.isNaN(orderDate.getTime()) || (requestedDeliveryDate && Number.isNaN(requestedDeliveryDate.getTime()))) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_ORDER_INVALID_DATES",
        message: "Las fechas del pedido no son validas.",
        isOperational: true
      });
    }

    if (requestedDeliveryDate && requestedDeliveryDate.getTime() < orderDate.getTime()) {
      throw new AppError({
        statusCode: 400,
        code: "SALES_ORDER_REQUESTED_DELIVERY_BEFORE_DATE",
        message: "La fecha solicitada de entrega no puede ser menor que la fecha del pedido.",
        isOperational: true
      });
    }
  }

  private calculateLine(payload: SalesOrderLineCreatePayload): CalculatedLine {
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
        code: "SALES_ORDER_NEGATIVE_LINE_TOTAL",
        message: "El total de la linea no puede ser negativo.",
        isOperational: true
      });
    }

    return {
      description: payload.description?.trim() || "Articulo pedido",
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

  private mapOrder(row: OrderRow, lines: SalesOrderLineResult[]): SalesOrderResult {
    return {
      id: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      sourceQuotationId: row.SourceQuotationId ?? undefined,
      sourceQuotationNumber: row.SourceQuotationNumber ?? undefined,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      orderDate: row.OrderDate,
      requestedDeliveryDate: row.RequestedDeliveryDate ?? undefined,
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
      submittedAt: row.SubmittedAt ?? undefined,
      approvedAt: row.ApprovedAt ?? undefined,
      rejectedAt: row.RejectedAt ?? undefined,
      cancelledAt: row.CancelledAt ?? undefined,
      cancellationReason: row.CancellationReason ?? undefined,
      lines
    };
  }

  private mapLine(row: LineRow): SalesOrderLineResult {
    return {
      id: row.SalesOrderLineId,
      salesOrderId: row.SalesOrderId,
      sourceQuotationLineId: row.SourceQuotationLineId ?? undefined,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      unitOfMeasureId: row.UnitOfMeasureId,
      unitOfMeasureCode: row.UnitOfMeasureCode,
      unitOfMeasureName: row.UnitOfMeasureName,
      warehouseId: row.WarehouseId ?? undefined,
      warehouseCode: row.WarehouseCode ?? undefined,
      warehouseName: row.WarehouseName ?? undefined,
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

export const salesOrderRepository = new SalesOrderRepository();
