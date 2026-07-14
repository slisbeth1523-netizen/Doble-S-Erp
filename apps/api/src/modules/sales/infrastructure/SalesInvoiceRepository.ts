import { createHash, randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SalesInvoiceCreatePayload,
  SalesInvoiceLineCreatePayload,
  SalesInvoiceLineUpdatePayload,
  SalesInvoiceListQuery,
  SalesInvoicePostPayload
} from "../validators/sales-invoice.validators.js";

export type SalesInvoiceContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SalesInvoiceContext = SalesInvoiceContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type SalesInvoiceStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SalesInvoiceLineResult = {
  id: string;
  salesInvoiceId: string;
  salesOrderLineId: string;
  salesShipmentId: string;
  shipmentNumber: string;
  salesShipmentLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  description: string;
  notes?: string;
};

export type SalesInvoiceResult = {
  id: string;
  invoiceNumber: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  invoiceDate: Date;
  dueDate: Date;
  currencyCode: string;
  exchangeRate: number;
  status: SalesInvoiceStatus;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  accountsReceivableDocumentId?: string;
  accountsReceivableDocumentNumber?: string;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  lineCount: number;
  totalQuantity: number;
  lines: SalesInvoiceLineResult[];
  idempotencyReplayed?: boolean;
};

export type SalesInvoicePendingLineResult = {
  salesShipmentInvoiceId: string;
  salesShipmentId: string;
  shipmentNumber: string;
  shipmentStatus: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  currencyCode: string;
  exchangeRate: number;
  salesOrderLineId: string;
  salesShipmentLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  shippedQuantity: number;
  previouslyInvoicedQuantity: number;
  pendingInvoiceQuantity: number;
};

export type PagedResult<TRecord> = {
  records: TRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
};

type InvoiceRow = {
  SalesInvoiceId: string;
  InvoiceNumber: string;
  SalesOrderId: string;
  OrderNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  InvoiceDate: Date;
  DueDate: Date;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: SalesInvoiceStatus;
  SubtotalAmount: number;
  DiscountAmount: number;
  TaxAmount: number;
  TotalAmount: number;
  AccountsReceivableDocumentId: string | null;
  AccountsReceivableDocumentNumber: string | null;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
  LineCount: number;
  TotalQuantity: number;
};

type InvoiceLineRow = {
  SalesInvoiceLineId: string;
  SalesInvoiceId: string;
  InvoiceNumber: string;
  InvoiceStatus: SalesInvoiceStatus;
  SalesOrderId: string;
  OrderNumber: string;
  SalesShipmentId: string;
  ShipmentNumber: string;
  SalesShipmentLineId: string;
  SalesOrderLineId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  UnitOfMeasureId: string;
  UnitOfMeasureCode: string;
  Quantity: number;
  UnitPrice: number;
  DiscountPercent: number;
  DiscountAmount: number;
  TaxPercent: number;
  TaxAmount: number;
  LineSubtotal: number;
  LineTotal: number;
  Description: string;
  Notes: string | null;
};

type InvoiceLockRow = {
  SalesInvoiceId: string;
  InvoiceNumber: string;
  SalesOrderId: string;
  CustomerId: string;
  InvoiceDate: Date;
  DueDate: Date;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: SalesInvoiceStatus;
  TotalAmount: number;
  AccountsReceivableDocumentId: string | null;
  Notes: string | null;
  Reference: string | null;
};

type OrderRow = {
  SalesOrderId: string;
  OrderNumber: string;
  CustomerId: string;
  CustomerActive: boolean;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: string;
};

type PendingLineRow = {
  SalesShipmentInvoiceId: string;
  SalesShipmentId: string;
  ShipmentNumber: string;
  ShipmentStatus: string;
  SalesOrderId: string;
  OrderNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  CurrencyCode: string;
  ExchangeRate: number;
  SalesOrderLineId: string;
  SalesShipmentLineId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  UnitOfMeasureId: string;
  UnitOfMeasureCode: string;
  ShippedQuantity: number;
  PreviouslyInvoicedQuantity: number;
  PendingInvoiceQuantity: number;
};

type ShipmentLineCommercialRow = {
  SalesShipmentId: string;
  SalesShipmentLineId: string;
  SalesOrderId: string;
  CustomerId: string;
  CurrencyCode: string;
  ExchangeRate: number;
  ShipmentStatus: string;
  SalesOrderLineId: string;
  ItemId: string;
  UnitOfMeasureId: string;
  Quantity: number;
  UnitPrice: number;
  DiscountPercent: number;
  TaxPercent: number;
  Description: string;
};

