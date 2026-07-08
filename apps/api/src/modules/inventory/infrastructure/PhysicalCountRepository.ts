import { randomUUID } from "node:crypto";

import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  PhysicalCountCreatePayload,
  PhysicalCountLineCreatePayload
} from "../validators/physical-count.validators.js";

export type PhysicalCountContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type PhysicalCountCreateInput = PhysicalCountContextInput & PhysicalCountCreatePayload;
export type PhysicalCountLineCreateInput = PhysicalCountContextInput & PhysicalCountLineCreatePayload & {
  physicalCountId: string;
};

export type PhysicalCountResult = {
  id: string;
  countNumber: string;
  warehouseId: string;
  status: "DRAFT" | "COMPLETED" | "ADJUSTMENT_CREATED";
  countDate: Date;
  completedAt?: Date;
  adjustmentMovementId?: string;
  lineCount: number;
  totalSnapshotQuantity: number;
  totalCountedQuantity: number;
  totalDifferenceQuantity: number;
};

export type PhysicalCountLineResult = {
  id: string;
  physicalCountId: string;
  lineNumber: number;
  itemId: string;
  warehouseId: string;
  unitOfMeasureId?: string;
  snapshotQuantity: number;
  countedQuantity: number;
  differenceQuantity: number;
  unitCost: number;
};

export type PhysicalCountAdjustmentLine = {
  itemId: string;
  warehouseId: string;
  unitOfMeasureId?: string | null;
  quantity: number;
  unitCost: number;
  notes?: string;
};

export type PhysicalCountAdjustmentPayload = {
  physicalCountId: string;
  countNumber: string;
  movementType: "ADJUSTMENT_IN" | "ADJUSTMENT_OUT";
  reference: string;
  notes: string;
  lines: PhysicalCountAdjustmentLine[];
};

type CountNumberRow = {
  CountNumber: string;
};

type CountHeaderRow = {
  PhysicalCountId: string;
  CountNumber: string;
  WarehouseId: string;
  Status: "DRAFT" | "COMPLETED" | "ADJUSTMENT_CREATED";
  AdjustmentMovementId: string | null;
};

type StockSnapshotRow = {
  ItemId: string;
  UnitOfMeasureId: string | null;
  QuantityOnHand: number | null;
  AverageCost: number | null;
  LastCost: number | null;
  StandardCost: number | null;
};

type NextLineNumberRow = {
  NextLineNumber: number;
};

type SummaryRow = {
  PhysicalCountId: string;
  CountNumber: string;
  WarehouseId: string;
  Status: "DRAFT" | "COMPLETED" | "ADJUSTMENT_CREATED";
  CountDate: Date;
  CompletedAt: Date | null;
  AdjustmentMovementId: string | null;
  LineCount: number;
  TotalSnapshotQuantity: number;
  TotalCountedQuantity: number;
  TotalDifferenceQuantity: number;
};

type LineRow = {
  PhysicalCountLineId: string;
  PhysicalCountId: string;
  LineNumber: number;
  ItemId: string;
  WarehouseId: string;
  UnitOfMeasureId: string | null;
  SnapshotQuantity: number;
  CountedQuantity: number;
  DifferenceQuantity: number;
  UnitCost: number;
};

export class PhysicalCountRepository extends BaseSqlRepository {
  createPhysicalCount(input: PhysicalCountCreateInput): Promise<PhysicalCountResult> {
    return this.executeInTransaction(async (transaction) => {
      await this.ensureWarehouseExists(transaction, input, input.warehouseId);

      const physicalCountId = randomUUID();
      const countNumber = await this.generateCountNumber(transaction, input);
      const countDate = input.countDate ? new Date(input.countDate) : new Date();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO inventory.PhysicalCounts (
            PhysicalCountId,
            TenantId,
            CompanyId,
            CountNumber,
            WarehouseId,
            CountDate,
            Status,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @PhysicalCountId,
            @TenantId,
            @CompanyId,
            @CountNumber,
            @WarehouseId,
            @CountDate,
            'DRAFT',
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "PhysicalCountId", value: physicalCountId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "CountNumber", value: countNumber },
          { name: "WarehouseId", value: input.warehouseId },
          { name: "CountDate", value: countDate },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return this.getPhysicalCountSummary(transaction, input, physicalCountId);
    });
  }

