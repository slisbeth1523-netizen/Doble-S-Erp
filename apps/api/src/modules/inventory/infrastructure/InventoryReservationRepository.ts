import { createHash, randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  InventoryAvailabilityListQuery,
  InventoryReservationCreatePayload,
  InventoryReservationListQuery,
  InventoryReservationReleasePayload
} from "../validators/inventory-reservation.validators.js";

export type InventoryReservationContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type InventoryReservationContext = InventoryReservationContextInput & {
  requestId?: string;
  correlationId?: string;
};

export type InventoryReservationStatus = "ACTIVE" | "PARTIALLY_RELEASED" | "RELEASED" | "CONSUMED" | "CANCELLED";

export type InventoryReservationResult = {
  id: string;
  salesOrderId: string;
  orderNumber: string;
  salesOrderLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  reservedQuantity: number;
  releasedQuantity: number;
  consumedQuantity: number;
  activeQuantity: number;
  status: InventoryReservationStatus;
  reference?: string;
  notes?: string;
  reservedAt: Date;
  releasedAt?: Date;
};

export type ItemAvailabilityResult = {
  tenantId: string;
  companyId: string;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

export type SalesOrderReservationLineResult = {
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
  releasedQuantity: number;
  consumedQuantity: number;
  pendingReservationQuantity: number;
  onHandQuantity: number;
  availableQuantity: number;
};

export type PagedResult<TRecord> = {
  records: TRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
  };
};

type ReservationRow = {
  InventoryReservationId: string;
  SalesOrderId: string;
  OrderNumber: string;
  SalesOrderLineId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  ReservedQuantity: number;
  ReleasedQuantity: number;
  ConsumedQuantity: number;
  ActiveQuantity: number;
  Status: InventoryReservationStatus;
  Reference: string | null;
  Notes: string | null;
  ReservedAt: Date;
  ReleasedAt: Date | null;
};

type AvailabilityRow = {
  TenantId: string;
  CompanyId: string;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  OnHandQuantity: number;
  ReservedQuantity: number;
  AvailableQuantity: number;
};

type OrderReservationRow = {
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
  ReleasedQuantity: number;
  ConsumedQuantity: number;
  PendingReservationQuantity: number;
  OnHandQuantity: number | null;
  AvailableQuantity: number | null;
};

type CountRow = { TotalItems: number };

type LockedLineRow = {
  SalesOrderId: string;
  SalesOrderLineId: string;
  OrderNumber: string;
  OrderStatus: string;
  ItemId: string;
  WarehouseId: string | null;
  Quantity: number;
  ItemIsActive: boolean;
  WarehouseIsActive: boolean | null;
};

type StockRow = {
  QuantityOnHand: number;
  AvailableQuantity: number;
};

type ExistingReservationRow = {
  InventoryReservationId: string;
  ReservedQuantity: number;
  ReleasedQuantity: number;
  ConsumedQuantity: number;
  ActiveQuantity: number;
  Status: InventoryReservationStatus;
  Reference: string | null;
};

type InventoryReservationOperationType = "RESERVE" | "RELEASE";

type ReservationOperationRow = {
  InventoryReservationId: string | null;
  RequestHash: string;
  ResultingReservedQuantity: number;
  ResultingReleasedQuantity: number;
  ResultingActiveQuantity: number;
  ResultingStatus: InventoryReservationStatus;
};

type ReservationOperationResult = {
  reservationId: string;
  replayed: boolean;
  snapshot?: {
    reservedQuantity: number;
    releasedQuantity: number;
    activeQuantity: number;
    status: InventoryReservationStatus;
  };
};