type CountRow = { TotalItems: number };
type TotalRow = { Total: number };
type OperationRow = {
  SalesInvoiceId: string;
  RequestHash: string;
  ResultStatus: SalesInvoiceStatus;
  AccountsReceivableDocumentId: string | null;
};

export class SalesInvoiceRepository extends BaseSqlRepository {
  async createInvoice(context: SalesInvoiceContextInput, payload: SalesInvoiceCreatePayload) {
    const invoiceId = await this.executeInTransaction(async (transaction) => {
      const order = await this.lockOrder(transaction, context, payload.salesOrderId);
      if (!["APPROVED", "CLOSED"].includes(order.Status)) {
        throw this.conflict("SALES_INVOICE_ORDER_NOT_READY", "Solo se pueden facturar pedidos aprobados o cerrados.");
      }
      if (!order.CustomerActive) {
        throw this.conflict("SALES_INVOICE_CUSTOMER_INACTIVE", "El cliente del pedido no esta activo.");
      }

      const invoiceDate = payload.invoiceDate ? new Date(payload.invoiceDate) : new Date();
      const dueDate = new Date(payload.dueDate);
      if (dueDate < invoiceDate) {
        throw this.conflict("SALES_INVOICE_INVALID_DUE_DATE", "La fecha de vencimiento no puede ser menor que la fecha de factura.");
      }

      const pending = await this.getOrderPendingInvoiceTotal(transaction, context, payload.salesOrderId);
      if (pending <= 0) {
        throw this.conflict("SALES_INVOICE_ORDER_HAS_NO_PENDING", "El pedido no tiene despachos posteados pendientes de facturar.");
      }

      const id = randomUUID();
      const invoiceNumber = await this.generateInvoiceNumber(transaction, context);
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesInvoices (
            SalesInvoiceId, TenantId, CompanyId, InvoiceNumber, SalesOrderId, CustomerId,
            InvoiceDate, DueDate, CurrencyCode, ExchangeRate, Status,
            Reference, Notes, IsActive, CreatedBy
          )
          VALUES (
            @SalesInvoiceId, @TenantId, @CompanyId, @InvoiceNumber, @SalesOrderId, @CustomerId,
            @InvoiceDate, @DueDate, @CurrencyCode, @ExchangeRate, 'DRAFT',
            @Reference, @Notes, 1, @UserId
          );
        `,
        [
          { name: "SalesInvoiceId", value: id },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "InvoiceNumber", value: invoiceNumber },
          { name: "SalesOrderId", value: order.SalesOrderId },
          { name: "CustomerId", value: order.CustomerId },
          { name: "InvoiceDate", value: invoiceDate },
          { name: "DueDate", value: dueDate },
          { name: "CurrencyCode", value: order.CurrencyCode },
          { name: "ExchangeRate", value: order.ExchangeRate },
          { name: "Reference", value: payload.reference ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      return id;
    });

    return this.getInvoice(context, invoiceId);
  }

  async listInvoices(context: SalesInvoiceContextInput, query: SalesInvoiceListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "SalesOrderId", value: query.salesOrderId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "DateFrom", value: query.dateFrom ?? null },
      { name: "DateTo", value: query.dateTo ?? null },
      { name: "DueDateFrom", value: query.dueDateFrom ?? null },
      { name: "DueDateTo", value: query.dueDateTo ?? null },
      { name: "Search", value: search }
    ];
    const where = this.invoiceWhere("invoice");
    const shipmentFilter = query.salesShipmentId
      ? " AND EXISTS (SELECT 1 FROM sales.SalesInvoiceLines filterLine WHERE filterLine.SalesInvoiceId = invoice.SalesInvoiceId AND filterLine.SalesShipmentId = @SalesShipmentId)"
      : "";
    const queryParameters = query.salesShipmentId
      ? [...parameters, { name: "SalesShipmentId", value: query.salesShipmentId }]
      : parameters;

    const [rows, counts] = await Promise.all([
      this.query<InvoiceRow>(
        `
          SELECT *
          FROM sales.V_SalesInvoiceSummary invoice
          WHERE ${where}${shipmentFilter}
          ORDER BY InvoiceDate DESC, InvoiceNumber DESC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        [...queryParameters, { name: "Offset", value: offset }, { name: "PageSize", value: pageSize }]
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM sales.V_SalesInvoiceSummary invoice
          WHERE ${where}${shipmentFilter};
        `,
        queryParameters
      )
    ]);

    const invoices = await Promise.all(rows.map((row) => this.mapInvoiceWithLines(context, row)));
    return { records: invoices, pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) } } satisfies PagedResult<SalesInvoiceResult>;
  }

  async getInvoice(context: SalesInvoiceContextInput, invoiceId: string): Promise<SalesInvoiceResult> {
    const rows = await this.query<InvoiceRow>(
      `
        SELECT *
        FROM sales.V_SalesInvoiceSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesInvoiceId = @SalesInvoiceId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Factura de venta no encontrada.", { invoiceId }, "SALES_INVOICE_NOT_FOUND");
    }
    return this.mapInvoiceWithLines(context, row);
  }

  async getOrderPendingLines(context: SalesInvoiceContextInput, salesOrderId: string) {
    return this.getPendingLines(context, { salesOrderId });
  }

  async getShipmentPendingLines(context: SalesInvoiceContextInput, salesShipmentId: string) {
    return this.getPendingLines(context, { salesShipmentId });
  }

  async addLine(context: SalesInvoiceContextInput, invoiceId: string, payload: SalesInvoiceLineCreatePayload) {
    await this.executeInTransaction(async (transaction) => {
      const invoice = await this.lockInvoice(transaction, context, invoiceId);
      this.ensureDraft(invoice);
      const sourceLine = await this.lockShipmentCommercialLine(transaction, context, payload.salesShipmentLineId);
      await this.validateSourceLineForInvoice(transaction, context, invoice, sourceLine, payload.quantity, null);
      const lineNumber = await this.nextLineNumber(transaction, invoiceId);
      await this.insertLine(transaction, context, invoiceId, sourceLine, lineNumber, payload.quantity, payload.notes ?? null);
      await this.recalculateTotals(transaction, context, invoiceId);
    });
    return this.getInvoice(context, invoiceId);
  }

  async updateLine(context: SalesInvoiceContextInput, invoiceId: string, lineId: string, payload: SalesInvoiceLineUpdatePayload) {
    await this.executeInTransaction(async (transaction) => {
      const invoice = await this.lockInvoice(transaction, context, invoiceId);
      this.ensureDraft(invoice);
      const currentLine = await this.lockInvoiceLine(transaction, context, invoiceId, lineId);
      const sourceLine = await this.lockShipmentCommercialLine(transaction, context, currentLine.SalesShipmentLineId);
      const quantity = payload.quantity ?? Number(currentLine.Quantity);
      await this.validateSourceLineForInvoice(transaction, context, invoice, sourceLine, quantity, lineId);
      const amounts = this.calculateLineAmounts(sourceLine, quantity);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesInvoiceLines
          SET Quantity = @Quantity,
              DiscountAmount = @DiscountAmount,
              TaxAmount = @TaxAmount,
              LineSubtotal = @LineSubtotal,
              LineTotal = @LineTotal,
              Notes = COALESCE(@Notes, Notes),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesInvoiceLineId = @LineId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "LineId", value: lineId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "Quantity", value: quantity },
          { name: "DiscountAmount", value: amounts.discountAmount },
          { name: "TaxAmount", value: amounts.taxAmount },
          { name: "LineSubtotal", value: amounts.lineSubtotal },
          { name: "LineTotal", value: amounts.lineTotal },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.recalculateTotals(transaction, context, invoiceId);
    });
    return this.getInvoice(context, invoiceId);
  }

