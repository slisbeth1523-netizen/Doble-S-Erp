import { randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  PurchaseOrderCancelPayload,
  PurchaseOrderCreatePayload,
  PurchaseOrderListQuery
} from "../validators/purchase-order.validators.js";

export type PurchaseOrderStatus = "DRAFT" | "APPROVED" | "CANCELLED" | "CLOSED";

export type PurchaseOrderContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type PurchaseOrderCreateInput = PurchaseOrderContextInput & PurchaseOrderCreatePayload;
export type PurchaseOrderCancelInput = PurchaseOrderContextInput & PurchaseOrderCancelPayload;

export type PurchaseOrderLineResult = {
  id: string;
  purchaseOrderId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  unitOfMeasureId?: string;
  unitOfMeasureCode?: string;
  quantity: number;
  unitCost: number;
  discountAmount: number;
  taxAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  expectedDate?: Date;
  notes?: string;
};

export type PurchaseOrderResult = {
  id: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: Date;
  expectedDate?: Date;
  reference?: string;
  notes?: string;
  approvedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  closedAt?: Date;
  lineCount: number;
  totalQuantity: number;
  subtotalAmount: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  lines: PurchaseOrderLineResult[];
};

type PurchaseOrderSummaryRow = {
  PurchaseOrderId: string;
  PurchaseOrderNumber: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  Status: PurchaseOrderStatus;
  OrderDate: Date;
  ExpectedDate: Date | null;
  Reference: string | null;
  Notes: string | null;
  ApprovedAt: Date | null;
  CancelledAt: Date | null;
  CancellationReason: string | null;
  ClosedAt: Date | null;
  LineCount: number;
  TotalQuantity: number;
  SubtotalAmount: number;
  DiscountAmount: number;
  TaxAmount: number;
  TotalAmount: number;
};

type PurchaseOrderLineRow = {
  PurchaseOrderLineId: string;
  PurchaseOrderId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  UnitOfMeasureId: string | null;
  UnitOfMeasureCode: string | null;
  Quantity: number;
  UnitCost: number;
  DiscountAmount: number;
  TaxAmount: number;
  LineSubtotal: number;
  LineTotal: number;
  ExpectedDate: Date | null;
  Notes: string | null;
};

type EntityExistsRow = {
  EntityId: string;
};

type PurchaseOrderNumberRow = {
  PurchaseOrderNumber: string;
};

type StatusRow = {
  Status: PurchaseOrderStatus;
};

export class PurchaseOrderRepository extends BaseSqlRepository {
  async createPurchaseOrder(input: PurchaseOrderCreateInput): Promise<PurchaseOrderResult> {
    const purchaseOrderId = await this.executeInTransaction(async (transaction) => {
      await this.validatePurchaseOrderInput(transaction, input);

      const orderId = randomUUID();
      const purchaseOrderNumber = await this.generatePurchaseOrderNumber(transaction, input);
      const orderDate = input.orderDate ? new Date(input.orderDate) : new Date();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO purchasing.PurchaseOrders (
            PurchaseOrderId,
            TenantId,
            CompanyId,
            PurchaseOrderNumber,
            SupplierId,
            OrderDate,
            ExpectedDate,
            Status,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @PurchaseOrderId,
            @TenantId,
            @CompanyId,
            @PurchaseOrderNumber,
            @SupplierId,
            @OrderDate,
            @ExpectedDate,
            'DRAFT',
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "PurchaseOrderId", value: orderId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "PurchaseOrderNumber", value: purchaseOrderNumber },
          { name: "SupplierId", value: input.supplierId },
          { name: "OrderDate", value: orderDate },
          { name: "ExpectedDate", value: input.expectedDate ?? null },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      for (const [index, line] of input.lines.entries()) {
        await this.queryInTransaction(
          transaction,
          `
            INSERT INTO purchasing.PurchaseOrderLines (
              PurchaseOrderLineId,
              PurchaseOrderId,
              TenantId,
              CompanyId,
              LineNumber,
              ItemId,
              WarehouseId,
              UnitOfMeasureId,
              Quantity,
              UnitCost,
              DiscountAmount,
              TaxAmount,
              ExpectedDate,
              Notes,
              CreatedBy
            )
            VALUES (
              @PurchaseOrderLineId,
              @PurchaseOrderId,
              @TenantId,
              @CompanyId,
              @LineNumber,
              @ItemId,
              @WarehouseId,
              @UnitOfMeasureId,
              @Quantity,
              @UnitCost,
              @DiscountAmount,
              @TaxAmount,
              @ExpectedDate,
              @Notes,
              @UserId
            );
          `,
          [
            { name: "PurchaseOrderLineId", value: randomUUID() },
            { name: "PurchaseOrderId", value: orderId },
            { name: "TenantId", value: input.tenantId },
            { name: "CompanyId", value: input.companyId },
            { name: "LineNumber", value: index + 1 },
            { name: "ItemId", value: line.itemId },
            { name: "WarehouseId", value: line.warehouseId },
            { name: "UnitOfMeasureId", value: line.unitOfMeasureId ?? null },
            { name: "Quantity", value: line.quantity },
            { name: "UnitCost", value: line.unitCost ?? 0 },
            { name: "DiscountAmount", value: line.discountAmount ?? 0 },
            { name: "TaxAmount", value: line.taxAmount ?? 0 },
            { name: "ExpectedDate", value: line.expectedDate ?? null },
            { name: "Notes", value: line.notes ?? null },
            { name: "UserId", value: input.userId ?? null }
          ]
        );
      }

      return orderId;
    });

    return this.getPurchaseOrder(input, purchaseOrderId);
  }