export class InventoryReservationRepository extends BaseSqlRepository {
  async reserveSalesOrderLine(
    context: InventoryReservationContextInput,
    salesOrderId: string,
    salesOrderLineId: string,
    payload: InventoryReservationCreatePayload
  ) {
    const operationHash = this.hashPayload({
      operationType: "RESERVE",
      salesOrderId,
      salesOrderLineId,
      quantity: payload.quantity,
      reference: payload.reference ?? null,
      notes: payload.notes ?? null
    });

    const operationResult = await this.executeInTransaction<ReservationOperationResult>(async (transaction) => {
      const replayed = await this.lockReservationOperation(
        transaction,
        context,
        "RESERVE",
        payload.idempotencyKey,
        operationHash
      );
      if (replayed) {
        if (!replayed.InventoryReservationId) {
          throw this.conflict("INVENTORY_RESERVATION_IDEMPOTENCY_INCOMPLETE", "La operacion idempotente no tiene resultado asociado.");
        }
        return this.replayedOperation(replayed.InventoryReservationId, replayed);
      }

      const line = await this.lockSalesOrderLine(transaction, context, salesOrderId, salesOrderLineId);
      this.validateReservableLine(line);

      await this.lockStock(transaction, context, line.ItemId, line.WarehouseId!);
      await this.lockItemWarehouseReservations(transaction, context, line.ItemId, line.WarehouseId!);

      const existing = await this.lockLineReservation(transaction, context, salesOrderLineId, line.ItemId, line.WarehouseId!);

      const currentActive = existing ? Number(existing.ActiveQuantity) : 0;
      const currentConsumed = existing ? Number(existing.ConsumedQuantity) : 0;
      const pendingQuantity = Number(line.Quantity) - currentActive - currentConsumed;
      if (payload.quantity > pendingQuantity + 0.0001) {
        throw this.conflict("INVENTORY_RESERVATION_EXCEEDS_LINE", "La cantidad excede el pendiente por reservar de la linea.");
      }

      const availability = await this.getLockedAvailability(transaction, context, line.ItemId, line.WarehouseId!);
      if (payload.quantity > Number(availability.AvailableQuantity) + 0.0001) {
        throw this.conflict("INVENTORY_RESERVATION_NOT_AVAILABLE", "La cantidad excede la disponibilidad comercial.");
      }

      if (existing) {
        await this.queryInTransaction(
          transaction,
          `
            UPDATE inventory.InventoryReservations
            SET ReservedQuantity = ReservedQuantity + @Quantity,
                Status = CASE WHEN ReleasedQuantity > 0 THEN 'PARTIALLY_RELEASED' ELSE 'ACTIVE' END,
                Reference = COALESCE(@Reference, Reference),
                Notes = COALESCE(@Notes, Notes),
                UpdatedAt = SYSUTCDATETIME(),
                UpdatedBy = @UserId
            WHERE InventoryReservationId = @ReservationId
              AND TenantId = @TenantId
              AND CompanyId = @CompanyId;
          `,
          [
            { name: "ReservationId", value: existing.InventoryReservationId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "Quantity", value: payload.quantity },
            { name: "Reference", value: payload.reference ?? null },
            { name: "Notes", value: payload.notes ?? null },
            { name: "UserId", value: context.userId ?? null }
          ]
        );

        const updated = await this.lockReservation(transaction, context, existing.InventoryReservationId);
        await this.insertReservationOperation(transaction, context, {
          operationType: "RESERVE",
          idempotencyKey: payload.idempotencyKey,
          requestHash: operationHash,
          requestQuantity: payload.quantity,
          inventoryReservationId: existing.InventoryReservationId,
          salesOrderId,
          salesOrderLineId,
          resultingReservedQuantity: Number(updated.ReservedQuantity),
          resultingReleasedQuantity: Number(updated.ReleasedQuantity),
          resultingActiveQuantity: Number(updated.ActiveQuantity),
          resultingStatus: updated.Status
        });
        return { reservationId: existing.InventoryReservationId, replayed: false };
      }

      const inventoryReservationId = randomUUID();
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO inventory.InventoryReservations (
            InventoryReservationId,
            TenantId,
            CompanyId,
            SalesOrderId,
            SalesOrderLineId,
            ItemId,
            WarehouseId,
            ReservedQuantity,
            Status,
            Reference,
            Notes,
            ReservedAt,
            ReservedBy,
            IsActive,
            CreatedBy
          )
          VALUES (
            @ReservationId,
            @TenantId,
            @CompanyId,
            @SalesOrderId,
            @SalesOrderLineId,
            @ItemId,
            @WarehouseId,
            @Quantity,
            'ACTIVE',
            @Reference,
            @Notes,
            SYSUTCDATETIME(),
            @UserId,
            1,
            @UserId
          );
        `,
        [
          { name: "ReservationId", value: inventoryReservationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "SalesOrderId", value: salesOrderId },
          { name: "SalesOrderLineId", value: salesOrderLineId },
          { name: "ItemId", value: line.ItemId },
          { name: "WarehouseId", value: line.WarehouseId },
          { name: "Quantity", value: payload.quantity },
          { name: "Reference", value: payload.reference ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      const created = await this.lockReservation(transaction, context, inventoryReservationId);
      await this.insertReservationOperation(transaction, context, {
        operationType: "RESERVE",
        idempotencyKey: payload.idempotencyKey,
        requestHash: operationHash,
        requestQuantity: payload.quantity,
        inventoryReservationId,
        salesOrderId,
        salesOrderLineId,
        resultingReservedQuantity: Number(created.ReservedQuantity),
        resultingReleasedQuantity: Number(created.ReleasedQuantity),
        resultingActiveQuantity: Number(created.ActiveQuantity),
        resultingStatus: created.Status
      });

      return { reservationId: inventoryReservationId, replayed: false };
    });

    const reservation = await this.getReservation(context, operationResult.reservationId);
    return this.applyOperationSnapshot(reservation, operationResult);
  }

  async releaseReservation(
    context: InventoryReservationContextInput,
    inventoryReservationId: string,
    payload: InventoryReservationReleasePayload
  ) {
    const operationHash = this.hashPayload({
      operationType: "RELEASE",
      inventoryReservationId,
      quantity: payload.quantity,
      reason: payload.reason ?? null
    });

    const operationResult = await this.executeInTransaction<ReservationOperationResult>(async (transaction) => {
      const replayed = await this.lockReservationOperation(
        transaction,
        context,
        "RELEASE",
        payload.idempotencyKey,
        operationHash
      );
      if (replayed) {
        if (!replayed.InventoryReservationId) {
          throw this.conflict("INVENTORY_RESERVATION_IDEMPOTENCY_INCOMPLETE", "La operacion idempotente no tiene resultado asociado.");
        }
        return this.replayedOperation(replayed.InventoryReservationId, replayed);
      }

      const current = await this.lockReservation(transaction, context, inventoryReservationId);
      const activeQuantity = Number(current.ActiveQuantity);
      if (activeQuantity <= 0) {
        throw this.conflict("INVENTORY_RESERVATION_ALREADY_RELEASED", "La reserva no tiene cantidad activa para liberar.");
      }

      if (payload.quantity > activeQuantity + 0.0001) {
        throw this.conflict("INVENTORY_RESERVATION_RELEASE_EXCEEDS_ACTIVE", "La cantidad a liberar excede la cantidad activa.");
      }

      const nextActive = activeQuantity - payload.quantity;
      const nextStatus = nextActive > 0.0001 ? "PARTIALLY_RELEASED" : "RELEASED";

      await this.queryInTransaction(
        transaction,
        `
          UPDATE inventory.InventoryReservations
          SET ReleasedQuantity = ReleasedQuantity + @Quantity,
              Status = @Status,
              ReleasedAt = CASE WHEN @Status = 'RELEASED' THEN SYSUTCDATETIME() ELSE ReleasedAt END,
              ReleasedBy = CASE WHEN @Status = 'RELEASED' THEN @UserId ELSE ReleasedBy END,
              Notes = COALESCE(@Reason, Notes),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE InventoryReservationId = @ReservationId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "ReservationId", value: inventoryReservationId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "Quantity", value: payload.quantity },
          { name: "Status", value: nextStatus },
          { name: "Reason", value: payload.reason ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      const updated = await this.lockReservation(transaction, context, inventoryReservationId);
      await this.insertReservationOperation(transaction, context, {
        operationType: "RELEASE",
        idempotencyKey: payload.idempotencyKey,
        requestHash: operationHash,
        requestQuantity: payload.quantity,
        inventoryReservationId,
        salesOrderId: null,
        salesOrderLineId: null,
        resultingReservedQuantity: Number(updated.ReservedQuantity),
        resultingReleasedQuantity: Number(updated.ReleasedQuantity),
        resultingActiveQuantity: Number(updated.ActiveQuantity),
        resultingStatus: updated.Status
      });

      return { reservationId: inventoryReservationId, replayed: false };
    });

    const reservation = await this.getReservation(context, operationResult.reservationId);
    return this.applyOperationSnapshot(reservation, operationResult);
  }