  async deleteLine(context: SalesInvoiceContextInput, invoiceId: string, lineId: string) {
    await this.executeInTransaction(async (transaction) => {
      const invoice = await this.lockInvoice(transaction, context, invoiceId);
      this.ensureDraft(invoice);
      await this.queryInTransaction(
        transaction,
        `
          DELETE FROM sales.SalesInvoiceLines
          WHERE SalesInvoiceLineId = @LineId
            AND SalesInvoiceId = @SalesInvoiceId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "LineId", value: lineId },
          { name: "SalesInvoiceId", value: invoiceId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      await this.recalculateTotals(transaction, context, invoiceId);
    });
    return this.getInvoice(context, invoiceId);
  }

  async postInvoice(context: SalesInvoiceContextInput, invoiceId: string, payload: SalesInvoicePostPayload) {
    const requestHash = this.hashPayload({ operationType: "POST", invoiceId, idempotencyKey: payload.idempotencyKey });
    const postResult = await this.executeInTransaction<{ invoiceId: string; replayed: boolean }>(async (transaction) => {
      const operation = await this.lockOperation(transaction, context, payload.idempotencyKey, requestHash);
      if (operation) {
        return { invoiceId: operation.SalesInvoiceId, replayed: true };
      }

      const invoice = await this.lockInvoice(transaction, context, invoiceId);
      if (invoice.Status === "POSTED") {
        throw this.conflict("SALES_INVOICE_ALREADY_POSTED", "La factura ya fue posteada.");
      }
      this.ensureDraft(invoice);

      const lines = await this.lockInvoiceLinesForPosting(transaction, context, invoiceId);
      if (!lines.length) {
        throw this.conflict("SALES_INVOICE_HAS_NO_LINES", "La factura debe tener lineas para postear.");
      }
      if (Number(invoice.TotalAmount) <= 0) {
        throw this.conflict("SALES_INVOICE_TOTAL_INVALID", "El total de la factura debe ser mayor que cero.");
      }

      await this.lockOrder(transaction, context, invoice.SalesOrderId);
      for (const line of lines) {
        const sourceLine = await this.lockShipmentCommercialLine(transaction, context, line.SalesShipmentLineId);
        await this.validateSourceLineForInvoice(transaction, context, invoice, sourceLine, Number(line.Quantity), line.SalesInvoiceLineId);
      }

      const arDocumentId = randomUUID();
      const arDocumentNumber = `CXC-${invoice.InvoiceNumber}`;
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ar.AccountsReceivableDocuments (
            AccountsReceivableDocumentId, TenantId, CompanyId, DocumentNumber,
            SourceType, SourceDocumentId, SourceDocumentNumber, CustomerId,
            DocumentDate, DueDate, CurrencyCode, ExchangeRate, Status,
            TotalAmount, PaidAmount, Reference, Notes, IsActive, CreatedBy
          )
          VALUES (
            @AccountsReceivableDocumentId, @TenantId, @CompanyId, @DocumentNumber,
            'SALES_INVOICE', @SourceDocumentId, @SourceDocumentNumber, @CustomerId,
            @DocumentDate, @DueDate, @CurrencyCode, @ExchangeRate, 'OPEN',
            @TotalAmount, 0, @Reference, @Notes, 1, @UserId
          );
        `,
        [
          { name: "AccountsReceivableDocumentId", value: arDocumentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "DocumentNumber", value: arDocumentNumber },
          { name: "SourceDocumentId", value: invoice.SalesInvoiceId },
          { name: "SourceDocumentNumber", value: invoice.InvoiceNumber },
          { name: "CustomerId", value: invoice.CustomerId },
          { name: "DocumentDate", value: invoice.InvoiceDate },
          { name: "DueDate", value: invoice.DueDate },
          { name: "CurrencyCode", value: invoice.CurrencyCode },
          { name: "ExchangeRate", value: invoice.ExchangeRate },
          { name: "TotalAmount", value: invoice.TotalAmount },
          { name: "Reference", value: invoice.Reference },
          { name: "Notes", value: invoice.Notes },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesInvoices
          SET Status = 'POSTED',
              AccountsReceivableDocumentId = @AccountsReceivableDocumentId,
              PostedAt = SYSUTCDATETIME(),
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesInvoiceId = @SalesInvoiceId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND Status = 'DRAFT';
        `,
        [
          { name: "SalesInvoiceId", value: invoiceId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "AccountsReceivableDocumentId", value: arDocumentId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      await this.insertOperation(transaction, context, invoiceId, payload.idempotencyKey, requestHash, arDocumentId);
      return { invoiceId, replayed: false };
    });

    const result = await this.getInvoice(context, postResult.invoiceId);
    return { ...result, idempotencyReplayed: postResult.replayed };
  }

  private async getPendingLines(
    context: SalesInvoiceContextInput,
    filters: { salesOrderId?: string; salesShipmentId?: string }
  ): Promise<SalesInvoicePendingLineResult[]> {
    const rows = await this.query<PendingLineRow>(
      `
        SELECT *
        FROM sales.V_SalesShipmentInvoiceSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@SalesOrderId IS NULL OR SalesOrderId = @SalesOrderId)
          AND (@SalesShipmentId IS NULL OR SalesShipmentId = @SalesShipmentId)
        ORDER BY ShipmentNumber ASC, LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: filters.salesOrderId ?? null },
        { name: "SalesShipmentId", value: filters.salesShipmentId ?? null }
      ]
    );
    return rows.map((row) => this.mapPendingLine(row));
  }