  addPhysicalCountLine(input: PhysicalCountLineCreateInput): Promise<PhysicalCountLineResult> {
    return this.executeInTransaction(async (transaction) => {
      const count = await this.lockPhysicalCount(transaction, input, input.physicalCountId);

      if (count.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "PHYSICAL_COUNT_NOT_DRAFT",
          message: "Only DRAFT physical counts can receive lines.",
          isOperational: true
        });
      }

      const snapshot = await this.getItemSnapshot(transaction, input, input.itemId, count.WarehouseId);
      const nextLine = await this.getNextLineNumber(transaction, input.physicalCountId);
      const unitCost = input.unitCost ?? Number(snapshot.AverageCost ?? snapshot.LastCost ?? snapshot.StandardCost ?? 0);

      const duplicateRows = await this.queryInTransaction<LineRow>(
        transaction,
        `
          SELECT PhysicalCountLineId
          FROM inventory.PhysicalCountLines WITH (UPDLOCK, HOLDLOCK)
          WHERE PhysicalCountId = @PhysicalCountId
            AND ItemId = @ItemId;
        `,
        [
          { name: "PhysicalCountId", value: input.physicalCountId },
          { name: "ItemId", value: input.itemId }
        ]
      );

      if (duplicateRows[0]) {
        throw new AppError({
          statusCode: 409,
          code: "PHYSICAL_COUNT_LINE_DUPLICATED",
          message: "Physical count already includes this item.",
          isOperational: true
        });
      }

      const lineId = randomUUID();
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO inventory.PhysicalCountLines (
            PhysicalCountLineId,
            PhysicalCountId,
            TenantId,
            CompanyId,
            LineNumber,
            ItemId,
            WarehouseId,
            UnitOfMeasureId,
            SnapshotQuantity,
            CountedQuantity,
            UnitCost,
            Notes,
            CreatedBy
          )
          VALUES (
            @LineId,
            @PhysicalCountId,
            @TenantId,
            @CompanyId,
            @LineNumber,
            @ItemId,
            @WarehouseId,
            @UnitOfMeasureId,
            @SnapshotQuantity,
            @CountedQuantity,
            @UnitCost,
            @Notes,
            @UserId
          );
        `,
        [
          { name: "LineId", value: lineId },
          { name: "PhysicalCountId", value: input.physicalCountId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "LineNumber", value: nextLine },
          { name: "ItemId", value: input.itemId },
          { name: "WarehouseId", value: count.WarehouseId },
          { name: "UnitOfMeasureId", value: snapshot.UnitOfMeasureId ?? null },
          { name: "SnapshotQuantity", value: Number(snapshot.QuantityOnHand ?? 0) },
          { name: "CountedQuantity", value: input.countedQuantity },
          { name: "UnitCost", value: unitCost },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return this.getPhysicalCountLine(transaction, input, lineId);
    });
  }

  completePhysicalCount(input: PhysicalCountContextInput & { physicalCountId: string }) {
    return this.executeInTransaction(async (transaction) => {
      const count = await this.lockPhysicalCount(transaction, input, input.physicalCountId);

      if (count.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "PHYSICAL_COUNT_NOT_DRAFT",
          message: "Only DRAFT physical counts can be completed.",
          isOperational: true
        });
      }

      const lineCount = await this.getPhysicalCountLineCount(transaction, input.physicalCountId);

      if (lineCount < 1) {
        throw new AppError({
          statusCode: 400,
          code: "PHYSICAL_COUNT_HAS_NO_LINES",
          message: "Physical count needs at least one line before completion.",
          isOperational: true
        });
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE inventory.PhysicalCounts
          SET Status = 'COMPLETED',
              CompletedAt = SYSUTCDATETIME(),
              CompletedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE PhysicalCountId = @PhysicalCountId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "PhysicalCountId", value: input.physicalCountId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return this.getPhysicalCountSummary(transaction, input, input.physicalCountId);
    });
  }

  getAdjustmentPayload(input: PhysicalCountContextInput & { physicalCountId: string }) {
    return this.executeInTransaction(async (transaction) => {
      const count = await this.lockPhysicalCount(transaction, input, input.physicalCountId);

      if (count.Status !== "COMPLETED") {
        throw new AppError({
          statusCode: 409,
          code: "PHYSICAL_COUNT_NOT_COMPLETED",
          message: "Only COMPLETED physical counts can generate adjustments.",
          isOperational: true
        });
      }

      if (count.AdjustmentMovementId) {
        throw new AppError({
          statusCode: 409,
          code: "PHYSICAL_COUNT_ADJUSTMENT_ALREADY_CREATED",
          message: "Physical count already has an adjustment movement.",
          isOperational: true
        });
      }

      const lines = await this.queryInTransaction<LineRow>(
        transaction,
        `
          SELECT
            PhysicalCountLineId,
            PhysicalCountId,
            LineNumber,
            ItemId,
            WarehouseId,
            UnitOfMeasureId,
            SnapshotQuantity,
            CountedQuantity,
            DifferenceQuantity,
            UnitCost
          FROM inventory.PhysicalCountLines
          WHERE PhysicalCountId = @PhysicalCountId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND DifferenceQuantity <> 0
          ORDER BY LineNumber ASC;
        `,
        [
          { name: "PhysicalCountId", value: input.physicalCountId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId }
        ]
      );

      if (!lines.length) {
        throw new AppError({
          statusCode: 400,
          code: "PHYSICAL_COUNT_HAS_NO_DIFFERENCE",
          message: "Physical count has no differences to adjust.",
          isOperational: true
        });
      }

      const hasPositive = lines.some((line) => Number(line.DifferenceQuantity) > 0);
      const hasNegative = lines.some((line) => Number(line.DifferenceQuantity) < 0);

      if (hasPositive && hasNegative) {
        throw new AppError({
          statusCode: 400,
          code: "PHYSICAL_COUNT_MIXED_DIFFERENCES_NOT_SUPPORTED",
          message: "Mixed physical count differences are not supported in this phase.",
          isOperational: true
        });
      }

      return {
        physicalCountId: count.PhysicalCountId,
        countNumber: count.CountNumber,
        movementType: hasPositive ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        reference: `Conteo fisico ${count.CountNumber}`,
        notes: `Ajuste generado en DRAFT desde conteo fisico ${count.CountNumber}.`,
        lines: lines.map((line) => ({
          itemId: line.ItemId,
          warehouseId: line.WarehouseId,
          unitOfMeasureId: line.UnitOfMeasureId,
          quantity: Math.abs(Number(line.DifferenceQuantity)),
          unitCost: Number(line.UnitCost ?? 0),
          notes: `Diferencia conteo ${count.CountNumber}, linea ${line.LineNumber}`
        }))
      } satisfies PhysicalCountAdjustmentPayload;
    });
  }

  attachAdjustmentMovement(input: PhysicalCountContextInput & { physicalCountId: string; adjustmentMovementId: string }) {
    return this.executeInTransaction(async (transaction) => {
      const count = await this.lockPhysicalCount(transaction, input, input.physicalCountId);

      if (count.Status !== "COMPLETED") {
        throw new AppError({
          statusCode: 409,
          code: "PHYSICAL_COUNT_NOT_COMPLETED",
          message: "Only COMPLETED physical counts can attach adjustment movements.",
          isOperational: true
        });
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE inventory.PhysicalCounts
          SET Status = 'ADJUSTMENT_CREATED',
              AdjustmentMovementId = @AdjustmentMovementId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE PhysicalCountId = @PhysicalCountId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "AdjustmentMovementId", value: input.adjustmentMovementId },
          { name: "PhysicalCountId", value: input.physicalCountId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return this.getPhysicalCountSummary(transaction, input, input.physicalCountId);
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

  private async ensureWarehouseExists(
    transaction: sql.Transaction,
    input: PhysicalCountContextInput,
    warehouseId: string
  ) {
    const rows = await this.queryInTransaction<{ WarehouseId: string }>(
      transaction,
      `
        SELECT WarehouseId
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
        code: "PHYSICAL_COUNT_WAREHOUSE_NOT_FOUND",
        message: "Physical count warehouse was not found.",
        isOperational: true
      });
    }
  }

  private async lockPhysicalCount(
    transaction: sql.Transaction,
    input: PhysicalCountContextInput,
    physicalCountId: string
  ) {
    const rows = await this.queryInTransaction<CountHeaderRow>(
      transaction,
      `
        SELECT
          PhysicalCountId,
          CountNumber,
          WarehouseId,
          Status,
          AdjustmentMovementId
        FROM inventory.PhysicalCounts WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE PhysicalCountId = @PhysicalCountId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "PhysicalCountId", value: physicalCountId },
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId }
      ]
    );

    const count = rows[0];

    if (!count) {
      throw new NotFoundError(
        "Physical count not found.",
        { physicalCountId },
        "PHYSICAL_COUNT_NOT_FOUND"
      );
    }

    return count;
  }

  private async getItemSnapshot(
    transaction: sql.Transaction,
    input: PhysicalCountContextInput,
    itemId: string,
    warehouseId: string
  ) {
    const rows = await this.queryInTransaction<StockSnapshotRow>(
      transaction,
      `
        SELECT
          item.ItemId,
          item.UnitOfMeasureId,
          stock.QuantityOnHand,
          stock.AverageCost,
          stock.LastCost,
          stock.StandardCost
        FROM inventory.Items item
        LEFT JOIN inventory.ItemStocks stock
          ON stock.ItemId = item.ItemId
         AND stock.WarehouseId = @WarehouseId
         AND stock.TenantId = @TenantId
         AND stock.CompanyId = @CompanyId
        WHERE item.TenantId = @TenantId
          AND item.CompanyId = @CompanyId
          AND item.ItemId = @ItemId
          AND item.IsActive = 1;
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "ItemId", value: itemId },
        { name: "WarehouseId", value: warehouseId }
      ]
    );

    const snapshot = rows[0];

    if (!snapshot) {
      throw new AppError({
        statusCode: 400,
        code: "PHYSICAL_COUNT_ITEM_NOT_FOUND",
        message: "Physical count item was not found.",
        isOperational: true
      });
    }

    return snapshot;
  }

  private async getNextLineNumber(transaction: sql.Transaction, physicalCountId: string) {
    const rows = await this.queryInTransaction<NextLineNumberRow>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS NextLineNumber
        FROM inventory.PhysicalCountLines WITH (UPDLOCK, HOLDLOCK)
        WHERE PhysicalCountId = @PhysicalCountId;
      `,
      [{ name: "PhysicalCountId", value: physicalCountId }]
    );

    return Number(rows[0]?.NextLineNumber ?? 1);
  }

  private async getPhysicalCountLineCount(transaction: sql.Transaction, physicalCountId: string) {
    const rows = await this.queryInTransaction<{ LineCount: number }>(
      transaction,
      `
        SELECT COUNT(1) AS LineCount
        FROM inventory.PhysicalCountLines
        WHERE PhysicalCountId = @PhysicalCountId;
      `,
      [{ name: "PhysicalCountId", value: physicalCountId }]
    );

    return Number(rows[0]?.LineCount ?? 0);
  }

  private async getPhysicalCountSummary(
    transaction: sql.Transaction,
    input: PhysicalCountContextInput,
    physicalCountId: string
  ) {
    const rows = await this.queryInTransaction<SummaryRow>(
      transaction,
      `
        SELECT
          PhysicalCountId,
          CountNumber,
          WarehouseId,
          Status,
          CountDate,
          CompletedAt,
          AdjustmentMovementId,
          LineCount,
          TotalSnapshotQuantity,
          TotalCountedQuantity,
          TotalDifferenceQuantity
        FROM inventory.V_PhysicalCountSummary
        WHERE PhysicalCountId = @PhysicalCountId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "PhysicalCountId", value: physicalCountId },
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError(
        "Physical count not found.",
        { physicalCountId },
        "PHYSICAL_COUNT_NOT_FOUND"
      );
    }

    return {
      id: row.PhysicalCountId,
      countNumber: row.CountNumber,
      warehouseId: row.WarehouseId,
      status: row.Status,
      countDate: row.CountDate,
      completedAt: row.CompletedAt ?? undefined,
      adjustmentMovementId: row.AdjustmentMovementId ?? undefined,
      lineCount: Number(row.LineCount),
      totalSnapshotQuantity: Number(row.TotalSnapshotQuantity),
      totalCountedQuantity: Number(row.TotalCountedQuantity),
      totalDifferenceQuantity: Number(row.TotalDifferenceQuantity)
    };
  }

  private async getPhysicalCountLine(
    transaction: sql.Transaction,
    input: PhysicalCountContextInput,
    lineId: string
  ) {
    const rows = await this.queryInTransaction<LineRow>(
      transaction,
      `
        SELECT
          PhysicalCountLineId,
          PhysicalCountId,
          LineNumber,
          ItemId,
          WarehouseId,
          UnitOfMeasureId,
          SnapshotQuantity,
          CountedQuantity,
          DifferenceQuantity,
          UnitCost
        FROM inventory.PhysicalCountLines
        WHERE PhysicalCountLineId = @LineId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "LineId", value: lineId },
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError(
        "Physical count line not found.",
        { lineId },
        "PHYSICAL_COUNT_LINE_NOT_FOUND"
      );
    }

    return {
      id: row.PhysicalCountLineId,
      physicalCountId: row.PhysicalCountId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      warehouseId: row.WarehouseId,
      unitOfMeasureId: row.UnitOfMeasureId ?? undefined,
      snapshotQuantity: Number(row.SnapshotQuantity),
      countedQuantity: Number(row.CountedQuantity),
      differenceQuantity: Number(row.DifferenceQuantity),
      unitCost: Number(row.UnitCost)
    };
  }

  private async generateCountNumber(transaction: sql.Transaction, input: PhysicalCountContextInput) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const countNumber = this.buildCountNumber();
      const rows = await this.queryInTransaction<CountNumberRow>(
        transaction,
        `
          SELECT CountNumber
          FROM inventory.PhysicalCounts WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND CountNumber = @CountNumber;
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "CountNumber", value: countNumber }
        ]
      );

      if (!rows[0]) {
        return countNumber;
      }
    }

    throw new AppError({
      statusCode: 409,
      code: "PHYSICAL_COUNT_NUMBER_COLLISION",
      message: "Could not generate a unique physical count number.",
      isOperational: true
    });
  }

  private buildCountNumber() {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();

    return `CF-${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}-${suffix}`;
  }
}

export const physicalCountRepository = new PhysicalCountRepository();