  async getReservation(context: InventoryReservationContextInput, inventoryReservationId: string) {
    const rows = await this.query<ReservationRow>(
      `
        SELECT *
        FROM inventory.V_InventoryReservationSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND InventoryReservationId = @ReservationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ReservationId", value: inventoryReservationId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Inventory reservation not found.", { inventoryReservationId }, "INVENTORY_RESERVATION_NOT_FOUND");
    }

    return this.mapReservation(row);
  }

  async listReservations(context: InventoryReservationContextInput, query: InventoryReservationListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "OrderId", value: query.orderId ?? null },
      { name: "OrderLineId", value: query.orderLineId ?? null },
      { name: "ItemId", value: query.itemId ?? null },
      { name: "WarehouseId", value: query.warehouseId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "Search", value: search }
    ];
    const whereClause = this.reservationWhereClause();
    const [records, counts] = await Promise.all([
      this.query<ReservationRow>(
        `
          SELECT *
          FROM inventory.V_InventoryReservationSummary
          WHERE ${whereClause}
          ORDER BY ReservedAt DESC, OrderNumber DESC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        [...parameters, { name: "Offset", value: offset }, { name: "PageSize", value: pageSize }]
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM inventory.V_InventoryReservationSummary
          WHERE ${whereClause};
        `,
        parameters
      )
    ]);

    return {
      records: records.map((row) => this.mapReservation(row)),
      pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) }
    } satisfies PagedResult<InventoryReservationResult>;
  }

  async listAvailability(context: InventoryReservationContextInput, query: InventoryAvailabilityListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "ItemId", value: query.itemId ?? null },
      { name: "WarehouseId", value: query.warehouseId ?? null },
      { name: "Search", value: search }
    ];
    const whereClause = `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@ItemId IS NULL OR ItemId = @ItemId)
      AND (@WarehouseId IS NULL OR WarehouseId = @WarehouseId)
      AND (
        @Search IS NULL
        OR ItemCode LIKE @Search
        OR ItemDescription LIKE @Search
        OR WarehouseCode LIKE @Search
        OR WarehouseName LIKE @Search
      )
    `;
    const [records, counts] = await Promise.all([
      this.query<AvailabilityRow>(
        `
          SELECT *
          FROM inventory.V_ItemAvailability
          WHERE ${whereClause}
          ORDER BY ItemCode ASC, WarehouseCode ASC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        [...parameters, { name: "Offset", value: offset }, { name: "PageSize", value: pageSize }]
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM inventory.V_ItemAvailability
          WHERE ${whereClause};
        `,
        parameters
      )
    ]);

    return {
      records: records.map((row) => this.mapAvailability(row)),
      pagination: { page, pageSize, totalItems: Number(counts[0]?.TotalItems ?? 0) }
    } satisfies PagedResult<ItemAvailabilityResult>;
  }

  async getAvailabilityByItem(context: InventoryReservationContextInput, itemId: string) {
    const result = await this.listAvailability(context, { itemId, page: 1, pageSize: 100 });
    if (result.records.length === 0) {
      throw new NotFoundError("Item availability not found.", { itemId }, "ITEM_AVAILABILITY_NOT_FOUND");
    }
    return result.records;
  }

  async getSalesOrderReservations(context: InventoryReservationContextInput, salesOrderId: string) {
    const rows = await this.query<OrderReservationRow>(
      `
        SELECT *
        FROM inventory.V_SalesOrderReservationSummary
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

    return rows.map((row) => this.mapOrderReservation(row));
  }