  private async lockOrder(transaction: sql.Transaction, context: SalesInvoiceContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<OrderRow>(
      transaction,
      `
        SELECT
          salesOrder.SalesOrderId,
          salesOrder.OrderNumber,
          salesOrder.CustomerId,
          customer.IsActive AS CustomerActive,
          salesOrder.CurrencyCode,
          salesOrder.ExchangeRate,
          salesOrder.Status
        FROM sales.SalesOrders salesOrder WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        INNER JOIN crm.Customers customer WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          ON customer.CustomerId = salesOrder.CustomerId
        WHERE salesOrder.TenantId = @TenantId
          AND salesOrder.CompanyId = @CompanyId
          AND salesOrder.SalesOrderId = @SalesOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Pedido no encontrado.", { salesOrderId }, "SALES_ORDER_NOT_FOUND");
    }
    return row;
  }

  private async lockInvoice(transaction: sql.Transaction, context: SalesInvoiceContextInput, invoiceId: string) {
    const rows = await this.queryInTransaction<InvoiceLockRow>(
      transaction,
      `
        SELECT SalesInvoiceId, InvoiceNumber, SalesOrderId, CustomerId, InvoiceDate, DueDate,
               CurrencyCode, ExchangeRate, Status, TotalAmount, AccountsReceivableDocumentId,
               Notes, Reference
        FROM sales.SalesInvoices WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesInvoiceId = @SalesInvoiceId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Factura de venta no encontrada.", { invoiceId }, "SALES_INVOICE_NOT_FOUND");
    }
    return row;
  }

