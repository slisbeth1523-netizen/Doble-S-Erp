import { createHash, randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import { inventoryPostingRepository } from "../../inventory/infrastructure/InventoryPostingRepository.js";
import type {
  SalesShipmentCreatePayload,
  SalesShipmentLineCreatePayload,
  SalesShipmentLineUpdatePayload,
  SalesShipmentListQuery,
  SalesShipmentPostPayload
} from "../validators/sales-shipment.validators.js";

export type SalesShipmentContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SalesShipmentContext = SalesShipmentContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type SalesShipmentStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SalesShipmentLineResult = {
  id: string;
  salesShipmentId: string;
  salesOrderLineId: string;
  inventoryReservationId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  unitOfMeasureId: string;
  unitOfMeasureCode: string;
  quantity: number;
  notes?: string;
};

export type SalesShipmentResult = {
  id: string;
  shipmentNumber: string;
  salesOrderId: string;
  orderNumber: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  shipmentDate: Date;
  status: SalesShipmentStatus;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  reference?: string;
  notes?: string;
  inventoryMovementId?: string;
  movementNumber?: string;
  postedAt?: Date;
  lineCount: number;
  totalQuantity: number;
  lines: SalesShipmentLineResult[];
  idempotencyReplayed?: boolean;
  orderClosed?: boolean;
};

export type SalesOrderShipmentLineResult = {
  salesOrderId: string;
  orderNumber: string;
  orderStatus: string;
  salesOrderLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId?: string;
  warehouseCode?: string;
  warehouseName?: string;
  orderedQuantity: number;
  reservedQuantity: number;
  previouslyShippedQuantity: number;
  pendingShipmentQuantity: number;
  activeReservationQuantity: number;
};

export type PagedResult<TRecord> = {
  records: TRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
};

type ShipmentRow = {
  SalesShipmentId: string;
  ShipmentNumber: string;
  SalesOrderId: string;
  OrderNumber: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  ShipmentDate: Date;
  Status: SalesShipmentStatus;
  WarehouseId: string | null;
  WarehouseCode: string | null;
  WarehouseName: string | null;
  Reference: string | null;
  Notes: string | null;
  InventoryMovementId: string | null;
  MovementNumber: string | null;
  PostedAt: Date | null;
  LineCount: number;
  TotalQuantity: number;
};

type ShipmentLineRow = {
  SalesShipmentLineId: string;
  SalesShipmentId: string;
  SalesOrderLineId: string;
  InventoryReservationId: string;
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
  Notes: string | null;
};

type OrderLockRow = {
  SalesOrderId: string;
  OrderNumber: string;
  Status: string;
};

type ShipmentLockRow = {
  SalesShipmentId: string;
  ShipmentNumber: string;
  SalesOrderId: string;
  Status: SalesShipmentStatus;
  WarehouseId: string | null;
  InventoryMovementId: string | null;
};

type ReservationLockRow = {
  InventoryReservationId: string;
  SalesOrderId: string;
  SalesOrderLineId: string;
  ItemId: string;
  WarehouseId: string;
  ActiveQuantity: number;
  ConsumedQuantity: number;
  ReleasedQuantity: number;
  ReservedQuantity: number;
  Status: string;
};

type OrderLineLockRow = {
  SalesOrderLineId: string;
  SalesOrderId: string;
  ItemId: string;
  WarehouseId: string | null;
  UnitOfMeasureId: string;
  Quantity: number;
  LineNumber: number;
};

type CountRow = { TotalItems: number };
type TotalRow = { Total: number };
type OperationRow = {
  SalesShipmentId: string;
  RequestHash: string;
  InventoryMovementId: string | null;
  ResultStatus: SalesShipmentStatus;
};

type PostResult = {
  shipmentId: string;
  replayed: boolean;
  orderClosed?: boolean;
};

export class SalesShipmentRepository extends BaseSqlRepository {
  async createShipment(context: SalesShipmentContextInput, payload: SalesShipmentCreatePayload) {
    const shipmentId = await this.executeInTransaction(async (transaction) => {
      const order = await this.lockOrder(transaction, context, payload.salesOrderId);
      if (order.Status !== "APPROVED") {
        throw this.conflict("SALES_SHIPMENT_ORDER_NOT_APPROVED", "Solo se pueden despachar pedidos aprobados.");
      }
      const pending = await this.getOrderPendingShipmentTotal(transaction, context, payload.salesOrderId);
      if (pending <= 0) {
        throw this.conflict("SALES_SHIPMENT_ORDER_HAS_NO_PENDING", "El pedido no tiene cantidades pendientes de despachar.");
      }

      const shipmentId = randomUUID();
      const shipmentNumber = await this.generateShipmentNumber(transaction, context);
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesShipments (
            SalesShipmentId, TenantId, CompanyId, ShipmentNumber, SalesOrderId,
            ShipmentDate, Status, Reference, Notes, IsActive, CreatedBy
          )
          VALUES (
            @SalesShipmentId, @TenantId, @CompanyId, @ShipmentNumber, @SalesOrderId,
            @ShipmentDate, 'DRAFT', @Reference, @Notes, 1, @UserId
          );
        `,
        [
          { name: "SalesShipmentId", value: shipmentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "ShipmentNumber", value: shipmentNumber },
          { name: "SalesOrderId", value: payload.salesOrderId },
          { name: "ShipmentDate", value: payload.shipmentDate ?? new Date() },
          { name: "Reference", value: payload.reference ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      return shipmentId;
    });

    return this.getShipment(context, shipmentId);
  }

  async listShipments(context: SalesShipmentContextInput, query: SalesShipmentListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "SalesOrderId", value: query.salesOrderId ?? null },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "WarehouseId", value: query.warehouseId ?? null },
      { name: "DateFrom", value: query.dateFrom ?? null },
      { name: "DateTo", value: query.dateTo ?? null },
      { name: "Search", value: search }
    ];
    const whereClause = this.shipmentWhereClause();
    const [records, counts] = await Promise.all([
      this.query<ShipmentRow>(
        `
          SELECT *
          FROM sales.V_SalesShipmentSummary
          WHERE ${whereClause}
          ORDER BY ShipmentDate DESC, ShipmentNumber DESC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        [...parameters, { name: "Offset", value: offset }, { name: "PageSize", value: pageSize }]
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM sales.V_SalesShipmentSummary
          WHERE ${whereClause};
        `,
        parameters
      )
    ]);

    const shipments = await Promise.all(records.map((row) => this.mapShipmentWithLines(context, row)));
    return {
      records: shipments,
      pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) }
    } satisfies PagedResult<SalesShipmentResult>;
  }

  async getShipment(context: SalesShipmentContextInput, shipmentId: string): Promise<SalesShipmentResult> {
    const rows = await this.query<ShipmentRow>(
      `
        SELECT *
        FROM sales.V_SalesShipmentSummary
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
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales shipment not found.", { shipmentId }, "SALES_SHIPMENT_NOT_FOUND");
    }
    return this.mapShipmentWithLines(context, row);
  }

  async getOrderShipmentLines(context: SalesShipmentContextInput, salesOrderId: string) {
    const rows = await this.query<SalesOrderShipmentLineResult & {
      SalesOrderId: string;
      OrderNumber: string;
      OrderStatus: string;
      SalesOrderLineId: string;
      LineNumber: number;
      ItemId: string;
      ItemCode: string;
      ItemDescription: string;
      WarehouseId: string | null;
      WarehouseCode: string | null;
      WarehouseName: string | null;
      OrderedQuantity: number;
      ReservedQuantity: number;
      PreviouslyShippedQuantity: number;
      PendingShipmentQuantity: number;
      ActiveReservationQuantity: number;
    }>(
      `
        SELECT *
        FROM sales.V_SalesOrderShipmentSummary
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

    return rows.map((row) => ({
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      orderStatus: row.OrderStatus,
      salesOrderLineId: row.SalesOrderLineId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId ?? undefined,
      warehouseCode: row.WarehouseCode ?? undefined,
      warehouseName: row.WarehouseName ?? undefined,
      orderedQuantity: Number(row.OrderedQuantity),
      reservedQuantity: Number(row.ReservedQuantity),
      previouslyShippedQuantity: Number(row.PreviouslyShippedQuantity),
      pendingShipmentQuantity: Number(row.PendingShipmentQuantity),
      activeReservationQuantity: Number(row.ActiveReservationQuantity)
    }));
  }

  async addLine(context: SalesShipmentContextInput, shipmentId: string, payload: SalesShipmentLineCreatePayload) {
    await this.executeInTransaction(async (transaction) => {
      const shipment = await this.lockShipment(transaction, context, shipmentId);
      this.ensureShipmentDraft(shipment);
      const orderLine = await this.lockOrderLine(transaction, context, shipment.SalesOrderId, payload.salesOrderLineId);
      const reservation = await this.lockReservation(transaction, context, payload.inventoryReservationId);
      await this.validateLineQuantity(transaction, context, shipment, orderLine, reservation, payload.quantity, null);
      const lineNumber = await this.nextLineNumber(transaction, shipmentId);
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO sales.SalesShipmentLines (
            SalesShipmentLineId, SalesShipmentId, TenantId, CompanyId, SalesOrderLineId,
            InventoryReservationId, LineNumber, ItemId, WarehouseId, UnitOfMeasureId,
            Quantity, Notes, CreatedBy
          )
          VALUES (
            @LineId, @SalesShipmentId, @TenantId, @CompanyId, @SalesOrderLineId,
            @InventoryReservationId, @LineNumber, @ItemId, @WarehouseId, @UnitOfMeasureId,
            @Quantity, @Notes, @UserId
          );
        `,
        [
          { name: "LineId", value: randomUUID() },
          { name: "SalesShipmentId", value: shipmentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "SalesOrderLineId", value: payload.salesOrderLineId },
          { name: "InventoryReservationId", value: payload.inventoryReservationId },
          { name: "LineNumber", value: lineNumber },
          { name: "ItemId", value: orderLine.ItemId },
          { name: "WarehouseId", value: orderLine.WarehouseId },
          { name: "UnitOfMeasureId", value: orderLine.UnitOfMeasureId },
          { name: "Quantity", value: payload.quantity },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.updateShipmentWarehouse(transaction, context, shipmentId);
    });
    return this.getShipment(context, shipmentId);
  }

  async updateLine(
    context: SalesShipmentContextInput,
    shipmentId: string,
    lineId: string,
    payload: SalesShipmentLineUpdatePayload
  ) {
    await this.executeInTransaction(async (transaction) => {
      const shipment = await this.lockShipment(transaction, context, shipmentId);
      this.ensureShipmentDraft(shipment);
      const line = await this.lockShipmentLine(transaction, context, shipmentId, lineId);
      const orderLine = await this.lockOrderLine(transaction, context, shipment.SalesOrderId, line.SalesOrderLineId);
      const reservation = await this.lockReservation(transaction, context, line.InventoryReservationId);
      const nextQuantity = payload.quantity ?? Number(line.Quantity);
      await this.validateLineQuantity(transaction, context, shipment, orderLine, reservation, nextQuantity, lineId);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesShipmentLines
          SET Quantity = @Quantity,
              Notes = COALESCE(@Notes, Notes),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesShipmentLineId = @LineId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "LineId", value: lineId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "Quantity", value: nextQuantity },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      await this.updateShipmentWarehouse(transaction, context, shipmentId);
    });
    return this.getShipment(context, shipmentId);
  }

  async deleteLine(context: SalesShipmentContextInput, shipmentId: string, lineId: string) {
    await this.executeInTransaction(async (transaction) => {
      const shipment = await this.lockShipment(transaction, context, shipmentId);
      this.ensureShipmentDraft(shipment);
      await this.queryInTransaction(
        transaction,
        `
          DELETE FROM sales.SalesShipmentLines
          WHERE SalesShipmentLineId = @LineId
            AND SalesShipmentId = @SalesShipmentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "LineId", value: lineId },
          { name: "SalesShipmentId", value: shipmentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );
      await this.updateShipmentWarehouse(transaction, context, shipmentId);
    });
    return this.getShipment(context, shipmentId);
  }

  async postShipment(context: SalesShipmentContextInput, shipmentId: string, payload: SalesShipmentPostPayload) {
    const requestHash = this.hashPayload({ operationType: "POST", shipmentId, idempotencyKey: payload.idempotencyKey });
    const postResult = await this.executeInTransaction<PostResult>(async (transaction) => {
      const operation = await this.lockOperation(transaction, context, payload.idempotencyKey, requestHash);
      if (operation) {
        return { shipmentId: operation.SalesShipmentId, replayed: true };
      }

      const shipment = await this.lockShipment(transaction, context, shipmentId);
      if (shipment.Status === "POSTED") {
        throw this.conflict("SALES_SHIPMENT_ALREADY_POSTED", "El despacho ya fue posteado.");
      }
      this.ensureShipmentDraft(shipment);

      const order = await this.lockOrder(transaction, context, shipment.SalesOrderId);
      if (order.Status !== "APPROVED") {
        throw this.conflict("SALES_SHIPMENT_ORDER_NOT_APPROVED", "Solo se pueden postear despachos de pedidos aprobados.");
      }

      const lines = await this.lockShipmentLinesForPosting(transaction, context, shipmentId);
      if (!lines.length) {
        throw new AppError({
          statusCode: 400,
          code: "SALES_SHIPMENT_HAS_NO_LINES",
          message: "El despacho debe tener lineas para postear.",
          isOperational: true
        });
      }

      for (const line of lines) {
        const orderLine = await this.lockOrderLine(transaction, context, shipment.SalesOrderId, line.SalesOrderLineId);
        const reservation = await this.lockReservation(transaction, context, line.InventoryReservationId);
        await this.validateLineQuantity(transaction, context, shipment, orderLine, reservation, Number(line.Quantity), line.SalesShipmentLineId);
      }

      const movementId = randomUUID();
      const movementNumber = await this.generateMovementNumber(transaction, context);
      await this.insertInventoryMovement(transaction, context, shipment, movementId, movementNumber);
      for (const line of lines) {
        await this.insertInventoryMovementLine(transaction, context, movementId, line);
      }

      const posted = await inventoryPostingRepository.postMovementInTransaction(transaction, {
        tenantId: context.tenantId,
        companyId: context.companyId,
        movementId,
        postedBy: context.userId
      });

      for (const line of lines) {
        await this.consumeReservation(transaction, context, line.InventoryReservationId, Number(line.Quantity));
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE sales.SalesShipments
          SET Status = 'POSTED',
              InventoryMovementId = @InventoryMovementId,
              PostedAt = @PostedAt,
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SalesShipmentId = @SalesShipmentId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SalesShipmentId", value: shipmentId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "InventoryMovementId", value: movementId },
          { name: "PostedAt", value: posted.postedAt },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      const orderClosed = await this.closeOrderIfFullyShipped(transaction, context, shipment.SalesOrderId);
      await this.insertOperation(transaction, context, shipmentId, payload.idempotencyKey, requestHash, movementId);
      return { shipmentId, replayed: false, orderClosed };
    });

    const result = await this.getShipment(context, postResult.shipmentId);
    return { ...result, idempotencyReplayed: postResult.replayed || undefined, orderClosed: postResult.orderClosed || undefined };
  }

  private shipmentWhereClause() {
    return `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@SalesOrderId IS NULL OR SalesOrderId = @SalesOrderId)
      AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@WarehouseId IS NULL OR WarehouseId = @WarehouseId)
      AND (@DateFrom IS NULL OR ShipmentDate >= @DateFrom)
      AND (@DateTo IS NULL OR ShipmentDate < DATEADD(DAY, 1, @DateTo))
      AND (
        @Search IS NULL
        OR ShipmentNumber LIKE @Search
        OR OrderNumber LIKE @Search
        OR CustomerCode LIKE @Search
        OR CustomerName LIKE @Search
        OR Reference LIKE @Search
      )
    `;
  }

  private async mapShipmentWithLines(context: SalesShipmentContextInput, row: ShipmentRow) {
    const lines = await this.getShipmentLines(context, row.SalesShipmentId);
    return this.mapShipment(row, lines);
  }

  private async getShipmentLines(context: SalesShipmentContextInput, shipmentId: string) {
    const rows = await this.query<ShipmentLineRow>(
      `
        SELECT *
        FROM sales.V_SalesShipmentLineSummary
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
    return rows.map((row) => this.mapLine(row));
  }

  private async lockOrder(transaction: sql.Transaction, context: SalesShipmentContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<OrderLockRow>(
      transaction,
      `
        SELECT SalesOrderId, OrderNumber, Status
        FROM sales.SalesOrders WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
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
    return row;
  }

  private async lockShipment(transaction: sql.Transaction, context: SalesShipmentContextInput, shipmentId: string) {
    const rows = await this.queryInTransaction<ShipmentLockRow>(
      transaction,
      `
        SELECT SalesShipmentId, ShipmentNumber, SalesOrderId, Status, WarehouseId, InventoryMovementId
        FROM sales.SalesShipments WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
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
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales shipment not found.", { shipmentId }, "SALES_SHIPMENT_NOT_FOUND");
    }
    return row;
  }

  private ensureShipmentDraft(shipment: ShipmentLockRow) {
    if (shipment.Status !== "DRAFT") {
      throw this.conflict("SALES_SHIPMENT_NOT_DRAFT", "Solo se pueden modificar despachos en borrador.");
    }
  }

  private async lockOrderLine(transaction: sql.Transaction, context: SalesShipmentContextInput, salesOrderId: string, salesOrderLineId: string) {
    const rows = await this.queryInTransaction<OrderLineLockRow>(
      transaction,
      `
        SELECT SalesOrderLineId, SalesOrderId, ItemId, WarehouseId, UnitOfMeasureId, Quantity, LineNumber
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
    if (!row.WarehouseId) {
      throw this.conflict("SALES_SHIPMENT_LINE_WAREHOUSE_REQUIRED", "La linea del pedido debe tener almacen.");
    }
    return row;
  }

  private async lockReservation(transaction: sql.Transaction, context: SalesShipmentContextInput, reservationId: string) {
    const rows = await this.queryInTransaction<ReservationLockRow>(
      transaction,
      `
        SELECT InventoryReservationId, SalesOrderId, SalesOrderLineId, ItemId, WarehouseId,
               ActiveQuantity, ConsumedQuantity, ReleasedQuantity, ReservedQuantity, Status
        FROM inventory.InventoryReservations WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND InventoryReservationId = @ReservationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ReservationId", value: reservationId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Inventory reservation not found.", { reservationId }, "INVENTORY_RESERVATION_NOT_FOUND");
    }
    return row;
  }

  private async lockShipmentLine(transaction: sql.Transaction, context: SalesShipmentContextInput, shipmentId: string, lineId: string) {
    const rows = await this.queryInTransaction<ShipmentLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesShipmentLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesShipmentId = @SalesShipmentId
          AND SalesShipmentLineId = @LineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentId", value: shipmentId },
        { name: "LineId", value: lineId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Sales shipment line not found.", { lineId }, "SALES_SHIPMENT_LINE_NOT_FOUND");
    }
    return row;
  }

  private lockShipmentLinesForPosting(transaction: sql.Transaction, context: SalesShipmentContextInput, shipmentId: string) {
    return this.queryInTransaction<ShipmentLineRow>(
      transaction,
      `
        SELECT *
        FROM sales.V_SalesShipmentLineSummary
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
  }

  private async validateLineQuantity(
    transaction: sql.Transaction,
    context: SalesShipmentContextInput,
    shipment: ShipmentLockRow,
    orderLine: OrderLineLockRow,
    reservation: ReservationLockRow,
    quantity: number,
    excludingLineId: string | null
  ) {
    if (reservation.SalesOrderId !== shipment.SalesOrderId || reservation.SalesOrderLineId !== orderLine.SalesOrderLineId) {
      throw this.conflict("SALES_SHIPMENT_RESERVATION_MISMATCH", "La reserva no corresponde a la linea del pedido.");
    }
    if (reservation.ItemId !== orderLine.ItemId || reservation.WarehouseId !== orderLine.WarehouseId) {
      throw this.conflict("SALES_SHIPMENT_ITEM_WAREHOUSE_MISMATCH", "La reserva no coincide con articulo y almacen.");
    }
    if (!["ACTIVE", "PARTIALLY_RELEASED"].includes(reservation.Status) || Number(reservation.ActiveQuantity) <= 0) {
      throw this.conflict("SALES_SHIPMENT_RESERVATION_NOT_ACTIVE", "La reserva no tiene cantidad activa.");
    }

    const reservationDraftTotal = await this.getDraftShipmentQuantityForReservation(transaction, context, reservation.InventoryReservationId, excludingLineId);
    if (reservationDraftTotal + quantity > Number(reservation.ActiveQuantity) + 0.0001) {
      throw this.conflict("SALES_SHIPMENT_EXCEEDS_RESERVATION", "La cantidad excede la reserva activa.");
    }

    const postedShipped = await this.getPostedShipmentQuantity(transaction, context, orderLine.SalesOrderLineId);
    const draftLineTotal = await this.getDraftShipmentQuantityForOrderLine(transaction, context, orderLine.SalesOrderLineId, excludingLineId);
    if (postedShipped + draftLineTotal + quantity > Number(orderLine.Quantity) + 0.0001) {
      throw this.conflict("SALES_SHIPMENT_EXCEEDS_ORDER_LINE", "La cantidad excede el pendiente del pedido.");
    }
  }

  private async getOrderPendingShipmentTotal(transaction: sql.Transaction, context: SalesShipmentContextInput, salesOrderId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(PendingShipmentQuantity), 0) AS Total
        FROM sales.V_SalesOrderShipmentSummary
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

  private async getPostedShipmentQuantity(transaction: sql.Transaction, context: SalesShipmentContextInput, salesOrderLineId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(line.Quantity), 0) AS Total
        FROM sales.SalesShipmentLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesShipments shipment WITH (UPDLOCK, HOLDLOCK)
          ON shipment.SalesShipmentId = line.SalesShipmentId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.SalesOrderLineId = @SalesOrderLineId
          AND shipment.Status = 'POSTED';
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderLineId", value: salesOrderLineId }
      ]
    );
    return Number(rows[0]?.Total ?? 0);
  }

  private async getDraftShipmentQuantityForOrderLine(
    transaction: sql.Transaction,
    context: SalesShipmentContextInput,
    salesOrderLineId: string,
    excludingLineId: string | null
  ) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(line.Quantity), 0) AS Total
        FROM sales.SalesShipmentLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesShipments shipment WITH (UPDLOCK, HOLDLOCK)
          ON shipment.SalesShipmentId = line.SalesShipmentId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.SalesOrderLineId = @SalesOrderLineId
          AND shipment.Status = 'DRAFT'
          AND (@ExcludingLineId IS NULL OR line.SalesShipmentLineId <> @ExcludingLineId);
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderLineId", value: salesOrderLineId },
        { name: "ExcludingLineId", value: excludingLineId }
      ]
    );
    return Number(rows[0]?.Total ?? 0);
  }

  private async getDraftShipmentQuantityForReservation(
    transaction: sql.Transaction,
    context: SalesShipmentContextInput,
    reservationId: string,
    excludingLineId: string | null
  ) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(line.Quantity), 0) AS Total
        FROM sales.SalesShipmentLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesShipments shipment WITH (UPDLOCK, HOLDLOCK)
          ON shipment.SalesShipmentId = line.SalesShipmentId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.InventoryReservationId = @ReservationId
          AND shipment.Status = 'DRAFT'
          AND (@ExcludingLineId IS NULL OR line.SalesShipmentLineId <> @ExcludingLineId);
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ReservationId", value: reservationId },
        { name: "ExcludingLineId", value: excludingLineId }
      ]
    );
    return Number(rows[0]?.Total ?? 0);
  }

  private async nextLineNumber(transaction: sql.Transaction, shipmentId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS Total
        FROM sales.SalesShipmentLines WITH (UPDLOCK, HOLDLOCK)
        WHERE SalesShipmentId = @SalesShipmentId;
      `,
      [{ name: "SalesShipmentId", value: shipmentId }]
    );
    return Number(rows[0]?.Total ?? 1);
  }

  private async updateShipmentWarehouse(transaction: sql.Transaction, context: SalesShipmentContextInput, shipmentId: string) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE sales.SalesShipments
        SET WarehouseId = (
              SELECT CASE WHEN COUNT(DISTINCT WarehouseId) = 1 THEN MAX(WarehouseId) ELSE NULL END
              FROM sales.SalesShipmentLines
              WHERE SalesShipmentId = @SalesShipmentId
            ),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE SalesShipmentId = @SalesShipmentId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "SalesShipmentId", value: shipmentId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async insertInventoryMovement(transaction: sql.Transaction, context: SalesShipmentContextInput, shipment: ShipmentLockRow, movementId: string, movementNumber: string) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO inventory.InventoryMovements (
          InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
          MovementDate, Status, SourceModule, SourceDocumentId, SourceDocumentNumber,
          Reference, Notes, IsActive, CreatedBy
        )
        VALUES (
          @InventoryMovementId, @TenantId, @CompanyId, @MovementNumber, 'SALES_SHIPMENT',
          SYSUTCDATETIME(), 'DRAFT', 'SALES', @SourceDocumentId, @SourceDocumentNumber,
          @Reference, @Notes, 1, @UserId
        );
      `,
      [
        { name: "InventoryMovementId", value: movementId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "MovementNumber", value: movementNumber },
        { name: "SourceDocumentId", value: shipment.SalesShipmentId },
        { name: "SourceDocumentNumber", value: shipment.ShipmentNumber },
        { name: "Reference", value: shipment.ShipmentNumber },
        { name: "Notes", value: `Despacho ${shipment.ShipmentNumber}` },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async insertInventoryMovementLine(transaction: sql.Transaction, context: SalesShipmentContextInput, movementId: string, line: ShipmentLineRow) {
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
        { name: "Notes", value: line.Notes },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async consumeReservation(transaction: sql.Transaction, context: SalesShipmentContextInput, reservationId: string, quantity: number) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE inventory.InventoryReservations
        SET ConsumedQuantity = ConsumedQuantity + @Quantity,
            Status = CASE
              WHEN ReservedQuantity - ReleasedQuantity - (ConsumedQuantity + @Quantity) <= 0 THEN 'CONSUMED'
              WHEN ReleasedQuantity > 0 OR ConsumedQuantity + @Quantity > 0 THEN 'PARTIALLY_RELEASED'
              ELSE 'ACTIVE'
            END,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND InventoryReservationId = @ReservationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ReservationId", value: reservationId },
        { name: "Quantity", value: quantity },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async closeOrderIfFullyShipped(transaction: sql.Transaction, context: SalesShipmentContextInput, salesOrderId: string) {
    const pending = await this.getOrderPendingShipmentTotal(transaction, context, salesOrderId);
    if (pending > 0.0001) {
      return false;
    }
    await this.queryInTransaction(
      transaction,
      `
        UPDATE sales.SalesOrders
        SET Status = 'CLOSED',
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderId = @SalesOrderId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderId", value: salesOrderId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
    return true;
  }

  private async lockOperation(transaction: sql.Transaction, context: SalesShipmentContextInput, idempotencyKey: string, requestHash: string) {
    const rows = await this.queryInTransaction<OperationRow>(
      transaction,
      `
        SELECT SalesShipmentId, RequestHash, InventoryMovementId, ResultStatus
        FROM sales.SalesShipmentOperations WITH (UPDLOCK, HOLDLOCK)
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
      throw this.conflict("SALES_SHIPMENT_IDEMPOTENCY_CONFLICT", "La clave idempotente ya fue usada con un payload diferente.");
    }
    return row;
  }

  private async insertOperation(
    transaction: sql.Transaction,
    context: SalesShipmentContextInput,
    shipmentId: string,
    idempotencyKey: string,
    requestHash: string,
    movementId: string
  ) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO sales.SalesShipmentOperations (
          SalesShipmentOperationId, TenantId, CompanyId, SalesShipmentId, OperationType,
          IdempotencyKey, RequestHash, ResultStatus, InventoryMovementId, CreatedBy
        )
        VALUES (
          @OperationId, @TenantId, @CompanyId, @SalesShipmentId, 'POST',
          @IdempotencyKey, @RequestHash, 'POSTED', @InventoryMovementId, @UserId
        );
      `,
      [
        { name: "OperationId", value: randomUUID() },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesShipmentId", value: shipmentId },
        { name: "IdempotencyKey", value: idempotencyKey },
        { name: "RequestHash", value: requestHash },
        { name: "InventoryMovementId", value: movementId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async generateShipmentNumber(transaction: sql.Transaction, context: SalesShipmentContextInput) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS Total
        FROM sales.SalesShipments WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    return `DSP-${String(Number(rows[0]?.Total ?? 1)).padStart(6, "0")}`;
  }

  private async generateMovementNumber(transaction: sql.Transaction, context: SalesShipmentContextInput) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS Total
        FROM inventory.InventoryMovements WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND MovementType = 'SALES_SHIPMENT';
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
    return `MOV-SHP-${String(Number(rows[0]?.Total ?? 1)).padStart(6, "0")}`;
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

  private mapShipment(row: ShipmentRow, lines: SalesShipmentLineResult[]): SalesShipmentResult {
    return {
      id: row.SalesShipmentId,
      shipmentNumber: row.ShipmentNumber,
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      shipmentDate: row.ShipmentDate,
      status: row.Status,
      warehouseId: row.WarehouseId ?? undefined,
      warehouseCode: row.WarehouseCode ?? undefined,
      warehouseName: row.WarehouseName ?? undefined,
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      inventoryMovementId: row.InventoryMovementId ?? undefined,
      movementNumber: row.MovementNumber ?? undefined,
      postedAt: row.PostedAt ?? undefined,
      lineCount: Number(row.LineCount),
      totalQuantity: Number(row.TotalQuantity),
      lines
    };
  }

  private mapLine(row: ShipmentLineRow): SalesShipmentLineResult {
    return {
      id: row.SalesShipmentLineId,
      salesShipmentId: row.SalesShipmentId,
      salesOrderLineId: row.SalesOrderLineId,
      inventoryReservationId: row.InventoryReservationId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId,
      warehouseCode: row.WarehouseCode,
      warehouseName: row.WarehouseName,
      unitOfMeasureId: row.UnitOfMeasureId,
      unitOfMeasureCode: row.UnitOfMeasureCode,
      quantity: Number(row.Quantity),
      notes: row.Notes ?? undefined
    };
  }
}

export const salesShipmentRepository = new SalesShipmentRepository();