  private reservationWhereClause() {
    return `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@OrderId IS NULL OR SalesOrderId = @OrderId)
      AND (@OrderLineId IS NULL OR SalesOrderLineId = @OrderLineId)
      AND (@ItemId IS NULL OR ItemId = @ItemId)
      AND (@WarehouseId IS NULL OR WarehouseId = @WarehouseId)
      AND (@Status IS NULL OR Status = @Status)
      AND (
        @Search IS NULL
        OR OrderNumber LIKE @Search
        OR ItemCode LIKE @Search
        OR ItemDescription LIKE @Search
        OR WarehouseCode LIKE @Search
        OR Reference LIKE @Search
      )
    `;
  }

  private async lockSalesOrderLine(
    transaction: sql.Transaction,
    context: InventoryReservationContextInput,
    salesOrderId: string,
    salesOrderLineId: string
  ) {
    const rows = await this.queryInTransaction<LockedLineRow>(
      transaction,
      `
        SELECT
          salesOrder.SalesOrderId,
          salesLine.SalesOrderLineId,
          salesOrder.OrderNumber,
          salesOrder.Status AS OrderStatus,
          salesLine.ItemId,
          salesLine.WarehouseId,
          salesLine.Quantity,
          item.IsActive AS ItemIsActive,
          warehouse.IsActive AS WarehouseIsActive
        FROM sales.SalesOrders salesOrder WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        INNER JOIN sales.SalesOrderLines salesLine WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
          ON salesLine.SalesOrderId = salesOrder.SalesOrderId
         AND salesLine.TenantId = salesOrder.TenantId
         AND salesLine.CompanyId = salesOrder.CompanyId
        INNER JOIN inventory.Items item WITH (UPDLOCK, HOLDLOCK)
          ON item.ItemId = salesLine.ItemId
         AND item.TenantId = salesLine.TenantId
         AND item.CompanyId = salesLine.CompanyId
        LEFT JOIN inventory.Warehouses warehouse WITH (UPDLOCK, HOLDLOCK)
          ON warehouse.WarehouseId = salesLine.WarehouseId
         AND warehouse.TenantId = salesLine.TenantId
         AND warehouse.CompanyId = salesLine.CompanyId
        WHERE salesOrder.TenantId = @TenantId
          AND salesOrder.CompanyId = @CompanyId
          AND salesOrder.SalesOrderId = @SalesOrderId
          AND salesLine.SalesOrderLineId = @SalesOrderLineId;
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
      throw new NotFoundError("Sales order line not found.", { salesOrderId, salesOrderLineId }, "SALES_ORDER_LINE_NOT_FOUND");
    }
    return row;
  }

  private validateReservableLine(line: LockedLineRow) {
    if (line.OrderStatus !== "APPROVED") {
      throw this.conflict("INVENTORY_RESERVATION_ORDER_NOT_APPROVED", "Solo se pueden reservar pedidos aprobados.");
    }
    if (!line.WarehouseId) {
      throw this.conflict("INVENTORY_RESERVATION_WAREHOUSE_REQUIRED", "La linea debe tener almacen para reservar.");
    }
    if (!line.ItemIsActive) {
      throw this.conflict("INVENTORY_RESERVATION_ITEM_INACTIVE", "El articulo de la linea no esta activo.");
    }
    if (!line.WarehouseIsActive) {
      throw this.conflict("INVENTORY_RESERVATION_WAREHOUSE_INACTIVE", "El almacen de la linea no esta activo.");
    }
  }

  private async lockStock(transaction: sql.Transaction, context: InventoryReservationContextInput, itemId: string, warehouseId: string) {
    const rows = await this.queryInTransaction<StockRow>(
      transaction,
      `
        SELECT QuantityOnHand, QuantityAvailable
        FROM inventory.ItemStocks WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ItemId", value: itemId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );
    if (!rows[0]) {
      throw this.conflict("INVENTORY_RESERVATION_STOCK_REQUIRED", "No existe existencia para el articulo y almacen.");
    }
    return rows[0];
  }

  private async lockItemWarehouseReservations(transaction: sql.Transaction, context: InventoryReservationContextInput, itemId: string, warehouseId: string) {
    await this.queryInTransaction(
      transaction,
      `
        SELECT InventoryReservationId
        FROM inventory.InventoryReservations WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId
          AND Status IN ('ACTIVE', 'PARTIALLY_RELEASED')
          AND ActiveQuantity > 0;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ItemId", value: itemId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );
  }

  private async lockLineReservation(
    transaction: sql.Transaction,
    context: InventoryReservationContextInput,
    salesOrderLineId: string,
    itemId: string,
    warehouseId: string
  ) {
    const rows = await this.queryInTransaction<ExistingReservationRow>(
      transaction,
      `
        SELECT
          InventoryReservationId,
          ReservedQuantity,
          ReleasedQuantity,
          ConsumedQuantity,
          ActiveQuantity,
          Status,
          Reference
        FROM inventory.InventoryReservations WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SalesOrderLineId = @SalesOrderLineId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SalesOrderLineId", value: salesOrderLineId },
        { name: "ItemId", value: itemId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );
    return rows[0];
  }

  private async lockReservation(transaction: sql.Transaction, context: InventoryReservationContextInput, inventoryReservationId: string) {
    const rows = await this.queryInTransaction<ExistingReservationRow>(
      transaction,
      `
        SELECT
          InventoryReservationId,
          ReservedQuantity,
          ReleasedQuantity,
          ConsumedQuantity,
          ActiveQuantity,
          Status,
          Reference
        FROM inventory.InventoryReservations WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND InventoryReservationId = @ReservationId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ReservationId", value: inventoryReservationId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Inventory reservation not found.", { inventoryReservationId }, "INVENTORY_RESERVATION_NOT_FOUND");
    }
    return row;
  }

  private async getLockedAvailability(transaction: sql.Transaction, context: InventoryReservationContextInput, itemId: string, warehouseId: string) {
    const rows = await this.queryInTransaction<Pick<AvailabilityRow, "AvailableQuantity">>(
      transaction,
      `
        SELECT AvailableQuantity
        FROM inventory.V_ItemAvailability
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ItemId", value: itemId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );
    const row = rows[0];
    if (!row) {
      throw this.conflict("ITEM_AVAILABILITY_NOT_FOUND", "No existe disponibilidad para el articulo y almacen.");
    }
    return row;
  }

  private async lockReservationOperation(
    transaction: sql.Transaction,
    context: InventoryReservationContextInput,
    operationType: InventoryReservationOperationType,
    idempotencyKey: string,
    requestHash: string
  ) {
    const rows = await this.queryInTransaction<ReservationOperationRow>(
      transaction,
      `
        SELECT
          InventoryReservationId,
          RequestHash,
          ResultingReservedQuantity,
          ResultingReleasedQuantity,
          ResultingActiveQuantity,
          ResultingStatus
        FROM inventory.InventoryReservationOperations WITH (UPDLOCK, HOLDLOCK)
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

    const row = rows[0];
    if (row && row.RequestHash !== requestHash) {
      throw this.conflict("INVENTORY_RESERVATION_IDEMPOTENCY_CONFLICT", "La clave idempotente ya fue usada con un payload diferente.");
    }

    return row;
  }

  private async insertReservationOperation(
    transaction: sql.Transaction,
    context: InventoryReservationContextInput,
    input: {
      operationType: InventoryReservationOperationType;
      idempotencyKey: string;
      requestHash: string;
      requestQuantity: number;
      inventoryReservationId: string;
      salesOrderId: string | null;
      salesOrderLineId: string | null;
      resultingReservedQuantity: number;
      resultingReleasedQuantity: number;
      resultingActiveQuantity: number;
      resultingStatus: InventoryReservationStatus;
    }
  ) {
    await this.queryInTransaction(
      transaction,
      `
        INSERT INTO inventory.InventoryReservationOperations (
          InventoryReservationOperationId,
          TenantId,
          CompanyId,
          InventoryReservationId,
          SalesOrderId,
          SalesOrderLineId,
          OperationType,
          IdempotencyKey,
          RequestQuantity,
          RequestHash,
          ResultingReservedQuantity,
          ResultingReleasedQuantity,
          ResultingActiveQuantity,
          ResultingStatus,
          CreatedBy
        )
        VALUES (
          @OperationId,
          @TenantId,
          @CompanyId,
          @ReservationId,
          @SalesOrderId,
          @SalesOrderLineId,
          @OperationType,
          @IdempotencyKey,
          @RequestQuantity,
          @RequestHash,
          @ResultingReservedQuantity,
          @ResultingReleasedQuantity,
          @ResultingActiveQuantity,
          @ResultingStatus,
          @UserId
        );
      `,
      [
        { name: "OperationId", value: randomUUID() },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "ReservationId", value: input.inventoryReservationId },
        { name: "SalesOrderId", value: input.salesOrderId },
        { name: "SalesOrderLineId", value: input.salesOrderLineId },
        { name: "OperationType", value: input.operationType },
        { name: "IdempotencyKey", value: input.idempotencyKey },
        { name: "RequestQuantity", value: input.requestQuantity },
        { name: "RequestHash", value: input.requestHash },
        { name: "ResultingReservedQuantity", value: input.resultingReservedQuantity },
        { name: "ResultingReleasedQuantity", value: input.resultingReleasedQuantity },
        { name: "ResultingActiveQuantity", value: input.resultingActiveQuantity },
        { name: "ResultingStatus", value: input.resultingStatus },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private hashPayload(payload: Record<string, unknown>) {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private replayedOperation(reservationId: string, row: ReservationOperationRow): ReservationOperationResult {
    return {
      reservationId,
      replayed: true,
      snapshot: {
        reservedQuantity: Number(row.ResultingReservedQuantity),
        releasedQuantity: Number(row.ResultingReleasedQuantity),
        activeQuantity: Number(row.ResultingActiveQuantity),
        status: row.ResultingStatus
      }
    };
  }

  private applyOperationSnapshot(
    reservation: InventoryReservationResult,
    operationResult: ReservationOperationResult
  ): InventoryReservationResult & { idempotencyReplayed?: boolean } {
    if (!operationResult.snapshot) {
      return { ...reservation, idempotencyReplayed: operationResult.replayed || undefined };
    }

    return {
      ...reservation,
      reservedQuantity: operationResult.snapshot.reservedQuantity,
      releasedQuantity: operationResult.snapshot.releasedQuantity,
      activeQuantity: operationResult.snapshot.activeQuantity,
      status: operationResult.snapshot.status,
      idempotencyReplayed: operationResult.replayed || undefined
    };
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

  private conflict(code: string, message: string) {
    return new AppError({ statusCode: 409, code, message, isOperational: true });
  }

  private mapReservation(row: ReservationRow): InventoryReservationResult {
    return {
      id: row.InventoryReservationId,
      salesOrderId: row.SalesOrderId,
      orderNumber: row.OrderNumber,
      salesOrderLineId: row.SalesOrderLineId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId,
      warehouseCode: row.WarehouseCode,
      warehouseName: row.WarehouseName,
      reservedQuantity: Number(row.ReservedQuantity),
      releasedQuantity: Number(row.ReleasedQuantity),
      consumedQuantity: Number(row.ConsumedQuantity),
      activeQuantity: Number(row.ActiveQuantity),
      status: row.Status,
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      reservedAt: row.ReservedAt,
      releasedAt: row.ReleasedAt ?? undefined
    };
  }

  private mapAvailability(row: AvailabilityRow): ItemAvailabilityResult {
    return {
      tenantId: row.TenantId,
      companyId: row.CompanyId,
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId,
      warehouseCode: row.WarehouseCode,
      warehouseName: row.WarehouseName,
      onHandQuantity: Number(row.OnHandQuantity),
      reservedQuantity: Number(row.ReservedQuantity),
      availableQuantity: Number(row.AvailableQuantity)
    };
  }

  private mapOrderReservation(row: OrderReservationRow): SalesOrderReservationLineResult {
    return {
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
      releasedQuantity: Number(row.ReleasedQuantity),
      consumedQuantity: Number(row.ConsumedQuantity),
      pendingReservationQuantity: Number(row.PendingReservationQuantity),
      onHandQuantity: Number(row.OnHandQuantity ?? 0),
      availableQuantity: Number(row.AvailableQuantity ?? 0)
    };
  }
}

export const inventoryReservationRepository = new InventoryReservationRepository();