  private async lockInvoiceLine(transaction: sql.Transaction, context: SalesInvoiceContextInput, invoiceId: string, lineId: string) {
    const rows = await this.queryInTransaction<InvoiceLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesInvoiceLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesInvoiceId = @SalesInvoiceId
          AND SalesInvoiceLineId = @LineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId },
        { name: "LineId", value: lineId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Linea de factura no encontrada.", { lineId }, "SALES_INVOICE_LINE_NOT_FOUND");
    }
    return row;
  }

  private lockInvoiceLinesForPosting(transaction: sql.Transaction, context: SalesInvoiceContextInput, invoiceId: string) {
    return this.queryInTransaction<InvoiceLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesInvoiceLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesInvoiceId = @SalesInvoiceId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId }
      ]
    );
  }

  private async lockShipmentCommercialLine(transaction: sql.Transaction, context: SalesInvoiceContextInput, salesShipmentLineId: string) {
    const rows = await this.queryInTransaction<ShipmentLineCommercialRow>(
      transaction,
      `
        SELECT
          shipment.SalesShipmentId,
          shipmentLine.SalesShipmentLineId,
          shipment.SalesOrderId,
          salesOrder.CustomerId,
          salesOrder.CurrencyCode,
          salesOrder.ExchangeRate,
          shipment.Status AS ShipmentStatus,
          shipmentLine.SalesOrderLineId,
          shipmentLine.ItemId,
          shipmentLine.UnitOfMeasureId,
          shipmentLine.Quantity,
          orderLine.UnitPrice,
          orderLine.DiscountPercent,
          orderLine.TaxPercent,
          orderLine.Description
        FROM sales.SalesShipmentLines shipmentLine WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        INNER JOIN sales.SalesShipments shipment WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          ON shipment.SalesShipmentId = shipmentLine.SalesShipmentId
        INNER JOIN sales.SalesOrders salesOrder WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          ON salesOrder.SalesOrderId = shipment.SalesOrderId
        INNER JOIN sales.SalesOrderLines orderLine WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          ON orderLine.SalesOrderLineId = shipmentLine.SalesOrderLineId
        WHERE shipmentLine.TenantId = @TenantId
          AND shipmentLine.CompanyId = @CompanyId
          AND shipmentLine.SalesShipmentLineId = @SalesShipmentLineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentLineId", value: salesShipmentLineId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Linea de despacho no encontrada.", { salesShipmentLineId }, "SALES_SHIPMENT_LINE_NOT_FOUND");
    }
    return row;
  }

  private async validateSourceLineForInvoice(
    transaction: sql.Transaction,
    context: SalesInvoiceContextInput,
    invoice: InvoiceLockRow,
    sourceLine: ShipmentLineCommercialRow,
    quantity: number,
    excludingInvoiceLineId: string | null
  ) {
    if (sourceLine.ShipmentStatus !== "POSTED") {
      throw this.conflict("SALES_INVOICE_SHIPMENT_NOT_POSTED", "Solo se pueden facturar despachos posteados.");
    }
    if (
      sourceLine.SalesOrderId !== invoice.SalesOrderId ||
      sourceLine.CustomerId !== invoice.CustomerId ||
      sourceLine.CurrencyCode !== invoice.CurrencyCode ||
      Number(sourceLine.ExchangeRate) !== Number(invoice.ExchangeRate)
    ) {
      throw this.conflict("SALES_INVOICE_SOURCE_MISMATCH", "El despacho no coincide con pedido, cliente, moneda o tasa de la factura.");
    }
    const posted = await this.getPostedInvoicedQuantity(transaction, context, sourceLine.SalesShipmentLineId, excludingInvoiceLineId);
    if (posted + quantity > Number(sourceLine.Quantity) + 0.0001) {
      throw this.conflict("SALES_INVOICE_EXCEEDS_SHIPPED_PENDING", "La cantidad excede lo despachado pendiente de facturar.");
    }
  }

  private async getPostedInvoicedQuantity(
    transaction: sql.Transaction,
    context: SalesInvoiceContextInput,
    salesShipmentLineId: string,
    excludingInvoiceLineId: string | null
  ) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(invoiceLine.Quantity), 0) AS Total
        FROM sales.SalesInvoiceLines invoiceLine WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesInvoices invoice WITH (UPDLOCK, HOLDLOCK)
          ON invoice.SalesInvoiceId = invoiceLine.SalesInvoiceId
        WHERE invoiceLine.TenantId = @TenantId
          AND invoiceLine.CompanyId = @CompanyId
          AND invoiceLine.SalesShipmentLineId = @SalesShipmentLineId
          AND invoice.Status = 'POSTED'
          AND (@ExcludingInvoiceLineId IS NULL OR invoiceLine.SalesInvoiceLineId <> @ExcludingInvoiceLineId);
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentLineId", value: salesShipmentLineId },
        { name: "ExcludingInvoiceLineId", value: excludingInvoiceLineId }
      ]
    );
    return Number(rows[0]?.Total ?? 0);
  }

  private async getOrderPendingInvoiceTotal(transaction: sql.Transaction, context: SalesInvoiceContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(PendingInvoiceQuantity), 0) AS Total
        FROM sales.V_SalesShipmentInvoiceSummary
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
    return Number(rows[0]?.Total ?? 0);
  }

  private async nextLineNumber(transaction: sql.Transaction, invoiceId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS Total
        FROM sales.SalesInvoiceLines WITH (UPDLOCK, HOLDLOCK)
        WHERE SalesInvoiceId = @SalesInvoiceId;
      `,
      [{ name: "SalesInvoiceId", value: invoiceId }]
    );
    return Number(rows[0]?.Total ?? 1);
  }

  private async insertLine(
    transaction: sql.Transaction,
    context: SalesInvoiceContextInput,
    invoiceId: string,
    sourceLine: ShipmentLineCommercialRow,
    lineNumber: number,
    quantity: number,
    notes: string | null
  ) {
    const amounts = this.calculateLineAmounts(sourceLine, quantity);
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO sales.SalesInvoiceLines (
          SalesInvoiceLineId, SalesInvoiceId, TenantId, CompanyId,
          SalesOrderLineId, SalesShipmentId, SalesShipmentLineId, LineNumber,
          ItemId, UnitOfMeasureId, Quantity, UnitPrice, DiscountPercent,
          DiscountAmount, TaxPercent, TaxAmount, LineSubtotal, LineTotal,
          Description, Notes, CreatedBy
        )
        VALUES (
          @SalesInvoiceLineId, @SalesInvoiceId, @TenantId, @CompanyId,
          @SalesOrderLineId, @SalesShipmentId, @SalesShipmentLineId, @LineNumber,
          @ItemId, @UnitOfMeasureId, @Quantity, @UnitPrice, @DiscountPercent,
          @DiscountAmount, @TaxPercent, @TaxAmount, @LineSubtotal, @LineTotal,
          @Description, @Notes, @UserId
        );
      `,
      [
        { name: "SalesInvoiceLineId", value: randomUUID() },
        { name: "SalesInvoiceId", value: invoiceId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderLineId", value: sourceLine.SalesOrderLineId },
        { name: "SalesShipmentId", value: sourceLine.SalesShipmentId },
        { name: "SalesShipmentLineId", value: sourceLine.SalesShipmentLineId },
        { name: "LineNumber", value: lineNumber },
        { name: "ItemId", value: sourceLine.ItemId },
        { name: "UnitOfMeasureId", value: sourceLine.UnitOfMeasureId },
        { name: "Quantity", value: quantity },
        { name: "UnitPrice", value: sourceLine.UnitPrice },
        { name: "DiscountPercent", value: sourceLine.DiscountPercent },
        { name: "DiscountAmount", value: amounts.discountAmount },
        { name: "TaxPercent", value: sourceLine.TaxPercent },
        { name: "TaxAmount", value: amounts.taxAmount },
        { name: "LineSubtotal", value: amounts.lineSubtotal },
        { name: "LineTotal", value: amounts.lineTotal },
        { name: "Description", value: sourceLine.Description },
        { name: "Notes", value: notes },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private calculateLineAmounts(sourceLine: ShipmentLineCommercialRow, quantity: number) {
    const lineSubtotal = this.round(quantity * Number(sourceLine.UnitPrice));
    const discountAmount = this.round((lineSubtotal * Number(sourceLine.DiscountPercent)) / 100);
    const baseAfterDiscount = this.round(lineSubtotal - discountAmount);
    const taxAmount = this.round((baseAfterDiscount * Number(sourceLine.TaxPercent)) / 100);
    const lineTotal = this.round(baseAfterDiscount + taxAmount);
    return { lineSubtotal, discountAmount, taxAmount, lineTotal };
  }

  private async recalculateTotals(transaction: sql.Transaction, context: SalesInvoiceContextInput, invoiceId: string) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE sales.SalesInvoices
        SET SubtotalAmount = COALESCE((SELECT SUM(LineSubtotal) FROM sales.SalesInvoiceLines WHERE SalesInvoiceId = @SalesInvoiceId), 0),
            DiscountAmount = COALESCE((SELECT SUM(DiscountAmount) FROM sales.SalesInvoiceLines WHERE SalesInvoiceId = @SalesInvoiceId), 0),
            TaxAmount = COALESCE((SELECT SUM(TaxAmount) FROM sales.SalesInvoiceLines WHERE SalesInvoiceId = @SalesInvoiceId), 0),
            TotalAmount = COALESCE((SELECT SUM(LineTotal) FROM sales.SalesInvoiceLines WHERE SalesInvoiceId = @SalesInvoiceId), 0),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesInvoiceId = @SalesInvoiceId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async lockOperation(transaction: sql.Transaction, context: SalesInvoiceContextInput, idempotencyKey: string, requestHash: string) {
    const rows = await this.queryInTransaction<OperationRow>(
      transaction,
      `
        SELECT SalesInvoiceId, RequestHash, ResultStatus, AccountsReceivableDocumentId
        FROM sales.SalesInvoiceOperations WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND OperationType = 'POST'
          AND IdempotencyKey = @IdempotencyKey;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "IdempotencyKey", value: idempotencyKey }
      ]
    );
    const row = rows[0];
    if (row && row.RequestHash !== requestHash) {
      throw this.conflict("SALES_INVOICE_IDEMPOTENCY_CONFLICT", "La clave idempotente ya fue usada con un payload diferente.");
    }
    return row;
  }

  private async insertOperation(
    transaction: sql.Transaction,
    context: SalesInvoiceContextInput,
    invoiceId: string,
    idempotencyKey: string,
    requestHash: string,
    arDocumentId: string
  ) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO sales.SalesInvoiceOperations (
          SalesInvoiceOperationId, TenantId, CompanyId, SalesInvoiceId, OperationType,
          IdempotencyKey, RequestHash, ResultStatus, AccountsReceivableDocumentId, CreatedBy
        )
        VALUES (
          @OperationId, @TenantId, @CompanyId, @SalesInvoiceId, 'POST',
          @IdempotencyKey, @RequestHash, 'POSTED', @AccountsReceivableDocumentId, @UserId
        );
      `,
      [
        { name: "OperationId", value: randomUUID() },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId },
        { name: "IdempotencyKey", value: idempotencyKey },
        { name: "RequestHash", value: requestHash },
        { name: "AccountsReceivableDocumentId", value: arDocumentId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async generateInvoiceNumber(transaction: sql.Transaction, context: SalesInvoiceContextInput) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS Total
        FROM sales.SalesInvoices WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    return `FAC-${String(Number(rows[0]?.Total ?? 1)).padStart(6, "0")}`;
  }

  private invoiceWhere(alias: string) {
    return `
      ${alias}.TenantId = @TenantId
      AND ${alias}.CompanyId = @CompanyId
      AND (@CustomerId IS NULL OR ${alias}.CustomerId = @CustomerId)
      AND (@SalesOrderId IS NULL OR ${alias}.SalesOrderId = @SalesOrderId)
      AND (@Status IS NULL OR ${alias}.Status = @Status)
      AND (@DateFrom IS NULL OR ${alias}.InvoiceDate >= @DateFrom)
      AND (@DateTo IS NULL OR ${alias}.InvoiceDate <= @DateTo)
      AND (@DueDateFrom IS NULL OR ${alias}.DueDate >= @DueDateFrom)
      AND (@DueDateTo IS NULL OR ${alias}.DueDate <= @DueDateTo)
      AND (
        @Search IS NULL
        OR ${alias}.InvoiceNumber LIKE @Search
        OR ${alias}.OrderNumber LIKE @Search
        OR ${alias}.CustomerCode LIKE @Search
        OR ${alias}.CustomerName LIKE @Search
        OR ${alias}.AccountsReceivableDocumentNumber LIKE @Search
        OR ${alias}.Reference LIKE @Search
      )
    `;
  }

  private ensureDraft(invoice: InvoiceLockRow) {
    if (invoice.Status !== "DRAFT") {
      throw this.conflict("SALES_INVOICE_NOT_DRAFT", "Solo se pueden modificar facturas en borrador.");
    }
  }

  private round(value: number) {
    return Math.round((value + Number.EPSILON) * 10000) / 10000;
  }

  private hashPayload(payload: Record<string, unknown>) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private conflict(code: string, message: string) {
    return new AppError({ statusCode: 409, code, message, isOperational: true });
  }

  private async mapInvoiceWithLines(context: SalesInvoiceContextInput, row: InvoiceRow) {
    const lines = await this.getInvoiceLines(context, row.SalesInvoiceId);
    return this.mapInvoice(row, lines);
  }

  private async getInvoiceLines(context: SalesInvoiceContextInput, invoiceId: string) {
    const rows = await this.query<InvoiceLineRow>(
      `
        SELECT *
        FROM sales.V_SalesInvoiceLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesInvoiceId = @SalesInvoiceId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesInvoiceId", value: invoiceId }
      ]
    );
    return rows.map((row) => this.mapLine(row));
  }

  private mapInvoice(row: InvoiceRow, lines: SalesInvoiceLineResult[]): SalesInvoiceResult {
    return {
      id: row.SalesInvoiceId,
      invoiceNumber: row.InvoiceNumber,
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      invoiceDate: row.InvoiceDate,
      dueDate: row.DueDate,
      currencyCode: row.CurrencyCode,
      exchangeRate: Number(row.ExchangeRate),
      status: row.Status,
      subtotalAmount: Number(row.SubtotalAmount),
      discountAmount: Number(row.DiscountAmount),
      taxAmount: Number(row.TaxAmount),
      totalAmount: Number(row.TotalAmount),
      accountsReceivableDocumentId: row.AccountsReceivableDocumentId ?? undefined,
      accountsReceivableDocumentNumber: row.AccountsReceivableDocumentNumber ?? undefined,
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      postedAt: row.PostedAt ?? undefined,
      lineCount: Number(row.LineCount),
      totalQuantity: Number(row.TotalQuantity),
      lines
    };
  }

  private mapLine(row: InvoiceLineRow): SalesInvoiceLineResult {
    return {
      id: row.SalesInvoiceLineId,
      salesInvoiceId: row.SalesInvoiceId,
      salesOrderLineId: row.SalesOrderLineId,
      salesShipmentId: row.SalesShipmentId,
      shipmentNumber: row.ShipmentNumber,
      salesShipmentLineId: row.SalesShipmentLineId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      unitOfMeasureId: row.UnitOfMeasureId,
      unitOfMeasureCode: row.UnitOfMeasureCode,
      quantity: Number(row.Quantity),
      unitPrice: Number(row.UnitPrice),
      discountPercent: Number(row.DiscountPercent),
      discountAmount: Number(row.DiscountAmount),
      taxPercent: Number(row.TaxPercent),
      taxAmount: Number(row.TaxAmount),
      lineSubtotal: Number(row.LineSubtotal),
      lineTotal: Number(row.LineTotal),
      description: row.Description,
      notes: row.Notes ?? undefined
    };
  }

  private mapPendingLine(row: PendingLineRow): SalesInvoicePendingLineResult {
    return {
      salesShipmentInvoiceId: row.SalesShipmentInvoiceId,
      salesShipmentId: row.SalesShipmentId,
      shipmentNumber: row.ShipmentNumber,
      shipmentStatus: row.ShipmentStatus,
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      currencyCode: row.CurrencyCode,
      exchangeRate: Number(row.ExchangeRate),
      salesOrderLineId: row.SalesOrderLineId,
      salesShipmentLineId: row.SalesShipmentLineId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      unitOfMeasureId: row.UnitOfMeasureId,
      unitOfMeasureCode: row.UnitOfMeasureCode,
      shippedQuantity: Number(row.ShippedQuantity),
      previouslyInvoicedQuantity: Number(row.PreviouslyInvoicedQuantity),
      pendingInvoiceQuantity: Number(row.PendingInvoiceQuantity)
    };
  }

  private async queryInTransaction<TRecord>(transaction: sql.Transaction, sqlText: string, parameters: readonly SqlParameter[] = []) {
    const request = new sql.Request(transaction);
    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }
    const result = await request.query<TRecord>(sqlText);
    return result.recordset;
  }
}

export const salesInvoiceRepository = new SalesInvoiceRepository();
