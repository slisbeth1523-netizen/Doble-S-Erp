import { createHash, randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import { inventoryPostingRepository } from "../../inventory/infrastructure/InventoryPostingRepository.js";
import type {
  SalesReturnCreatePayload,
  SalesReturnLineCreatePayload,
  SalesReturnLineUpdatePayload,
  SalesReturnListQuery,
  SalesReturnPostPayload
} from "../validators/sales-return.validators.js";

export type SalesReturnContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SalesReturnContext = SalesReturnContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type SalesReturnStatus = "DRAFT" | "POSTED" | "CANCELLED";

type CountRow = { TotalItems: number };
type TotalRow = { Total: number };

type ReturnRow = {
  SalesReturnId: string;
  ReturnNumber: string;
  SalesOrderId: string;
  OrderNumber: string;
  SalesShipmentId: string;
  ShipmentNumber: string;
  SalesInvoiceId: string | null;
  InvoiceNumber: string | null;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  ReturnDate: Date;
  Status: SalesReturnStatus;
  WarehouseId: string | null;
  WarehouseCode: string | null;
  WarehouseName: string | null;
  Reason: string | null;
  Reference: string | null;
  Notes: string | null;
  InventoryMovementId: string | null;
  MovementNumber: string | null;
  PostedAt: Date | null;
  LineCount: number;
  TotalQuantity: number;
};

type ReturnLineRow = {
  SalesReturnLineId: string;
  SalesReturnId: string;
  SalesOrderLineId: string;
  SalesShipmentLineId: string;
  SalesInvoiceLineId: string | null;
  SalesInvoiceId: string | null;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  UnitOfMeasureId: string;
  UnitOfMeasureCode: string;
  Quantity: number;
  Reason: string | null;
  Notes: string | null;
};

type ShipmentLockRow = {
  SalesShipmentId: string;
  ShipmentNumber: string;
  SalesOrderId: string;
  CustomerId: string;
  Status: string;
  WarehouseId: string | null;
};

type InvoiceLockRow = {
  SalesInvoiceId: string;
  SalesOrderId: string;
  CustomerId: string;
  Status: string;
};

type ReturnableLineRow = {
  SalesShipmentLineId: string;
  SalesShipmentId: string;
  ShipmentNumber: string;
  ShipmentStatus: string;
  SalesOrderId: string;
  OrderNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  SalesInvoiceId: string | null;
  InvoiceNumber: string | null;
  SalesOrderLineId: string;
  SalesInvoiceLineId: string | null;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  UnitOfMeasureId: string;
  UnitOfMeasureCode: string;
  ShippedQuantity: number;
  PreviouslyReturnedQuantity: number;
  ReturnableQuantity: number;
};

type OperationRow = {
  SalesReturnId: string;
  RequestHash: string;
  InventoryMovementId: string | null;
  ResultStatus: SalesReturnStatus;
};

export class SalesReturnRepository extends BaseSqlRepository {
  async listReturns(context: SalesReturnContextInput, query: SalesReturnListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "SalesOrderId", value: query.salesOrderId ?? null },
      { name: "SalesShipmentId", value: query.salesShipmentId ?? null },
      { name: "SalesInvoiceId", value: query.salesInvoiceId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "WarehouseId", value: query.warehouseId ?? null },
      { name: "DateFrom", value: query.dateFrom ?? null },
      { name: "DateTo", value: query.dateTo ?? null },
      { name: "Search", value: search }
    ];
    const where = this.returnWhereClause();
    const [records, counts] = await Promise.all([
      this.query<ReturnRow>(
        `
          SELECT *
          FROM sales.V_SalesReturnSummary
          WHERE ${where}
          ORDER BY ReturnDate DESC, ReturnNumber DESC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        [...parameters, { name: "Offset", value: offset }, { name: "PageSize", value: pageSize }]
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM sales.V_SalesReturnSummary
          WHERE ${where};
        `,
        parameters
      )
    ]);

    const returns = await Promise.all(records.map((row) => this.mapReturnWithLines(context, row)));
    return { records: returns, pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) } };
  }

  async getReturn(context: SalesReturnContextInput, returnId: string) {
    const rows = await this.query<ReturnRow>(
      `
        SELECT *
        FROM sales.V_SalesReturnSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesReturnId = @SalesReturnId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: returnId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales return not found.", { returnId }, "SALES_RETURN_NOT_FOUND");
    }
    return this.mapReturnWithLines(context, row);
  }

  async listShipmentReturnableLines(context: SalesReturnContextInput, shipmentId: string) {
    const rows = await this.query<ReturnableLineRow>(
      `
        SELECT *
        FROM sales.V_SalesShipmentReturnSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesShipmentId = @SalesShipmentId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentId", value: shipmentId }
      ]
    );
    return rows.map((row) => this.mapReturnableLine(row));
  }

  async listInvoiceReturnableLines(context: SalesReturnContextInput, invoiceId: string) {
    const rows = await this.query<ReturnableLineRow>(
      `
        SELECT *
        FROM sales.V_SalesInvoiceReturnSummary
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
    return rows.map((row) => this.mapReturnableLine(row));
  }

  async createReturn(context: SalesReturnContextInput, payload: SalesReturnCreatePayload) {
    const returnId = await this.executeInTransaction(async (transaction) => {
      const shipment = await this.lockShipment(transaction, context, payload.salesShipmentId);
      if (shipment.Status !== "POSTED") {
        throw this.conflict("SALES_RETURN_SHIPMENT_NOT_POSTED", "Solo se puede devolver mercancia de despachos posteados.");
      }

      await this.ensureCustomerActive(transaction, context, shipment.CustomerId);
      const pending = await this.getShipmentReturnableTotal(transaction, context, payload.salesShipmentId);
      if (pending <= 0) {
        throw this.conflict("SALES_RETURN_NOTHING_RETURNABLE", "El despacho no tiene cantidad pendiente de devolver.");
      }

      if (payload.salesInvoiceId) {
        const invoice = await this.lockInvoice(transaction, context, payload.salesInvoiceId);
        if (invoice.Status !== "POSTED" || invoice.SalesOrderId !== shipment.SalesOrderId || invoice.CustomerId !== shipment.CustomerId) {
          throw this.conflict("SALES_RETURN_INVOICE_MISMATCH", "La factura indicada no corresponde al despacho y pedido.");
        }
      }

      const id = randomUUID();
      const returnNumber = await this.generateReturnNumber(transaction, context);
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesReturns (
            SalesReturnId, TenantId, CompanyId, ReturnNumber, SalesOrderId, SalesShipmentId,
            SalesInvoiceId, CustomerId, ReturnDate, Status, WarehouseId, Reason, Reference,
            Notes, IsActive, CreatedBy
          )
          VALUES (
            @SalesReturnId, @TenantId, @CompanyId, @ReturnNumber, @SalesOrderId, @SalesShipmentId,
            @SalesInvoiceId, @CustomerId, @ReturnDate, 'DRAFT', @WarehouseId, @Reason, @Reference,
            @Notes, 1, @UserId
          );
        `,
        [
          { name: "SalesReturnId", value: id },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "ReturnNumber", value: returnNumber },
          { name: "SalesOrderId", value: shipment.SalesOrderId },
          { name: "SalesShipmentId", value: shipment.SalesShipmentId },
          { name: "SalesInvoiceId", value: payload.salesInvoiceId ?? null },
          { name: "CustomerId", value: shipment.CustomerId },
          { name: "ReturnDate", value: payload.returnDate ?? new Date() },
          { name: "WarehouseId", value: shipment.WarehouseId },
          { name: "Reason", value: payload.reason ?? null },
          { name: "Reference", value: payload.reference ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      return id;
    });
    return this.getReturn(context, returnId);
  }

  async addLine(context: SalesReturnContextInput, returnId: string, payload: SalesReturnLineCreatePayload) {
    await this.executeInTransaction(async (transaction) => {
      const salesReturn = await this.lockReturn(transaction, context, returnId);
      this.ensureReturnDraft(salesReturn);
      const line = await this.lockReturnableLine(transaction, context, salesReturn.SalesShipmentId, payload.salesShipmentLineId);
      this.validateLineAgainstReturn(salesReturn, line, payload.salesInvoiceLineId ?? null);
      await this.validateQuantity(transaction, context, payload.salesShipmentLineId, payload.quantity, null);
      const lineNumber = await this.nextLineNumber(transaction, returnId);
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesReturnLines (
            SalesReturnLineId, SalesReturnId, TenantId, CompanyId, SalesOrderLineId,
            SalesShipmentLineId, SalesInvoiceLineId, LineNumber, ItemId, WarehouseId,
            UnitOfMeasureId, Quantity, Reason, Notes, CreatedBy
          )
          VALUES (
            @LineId, @SalesReturnId, @TenantId, @CompanyId, @SalesOrderLineId,
            @SalesShipmentLineId, @SalesInvoiceLineId, @LineNumber, @ItemId, @WarehouseId,
            @UnitOfMeasureId, @Quantity, @Reason, @Notes, @UserId
          );
        `,
        [
          { name: "LineId", value: randomUUID() },
          { name: "SalesReturnId", value: returnId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "SalesOrderLineId", value: line.SalesOrderLineId },
          { name: "SalesShipmentLineId", value: line.SalesShipmentLineId },
          { name: "SalesInvoiceLineId", value: payload.salesInvoiceLineId ?? line.SalesInvoiceLineId },
          { name: "LineNumber", value: lineNumber },
          { name: "ItemId", value: line.ItemId },
          { name: "WarehouseId", value: line.WarehouseId },
          { name: "UnitOfMeasureId", value: line.UnitOfMeasureId },
          { name: "Quantity", value: payload.quantity },
          { name: "Reason", value: payload.reason ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.updateReturnWarehouse(transaction, context, returnId);
    });
    return this.getReturn(context, returnId);
  }

  async updateLine(context: SalesReturnContextInput, returnId: string, lineId: string, payload: SalesReturnLineUpdatePayload) {
    await this.executeInTransaction(async (transaction) => {
      const salesReturn = await this.lockReturn(transaction, context, returnId);
      this.ensureReturnDraft(salesReturn);
      const current = await this.lockReturnLine(transaction, context, returnId, lineId);
      const nextQuantity = payload.quantity ?? Number(current.Quantity);
      await this.validateQuantity(transaction, context, current.SalesShipmentLineId, nextQuantity, lineId);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesReturnLines
          SET Quantity = @Quantity,
              Reason = COALESCE(@Reason, Reason),
              Notes = COALESCE(@Notes, Notes),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesReturnLineId = @LineId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "LineId", value: lineId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "Quantity", value: nextQuantity },
          { name: "Reason", value: payload.reason ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.updateReturnWarehouse(transaction, context, returnId);
    });
    return this.getReturn(context, returnId);
  }

  async deleteLine(context: SalesReturnContextInput, returnId: string, lineId: string) {
    await this.executeInTransaction(async (transaction) => {
      const salesReturn = await this.lockReturn(transaction, context, returnId);
      this.ensureReturnDraft(salesReturn);
      await this.queryInTransaction(
        transaction,
        `
          DELETE FROM sales.SalesReturnLines
          WHERE SalesReturnLineId = @LineId
            AND SalesReturnId = @SalesReturnId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "LineId", value: lineId },
          { name: "SalesReturnId", value: returnId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      await this.updateReturnWarehouse(transaction, context, returnId);
    });
    return this.getReturn(context, returnId);
  }

  async postReturn(context: SalesReturnContextInput, returnId: string, payload: SalesReturnPostPayload) {
    const requestHash = this.hashPayload({ operationType: "POST", returnId, idempotencyKey: payload.idempotencyKey });
    const result = await this.executeInTransaction<{ returnId: string; replayed: boolean }>(async (transaction) => {
      const operation = await this.lockOperation(transaction, context, payload.idempotencyKey, requestHash);
      if (operation) {
        return { returnId: operation.SalesReturnId, replayed: true };
      }

      const salesReturn = await this.lockReturn(transaction, context, returnId);
      if (salesReturn.Status === "POSTED") {
        throw this.conflict("SALES_RETURN_ALREADY_POSTED", "La devolucion ya fue posteada.");
      }
      this.ensureReturnDraft(salesReturn);
      await this.lockShipment(transaction, context, salesReturn.SalesShipmentId);

      const lines = await this.lockReturnLines(transaction, context, returnId);
      if (!lines.length) {
        throw new AppError({ statusCode: 400, code: "SALES_RETURN_HAS_NO_LINES", message: "La devolucion debe tener lineas.", isOperational: true });
      }
      for (const line of lines) {
        await this.validateQuantity(transaction, context, line.SalesShipmentLineId, Number(line.Quantity), line.SalesReturnLineId);
      }

      const movementId = randomUUID();
      const movementNumber = await this.generateMovementNumber(transaction, context);
      await this.insertInventoryMovement(transaction, context, salesReturn, movementId, movementNumber);
      for (const line of lines) {
        await this.insertInventoryMovementLine(transaction, context, movementId, line);
      }
      const posted = await inventoryPostingRepository.postMovementInTransaction(transaction, {
        tenantId: context.tenantId,
        companyId: context.companyId,
        movementId,
        postedBy: context.userId
      });

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesReturns
          SET Status = 'POSTED',
              InventoryMovementId = @InventoryMovementId,
              PostedAt = @PostedAt,
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesReturnId = @SalesReturnId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SalesReturnId", value: returnId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "InventoryMovementId", value: movementId },
          { name: "PostedAt", value: posted.postedAt },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.insertOperation(transaction, context, returnId, payload.idempotencyKey, requestHash, movementId);
      return { returnId, replayed: false };
    });

    const postedReturn = await this.getReturn(context, result.returnId);
    return { ...postedReturn, idempotencyReplayed: result.replayed };
  }

  private returnWhereClause() {
    return `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@SalesOrderId IS NULL OR SalesOrderId = @SalesOrderId)
      AND (@SalesShipmentId IS NULL OR SalesShipmentId = @SalesShipmentId)
      AND (@SalesInvoiceId IS NULL OR SalesInvoiceId = @SalesInvoiceId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@WarehouseId IS NULL OR WarehouseId = @WarehouseId)
      AND (@DateFrom IS NULL OR ReturnDate >= @DateFrom)
      AND (@DateTo IS NULL OR ReturnDate < DATEADD(day, 1, @DateTo))
      AND (
        @Search IS NULL
        OR ReturnNumber LIKE @Search
        OR OrderNumber LIKE @Search
        OR ShipmentNumber LIKE @Search
        OR InvoiceNumber LIKE @Search
        OR CustomerName LIKE @Search
      )
    `;
  }

  private async mapReturnWithLines(context: SalesReturnContextInput, row: ReturnRow) {
    const lines = await this.query<ReturnLineRow>(
      `
        SELECT *
        FROM sales.V_SalesReturnLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesReturnId = @SalesReturnId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: row.SalesReturnId }
      ]
    );
    return {
      id: row.SalesReturnId,
      returnNumber: row.ReturnNumber,
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      salesShipmentId: row.SalesShipmentId,
      shipmentNumber: row.ShipmentNumber,
      salesInvoiceId: row.SalesInvoiceId ?? undefined,
      invoiceNumber: row.InvoiceNumber ?? undefined,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      returnDate: row.ReturnDate,
      status: row.Status,
      warehouseId: row.WarehouseId ?? undefined,
      warehouseCode: row.WarehouseCode ?? undefined,
      warehouseName: row.WarehouseName ?? undefined,
      reason: row.Reason ?? undefined,
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      inventoryMovementId: row.InventoryMovementId ?? undefined,
      movementNumber: row.MovementNumber ?? undefined,
      postedAt: row.PostedAt ?? undefined,
      lineCount: Number(row.LineCount),
      totalQuantity: Number(row.TotalQuantity),
      lines: lines.map((line) => ({
        id: line.SalesReturnLineId,
        salesReturnId: line.SalesReturnId,
        salesOrderLineId: line.SalesOrderLineId,
        salesShipmentLineId: line.SalesShipmentLineId,
        salesInvoiceLineId: line.SalesInvoiceLineId ?? undefined,
        salesInvoiceId: line.SalesInvoiceId ?? undefined,
        lineNumber: Number(line.LineNumber),
        itemId: line.ItemId,
        itemCode: line.ItemCode,
        itemDescription: line.ItemDescription,
        warehouseId: line.WarehouseId,
        warehouseCode: line.WarehouseCode,
        warehouseName: line.WarehouseName,
        unitOfMeasureId: line.UnitOfMeasureId,
        unitOfMeasureCode: line.UnitOfMeasureCode,
        quantity: Number(line.Quantity),
        reason: line.Reason ?? undefined,
        notes: line.Notes ?? undefined
      }))
    };
  }

  private mapReturnableLine(row: ReturnableLineRow) {
    return {
      salesShipmentLineId: row.SalesShipmentLineId,
      salesShipmentId: row.SalesShipmentId,
      shipmentNumber: row.ShipmentNumber,
      shipmentStatus: row.ShipmentStatus,
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      salesInvoiceId: row.SalesInvoiceId ?? undefined,
      invoiceNumber: row.InvoiceNumber ?? undefined,
      salesInvoiceLineId: row.SalesInvoiceLineId ?? undefined,
      salesOrderLineId: row.SalesOrderLineId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId,
      warehouseCode: row.WarehouseCode,
      warehouseName: row.WarehouseName,
      unitOfMeasureId: row.UnitOfMeasureId,
      unitOfMeasureCode: row.UnitOfMeasureCode,
      shippedQuantity: Number(row.ShippedQuantity),
      previouslyReturnedQuantity: Number(row.PreviouslyReturnedQuantity),
      returnableQuantity: Number(row.ReturnableQuantity)
    };
  }

  private async lockReturn(transaction: sql.Transaction, context: SalesReturnContextInput, returnId: string) {
    const rows = await this.queryInTransaction<ReturnRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesReturnSummary WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesReturnId = @SalesReturnId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: returnId }
      ]
    );
    const row = rows[0];
    if (!row) throw new NotFoundError("Sales return not found.", { returnId }, "SALES_RETURN_NOT_FOUND");
    return row;
  }

  private async lockShipment(transaction: sql.Transaction, context: SalesReturnContextInput, shipmentId: string) {
    const rows = await this.queryInTransaction<ShipmentLockRow>(
      transaction,
      `
        SELECT
          shipment.SalesShipmentId,
          shipment.ShipmentNumber,
          shipment.SalesOrderId,
          salesOrder.CustomerId,
          shipment.Status,
          shipment.WarehouseId
        FROM sales.SalesShipments shipment WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesOrders salesOrder WITH (UPDLOCK, HOLDLOCK)
          ON salesOrder.SalesOrderId = shipment.SalesOrderId
        WHERE shipment.TenantId = @TenantId
          AND shipment.CompanyId = @CompanyId
          AND shipment.SalesShipmentId = @SalesShipmentId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentId", value: shipmentId }
      ]
    );
    const row = rows[0];
    if (!row) throw new NotFoundError("Sales shipment not found.", { shipmentId }, "SALES_SHIPMENT_NOT_FOUND");
    return row;
  }

  private async lockInvoice(transaction: sql.Transaction, context: SalesReturnContextInput, invoiceId: string) {
    const rows = await this.queryInTransaction<InvoiceLockRow>(
      transaction,
      `
        SELECT SalesInvoiceId, SalesOrderId, CustomerId, Status
        FROM sales.SalesInvoices WITH (UPDLOCK, HOLDLOCK)
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
    if (!row) throw new NotFoundError("Sales invoice not found.", { invoiceId }, "SALES_INVOICE_NOT_FOUND");
    return row;
  }

  private async ensureCustomerActive(transaction: sql.Transaction, context: SalesReturnContextInput, customerId: string) {
    const rows = await this.queryInTransaction<{ IsActive: boolean }>(
      transaction,
      `
        SELECT IsActive
        FROM crm.Customers WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerId = @CustomerId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerId", value: customerId }
      ]
    );
    if (!rows[0] || !rows[0].IsActive) {
      throw this.conflict("SALES_RETURN_CUSTOMER_INACTIVE", "El cliente debe estar activo.");
    }
  }

  private async lockReturnableLine(transaction: sql.Transaction, context: SalesReturnContextInput, shipmentId: string, shipmentLineId: string) {
    const rows = await this.queryInTransaction<ReturnableLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesShipmentReturnSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesShipmentId = @SalesShipmentId
          AND SalesShipmentLineId = @SalesShipmentLineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentId", value: shipmentId },
        { name: "SalesShipmentLineId", value: shipmentLineId }
      ]
    );
    const row = rows[0];
    if (!row) throw new NotFoundError("Returnable shipment line not found.", { shipmentLineId }, "SALES_RETURNABLE_LINE_NOT_FOUND");
    return row;
  }

  private validateLineAgainstReturn(salesReturn: ReturnRow, line: ReturnableLineRow, invoiceLineId: string | null) {
    if (line.SalesOrderId !== salesReturn.SalesOrderId || line.CustomerId !== salesReturn.CustomerId) {
      throw this.conflict("SALES_RETURN_LINE_CONTEXT_MISMATCH", "La linea no corresponde al mismo pedido y cliente.");
    }
    if (salesReturn.SalesInvoiceId && line.SalesInvoiceId !== salesReturn.SalesInvoiceId) {
      throw this.conflict("SALES_RETURN_LINE_INVOICE_MISMATCH", "La linea no corresponde a la factura indicada.");
    }
    if (invoiceLineId && invoiceLineId !== line.SalesInvoiceLineId) {
      throw this.conflict("SALES_RETURN_INVOICE_LINE_MISMATCH", "La linea de factura no coincide con la linea despachada.");
    }
  }

  private async validateQuantity(
    transaction: sql.Transaction,
    context: SalesReturnContextInput,
    shipmentLineId: string,
    quantity: number,
    excludingLineId: string | null
  ) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(MAX(ReturnableQuantity), 0) AS Total
        FROM sales.V_SalesShipmentReturnSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesShipmentLineId = @SalesShipmentLineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentLineId", value: shipmentLineId }
      ]
    );
    const draftRows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(line.Quantity), 0) AS Total
        FROM sales.SalesReturnLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesReturns salesReturn WITH (UPDLOCK, HOLDLOCK)
          ON salesReturn.SalesReturnId = line.SalesReturnId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.SalesShipmentLineId = @SalesShipmentLineId
          AND salesReturn.Status = 'DRAFT'
          AND (@ExcludingLineId IS NULL OR line.SalesReturnLineId <> @ExcludingLineId);
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentLineId", value: shipmentLineId },
        { name: "ExcludingLineId", value: excludingLineId }
      ]
    );
    const available = Number(rows[0]?.Total ?? 0) - Number(draftRows[0]?.Total ?? 0);
    if (quantity <= 0 || quantity > available + 0.0001) {
      throw this.conflict("SALES_RETURN_QUANTITY_EXCEEDS_AVAILABLE", "La cantidad excede el pendiente disponible para devolver.");
    }
  }

  private async lockReturnLine(transaction: sql.Transaction, context: SalesReturnContextInput, returnId: string, lineId: string) {
    const rows = await this.queryInTransaction<ReturnLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesReturnLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesReturnId = @SalesReturnId
          AND SalesReturnLineId = @LineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: returnId },
        { name: "LineId", value: lineId }
      ]
    );
    const row = rows[0];
    if (!row) throw new NotFoundError("Sales return line not found.", { lineId }, "SALES_RETURN_LINE_NOT_FOUND");
    return row;
  }

  private lockReturnLines(transaction: sql.Transaction, context: SalesReturnContextInput, returnId: string) {
    return this.queryInTransaction<ReturnLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesReturnLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesReturnId = @SalesReturnId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: returnId }
      ]
    );
  }

  private async getShipmentReturnableTotal(transaction: sql.Transaction, context: SalesReturnContextInput, shipmentId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(ReturnableQuantity), 0) AS Total
        FROM sales.V_SalesShipmentReturnSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesShipmentId = @SalesShipmentId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentId", value: shipmentId }
      ]
    );
    return Number(rows[0]?.Total ?? 0);
  }

  private async insertInventoryMovement(transaction: sql.Transaction, context: SalesReturnContextInput, salesReturn: ReturnRow, movementId: string, movementNumber: string) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO inventory.InventoryMovements (
          InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
          MovementDate, Status, SourceModule, SourceDocumentId, SourceDocumentNumber,
          Reference, Notes, IsActive, CreatedBy
        )
        VALUES (
          @InventoryMovementId, @TenantId, @CompanyId, @MovementNumber, 'SALES_RETURN',
          SYSUTCDATETIME(), 'DRAFT', 'SALES', @SourceDocumentId, @SourceDocumentNumber,
          @Reference, @Notes, 1, @UserId
        );
      `,
      [
        { name: "InventoryMovementId", value: movementId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "MovementNumber", value: movementNumber },
        { name: "SourceDocumentId", value: salesReturn.SalesReturnId },
        { name: "SourceDocumentNumber", value: salesReturn.ReturnNumber },
        { name: "Reference", value: salesReturn.ShipmentNumber },
        { name: "Notes", value: `Devolucion ${salesReturn.ReturnNumber} contra despacho ${salesReturn.ShipmentNumber} y pedido ${salesReturn.OrderNumber}` },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async insertInventoryMovementLine(transaction: sql.Transaction, context: SalesReturnContextInput, movementId: string, line: ReturnLineRow) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO inventory.InventoryMovementLines (
          InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId, LineNumber,
          ItemId, WarehouseId, UnitOfMeasureId, Quantity, UnitCost, Notes, CreatedBy
        )
        VALUES (
          @InventoryMovementLineId, @InventoryMovementId, @TenantId, @CompanyId, @LineNumber,
          @ItemId, @WarehouseId, @UnitOfMeasureId, @Quantity, 0, @Notes, @UserId
        );
      `,
      [
        { name: "InventoryMovementLineId", value: randomUUID() },
        { name: "InventoryMovementId", value: movementId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "LineNumber", value: line.LineNumber },
        { name: "ItemId", value: line.ItemId },
        { name: "WarehouseId", value: line.WarehouseId },
        { name: "UnitOfMeasureId", value: line.UnitOfMeasureId },
        { name: "Quantity", value: line.Quantity },
        { name: "Notes", value: line.Notes ?? line.Reason },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async lockOperation(transaction: sql.Transaction, context: SalesReturnContextInput, idempotencyKey: string, requestHash: string) {
    const rows = await this.queryInTransaction<OperationRow>(
      transaction,
      `
        SELECT SalesReturnId, RequestHash, InventoryMovementId, ResultStatus
        FROM sales.SalesReturnOperations WITH (UPDLOCK, HOLDLOCK)
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
      throw this.conflict("SALES_RETURN_IDEMPOTENCY_CONFLICT", "La clave idempotente ya fue usada con un payload diferente.");
    }
    return row;
  }

  private async insertOperation(
    transaction: sql.Transaction,
    context: SalesReturnContextInput,
    returnId: string,
    idempotencyKey: string,
    requestHash: string,
    movementId: string
  ) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO sales.SalesReturnOperations (
          SalesReturnOperationId, TenantId, CompanyId, SalesReturnId, OperationType,
          IdempotencyKey, RequestHash, ResultStatus, InventoryMovementId, CreatedBy
        )
        VALUES (
          @OperationId, @TenantId, @CompanyId, @SalesReturnId, 'POST',
          @IdempotencyKey, @RequestHash, 'POSTED', @InventoryMovementId, @UserId
        );
      `,
      [
        { name: "OperationId", value: randomUUID() },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesReturnId", value: returnId },
        { name: "IdempotencyKey", value: idempotencyKey },
        { name: "RequestHash", value: requestHash },
        { name: "InventoryMovementId", value: movementId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async nextLineNumber(transaction: sql.Transaction, returnId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS Total
        FROM sales.SalesReturnLines WITH (UPDLOCK, HOLDLOCK)
        WHERE SalesReturnId = @SalesReturnId;
      `,
      [{ name: "SalesReturnId", value: returnId }]
    );
    return Number(rows[0]?.Total ?? 1);
  }

  private async updateReturnWarehouse(transaction: sql.Transaction, context: SalesReturnContextInput, returnId: string) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE sales.SalesReturns
        SET WarehouseId = (
              SELECT CASE WHEN COUNT(DISTINCT WarehouseId) = 1 THEN MAX(WarehouseId) ELSE NULL END
              FROM sales.SalesReturnLines
              WHERE SalesReturnId = @SalesReturnId
            ),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE SalesReturnId = @SalesReturnId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "SalesReturnId", value: returnId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async generateReturnNumber(transaction: sql.Transaction, context: SalesReturnContextInput) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS Total
        FROM sales.SalesReturns WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    return `DEV-${String(Number(rows[0]?.Total ?? 1)).padStart(6, "0")}`;
  }

  private async generateMovementNumber(transaction: sql.Transaction, context: SalesReturnContextInput) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS Total
        FROM inventory.InventoryMovements WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND MovementType = 'SALES_RETURN';
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    return `MOV-RET-${String(Number(rows[0]?.Total ?? 1)).padStart(6, "0")}`;
  }

  private ensureReturnDraft(salesReturn: ReturnRow) {
    if (salesReturn.Status !== "DRAFT") {
      throw this.conflict("SALES_RETURN_NOT_DRAFT", "Solo se pueden modificar devoluciones en borrador.");
    }
  }

  private hashPayload(payload: Record<string, unknown>) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private async queryInTransaction<TRecord>(transaction: sql.Transaction, sqlText: string, parameters: readonly SqlParameter[] = []) {
    const request = new sql.Request(transaction);
    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }
    const result = await request.query<TRecord>(sqlText);
    return result.recordset;
  }

  private conflict(code: string, message: string) {
    return new AppError({ statusCode: 409, code, message, isOperational: true });
  }
}

export const salesReturnRepository = new SalesReturnRepository();