  async listPurchaseOrders(
    context: PurchaseOrderContextInput,
    query: PurchaseOrderListQuery
  ): Promise<PurchaseOrderResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<PurchaseOrderSummaryRow>(
      `
        SELECT
          PurchaseOrderId,
          PurchaseOrderNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          Status,
          OrderDate,
          ExpectedDate,
          Reference,
          Notes,
          ApprovedAt,
          CancelledAt,
          CancellationReason,
          ClosedAt,
          LineCount,
          TotalQuantity,
          SubtotalAmount,
          DiscountAmount,
          TaxAmount,
          TotalAmount
        FROM purchasing.V_PurchaseOrderSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (
            @Search IS NULL
            OR PurchaseOrderNumber LIKE @Search
            OR SupplierCode LIKE @Search
            OR SupplierName LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY OrderDate DESC, PurchaseOrderNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Status", value: query.status ?? null },
        { name: "Search", value: search },
        { name: "Offset", value: offset },
        { name: "PageSize", value: pageSize }
      ]
    );

    return rows.map((row) => this.mapOrder(row, []));
  }

  async getPurchaseOrder(
    context: PurchaseOrderContextInput,
    purchaseOrderId: string
  ): Promise<PurchaseOrderResult> {
    const rows = await this.query<PurchaseOrderSummaryRow>(
      `
        SELECT
          PurchaseOrderId,
          PurchaseOrderNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          Status,
          OrderDate,
          ExpectedDate,
          Reference,
          Notes,
          ApprovedAt,
          CancelledAt,
          CancellationReason,
          ClosedAt,
          LineCount,
          TotalQuantity,
          SubtotalAmount,
          DiscountAmount,
          TaxAmount,
          TotalAmount
        FROM purchasing.V_PurchaseOrderSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseOrderId = @PurchaseOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseOrderId", value: purchaseOrderId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError(
        "Purchase order not found.",
        { purchaseOrderId },
        "PURCHASE_ORDER_NOT_FOUND"
      );
    }

    const lines = await this.getPurchaseOrderLines(context, purchaseOrderId);
    return this.mapOrder(row, lines);
  }

  async approvePurchaseOrder(
    context: PurchaseOrderContextInput,
    purchaseOrderId: string
  ): Promise<PurchaseOrderResult> {
    await this.executeInTransaction(async (transaction) => {
      const status = await this.lockPurchaseOrderStatus(transaction, context, purchaseOrderId);

      if (status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "PURCHASE_ORDER_APPROVE_INVALID_STATUS",
          message: "Only DRAFT purchase orders can be approved.",
          isOperational: true
        });
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE purchasing.PurchaseOrders
          SET Status = 'APPROVED',
              ApprovedAt = SYSUTCDATETIME(),
              ApprovedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE PurchaseOrderId = @PurchaseOrderId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "PurchaseOrderId", value: purchaseOrderId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getPurchaseOrder(context, purchaseOrderId);
  }

  async cancelPurchaseOrder(
    input: PurchaseOrderCancelInput,
    purchaseOrderId: string
  ): Promise<PurchaseOrderResult> {
    await this.executeInTransaction(async (transaction) => {
      const status = await this.lockPurchaseOrderStatus(transaction, input, purchaseOrderId);

      if (status !== "DRAFT" && status !== "APPROVED") {
        throw new AppError({
          statusCode: 409,
          code: "PURCHASE_ORDER_CANCEL_INVALID_STATUS",
          message: "Only DRAFT or APPROVED purchase orders can be cancelled.",
          isOperational: true
        });
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE purchasing.PurchaseOrders
          SET Status = 'CANCELLED',
              CancelledAt = SYSUTCDATETIME(),
              CancelledBy = @UserId,
              CancellationReason = @Reason,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE PurchaseOrderId = @PurchaseOrderId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "PurchaseOrderId", value: purchaseOrderId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "Reason", value: input.reason ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );
    });

    return this.getPurchaseOrder(input, purchaseOrderId);
  }

  private async getPurchaseOrderLines(
    context: PurchaseOrderContextInput,
    purchaseOrderId: string
  ): Promise<PurchaseOrderLineResult[]> {
    const rows = await this.query<PurchaseOrderLineRow>(
      `
        SELECT
          PurchaseOrderLineId,
          PurchaseOrderId,
          LineNumber,
          ItemId,
          ItemCode,
          ItemDescription,
          WarehouseId,
          WarehouseCode,
          WarehouseName,
          UnitOfMeasureId,
          UnitOfMeasureCode,
          Quantity,
          UnitCost,
          DiscountAmount,
          TaxAmount,
          LineSubtotal,
          LineTotal,
          ExpectedDate,
          Notes
        FROM purchasing.V_PurchaseOrderLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseOrderId = @PurchaseOrderId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseOrderId", value: purchaseOrderId }
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

  private async validatePurchaseOrderInput(
    transaction: sql.Transaction,
    input: PurchaseOrderCreateInput
  ) {
    await this.ensureSupplierExists(transaction, input);

    for (const [index, line] of input.lines.entries()) {
      const lineNumber = index + 1;
      await this.ensureItemExists(transaction, input, line.itemId, lineNumber);
      await this.ensureWarehouseExists(transaction, input, line.warehouseId, lineNumber);

      if (line.unitOfMeasureId) {
        await this.ensureUnitOfMeasureExists(transaction, input, line.unitOfMeasureId, lineNumber);
      }
    }
  }

  private async ensureSupplierExists(transaction: sql.Transaction, input: PurchaseOrderCreateInput) {
    const rows = await this.queryInTransaction<EntityExistsRow>(
      transaction,
      `
        SELECT SupplierId AS EntityId
        FROM purchasing.Suppliers
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierId = @SupplierId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "SupplierId", value: input.supplierId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "PURCHASE_ORDER_SUPPLIER_NOT_FOUND",
        message: "Supplier does not exist for this purchase order.",
        isOperational: true
      });
    }
  }

  private async ensureItemExists(
    transaction: sql.Transaction,
    input: PurchaseOrderCreateInput,
    itemId: string,
    lineNumber: number
  ) {
    const rows = await this.queryInTransaction<EntityExistsRow>(
      transaction,
      `
        SELECT ItemId AS EntityId
        FROM inventory.Items
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "ItemId", value: itemId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "PURCHASE_ORDER_ITEM_NOT_FOUND",
        message: `Inventory item does not exist for purchase order line ${lineNumber}.`,
        isOperational: true
      });
    }
  }

  private async ensureWarehouseExists(
    transaction: sql.Transaction,
    input: PurchaseOrderCreateInput,
    warehouseId: string,
    lineNumber: number
  ) {
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
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "PURCHASE_ORDER_WAREHOUSE_NOT_FOUND",
        message: `Warehouse does not exist for purchase order line ${lineNumber}.`,
        isOperational: true
      });
    }
  }

  private async ensureUnitOfMeasureExists(
    transaction: sql.Transaction,
    input: PurchaseOrderCreateInput,
    unitOfMeasureId: string,
    lineNumber: number
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
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "UnitOfMeasureId", value: unitOfMeasureId }
      ]
    );

    if (!rows[0]) {
      throw new AppError({
        statusCode: 400,
        code: "PURCHASE_ORDER_UNIT_NOT_FOUND",
        message: `Unit of measure does not exist for purchase order line ${lineNumber}.`,
        isOperational: true
      });
    }
  }

  private async lockPurchaseOrderStatus(
    transaction: sql.Transaction,
    context: PurchaseOrderContextInput,
    purchaseOrderId: string
  ) {
    const rows = await this.queryInTransaction<StatusRow>(
      transaction,
      `
        SELECT Status
        FROM purchasing.PurchaseOrders WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseOrderId = @PurchaseOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseOrderId", value: purchaseOrderId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError(
        "Purchase order not found.",
        { purchaseOrderId },
        "PURCHASE_ORDER_NOT_FOUND"
      );
    }

    return row.Status;
  }

  private async generatePurchaseOrderNumber(
    transaction: sql.Transaction,
    input: PurchaseOrderContextInput
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const purchaseOrderNumber = this.buildPurchaseOrderNumber();
      const rows = await this.queryInTransaction<PurchaseOrderNumberRow>(
        transaction,
        `
          SELECT PurchaseOrderNumber
          FROM purchasing.PurchaseOrders WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND PurchaseOrderNumber = @PurchaseOrderNumber;
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "PurchaseOrderNumber", value: purchaseOrderNumber }
        ]
      );

      if (!rows[0]) {
        return purchaseOrderNumber;
      }
    }

    throw new AppError({
      statusCode: 409,
      code: "PURCHASE_ORDER_NUMBER_COLLISION",
      message: "Could not generate a unique purchase order number.",
      isOperational: true
    });
  }

  private buildPurchaseOrderNumber() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();

    return `OC-${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}-${suffix}`;
  }

  private mapOrder(
    row: PurchaseOrderSummaryRow,
    lines: PurchaseOrderLineResult[]
  ): PurchaseOrderResult {
    return {
      id: row.PurchaseOrderId,
      purchaseOrderNumber: row.PurchaseOrderNumber,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
      status: row.Status,
      orderDate: row.OrderDate,
      expectedDate: row.ExpectedDate ?? undefined,
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      approvedAt: row.ApprovedAt ?? undefined,
      cancelledAt: row.CancelledAt ?? undefined,
      cancellationReason: row.CancellationReason ?? undefined,
      closedAt: row.ClosedAt ?? undefined,
      lineCount: Number(row.LineCount),
      totalQuantity: Number(row.TotalQuantity),
      subtotalAmount: Number(row.SubtotalAmount),
      discountAmount: Number(row.DiscountAmount),
      taxAmount: Number(row.TaxAmount),
      totalAmount: Number(row.TotalAmount),
      lines
    };
  }

  private mapLine(row: PurchaseOrderLineRow): PurchaseOrderLineResult {
    return {
      id: row.PurchaseOrderLineId,
      purchaseOrderId: row.PurchaseOrderId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId,
      warehouseCode: row.WarehouseCode,
      warehouseName: row.WarehouseName,
      unitOfMeasureId: row.UnitOfMeasureId ?? undefined,
      unitOfMeasureCode: row.UnitOfMeasureCode ?? undefined,
      quantity: Number(row.Quantity),
      unitCost: Number(row.UnitCost),
      discountAmount: Number(row.DiscountAmount),
      taxAmount: Number(row.TaxAmount),
      lineSubtotal: Number(row.LineSubtotal),
      lineTotal: Number(row.LineTotal),
      expectedDate: row.ExpectedDate ?? undefined,
      notes: row.Notes ?? undefined
    };
  }
}

export const purchaseOrderRepository = new PurchaseOrderRepository();
