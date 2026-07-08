import { randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type { InventoryAdjustmentCreatePayload } from "../validators/inventory-adjustment.validators.js";

export type InventoryAdjustmentInput = InventoryAdjustmentCreatePayload & {
  tenantId: string;
  companyId: string;
  createdBy?: string;
};

export type InventoryAdjustmentResult = {
  id: string;
  movementNumber: string;
  movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  status: "DRAFT";
  movementDate: Date;
  lineCount: number;
  totalQuantity: number;
  totalCost: number;
};

type MovementNumberRow = {
  MovementNumber: string;
};

type EntityExistsRow = {
  EntityId: string;
};

type CreatedMovementRow = {
  InventoryMovementId: string;
  MovementNumber: string;
  MovementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  Status: "DRAFT";
  MovementDate: Date;
  LineCount: number;
  TotalQuantity: number;
  TotalCost: number;
};

export class InventoryAdjustmentRepository extends BaseSqlRepository {
  createAdjustment(input: InventoryAdjustmentInput): Promise<InventoryAdjustmentResult> {
    return this.executeInTransaction(async (transaction) => {
      await this.validateLines(transaction, input);

      const movementId = randomUUID();
      const movementNumber = await this.generateMovementNumber(transaction, input);
      const movementDate = input.movementDate ? new Date(input.movementDate) : new Date();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO inventory.InventoryMovements (
            InventoryMovementId,
            TenantId,
            CompanyId,
            MovementNumber,
            MovementType,
            MovementDate,
            Status,
            SourceModule,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @MovementId,
            @TenantId,
            @CompanyId,
            @MovementNumber,
            @MovementType,
            @MovementDate,
            'DRAFT',
            'INVENTORY_ADJUSTMENT',
            @Reference,
            @Notes,
            1,
            @CreatedBy
          );
        `,
        [
          { name: "MovementId", value: movementId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "MovementNumber", value: movementNumber },
          { name: "MovementType", value: input.movementType },
          { name: "MovementDate", value: movementDate },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "CreatedBy", value: input.createdBy ?? null }
        ]
      );

      for (const [index, line] of input.lines.entries()) {
        await this.queryInTransaction(
          transaction,
          `
            INSERT INTO inventory.InventoryMovementLines (
              InventoryMovementLineId,
              InventoryMovementId,
              TenantId,
              CompanyId,
              LineNumber,
              ItemId,
              WarehouseId,
              UnitOfMeasureId,
              Quantity,
              UnitCost,
              Notes,
              CreatedBy
            )
            VALUES (
              @LineId,
              @MovementId,
              @TenantId,
              @CompanyId,
              @LineNumber,
              @ItemId,
              @WarehouseId,
              @UnitOfMeasureId,
              @Quantity,
              @UnitCost,
              @Notes,
              @CreatedBy
            );
          `,
          [
            { name: "LineId", value: randomUUID() },
            { name: "MovementId", value: movementId },
            { name: "TenantId", value: input.tenantId },
            { name: "CompanyId", value: input.companyId },
            { name: "LineNumber", value: index + 1 },
            { name: "ItemId", value: line.itemId },
            { name: "WarehouseId", value: line.warehouseId },
            { name: "UnitOfMeasureId", value: line.unitOfMeasureId ?? null },
            { name: "Quantity", value: line.quantity },
            { name: "UnitCost", value: line.unitCost ?? 0 },
            { name: "Notes", value: line.notes ?? null },
            { name: "CreatedBy", value: input.createdBy ?? null }
          ]
        );
      }

      const rows = await this.queryInTransaction<CreatedMovementRow>(
        transaction,
        `
          SELECT
            movement.InventoryMovementId,
            movement.MovementNumber,
            movement.MovementType,
            movement.Status,
            movement.MovementDate,
            COUNT(line.InventoryMovementLineId) AS LineCount,
            COALESCE(SUM(line.Quantity), 0) AS TotalQuantity,
            COALESCE(SUM(line.TotalCost), 0) AS TotalCost
          FROM inventory.InventoryMovements movement
          INNER JOIN inventory.InventoryMovementLines line
            ON line.InventoryMovementId = movement.InventoryMovementId
          WHERE movement.InventoryMovementId = @MovementId
          GROUP BY
            movement.InventoryMovementId,
            movement.MovementNumber,
            movement.MovementType,
            movement.Status,
            movement.MovementDate;
        `,
        [{ name: "MovementId", value: movementId }]
      );

      const created = rows[0];

      if (!created) {
        throw new AppError({
          statusCode: 500,
          code: "INVENTORY_ADJUSTMENT_CREATE_FAILED",
          message: "Inventory adjustment could not be created.",
          isOperational: true
        });
      }

      return {
        id: created.InventoryMovementId,
        movementNumber: created.MovementNumber,
        movementType: created.MovementType,
        status: created.Status,
        movementDate: created.MovementDate,
        lineCount: Number(created.LineCount),
        totalQuantity: Number(created.TotalQuantity),
        totalCost: Number(created.TotalCost)
      };
    });
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

  private async validateLines(transaction: sql.Transaction, input: InventoryAdjustmentInput) {
    for (const [index, line] of input.lines.entries()) {
      const lineNumber = index + 1;
      await this.ensureItemExists(transaction, input, line.itemId, lineNumber);
      await this.ensureWarehouseExists(transaction, input, line.warehouseId, lineNumber);

      if (line.unitOfMeasureId) {
        await this.ensureUnitOfMeasureExists(transaction, input, line.unitOfMeasureId, lineNumber);
      }
    }
  }

  private async ensureItemExists(
    transaction: sql.Transaction,
    input: InventoryAdjustmentInput,
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
        code: "INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND",
        message: `Inventory item does not exist for adjustment line ${lineNumber}.`,
        isOperational: true
      });
    }
  }

  private async ensureWarehouseExists(
    transaction: sql.Transaction,
    input: InventoryAdjustmentInput,
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
        code: "INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND",
        message: `Inventory warehouse does not exist for adjustment line ${lineNumber}.`,
        isOperational: true
      });
    }
  }

  private async ensureUnitOfMeasureExists(
    transaction: sql.Transaction,
    input: InventoryAdjustmentInput,
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
        code: "INVENTORY_ADJUSTMENT_UNIT_NOT_FOUND",
        message: `Unit of measure does not exist for adjustment line ${lineNumber}.`,
        isOperational: true
      });
    }
  }

  private async generateMovementNumber(transaction: sql.Transaction, input: InventoryAdjustmentInput) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const movementNumber = this.buildMovementNumber();
      const rows = await this.queryInTransaction<MovementNumberRow>(
        transaction,
        `
          SELECT MovementNumber
          FROM inventory.InventoryMovements WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND MovementNumber = @MovementNumber;
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "MovementNumber", value: movementNumber }
        ]
      );

      if (!rows[0]) {
        return movementNumber;
      }
    }

    throw new AppError({
      statusCode: 409,
      code: "INVENTORY_ADJUSTMENT_NUMBER_COLLISION",
      message: "Could not generate a unique inventory adjustment number.",
      isOperational: true
    });
  }

  private buildMovementNumber() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();

    return `AJU-${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}-${suffix}`;
  }
}

export const inventoryAdjustmentRepository = new InventoryAdjustmentRepository();
