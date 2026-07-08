import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";

export type InventoryMovementType =
  | "OPENING"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "TRANSFER"
  | "PURCHASE_RECEIPT_PLACEHOLDER"
  | "SALES_ISSUE_PLACEHOLDER"
  | "RETURN_IN_PLACEHOLDER"
  | "RETURN_OUT_PLACEHOLDER";

type MovementRow = {
  InventoryMovementId: string;
  TenantId: string;
  CompanyId: string;
  MovementNumber: string;
  MovementType: InventoryMovementType;
  Status: "DRAFT" | "POSTED" | "VOIDED";
  PostedAt: Date | null;
  PostedBy: string | null;
};

type MovementLineRow = {
  InventoryMovementLineId: string;
  ItemId: string;
  WarehouseId: string;
  Quantity: number;
  UnitCost: number;
  LineNumber: number;
};

type StockRow = {
  ItemStockId: string;
  QuantityOnHand: number;
  QuantityReserved: number;
  AverageCost: number;
  LastCost: number;
  StandardCost: number;
};

type ItemCostRow = {
  StandardCost: number | null;
};

export type InventoryPostingInput = {
  tenantId: string;
  companyId: string;
  movementId: string;
  postedBy?: string;
};

export type InventoryPostingResult = {
  id: string;
  movementNumber: string;
  movementType: InventoryMovementType;
  status: "POSTED";
  postedAt: Date;
  postedBy?: string;
  lineCount: number;
  totalQuantity: number;
};

const inboundMovementTypes: InventoryMovementType[] = ["OPENING", "ADJUSTMENT_IN"];
const placeholderMovementTypes: InventoryMovementType[] = [
  "PURCHASE_RECEIPT_PLACEHOLDER",
  "SALES_ISSUE_PLACEHOLDER",
  "RETURN_IN_PLACEHOLDER",
  "RETURN_OUT_PLACEHOLDER"
];

export class InventoryPostingRepository extends BaseSqlRepository {
  postMovement(input: InventoryPostingInput): Promise<InventoryPostingResult> {
    return this.executeInTransaction(async (transaction) => {
      const movement = await this.lockMovement(transaction, input);

      this.validateMovementForPosting(movement);

      const lines = await this.lockMovementLines(transaction, input);

      if (!lines.length) {
        throw new AppError({
          statusCode: 400,
          code: "INVENTORY_MOVEMENT_HAS_NO_LINES",
          message: "Inventory movement has no lines to post.",
          isOperational: true
        });
      }

      for (const line of lines) {
        await this.postLine(transaction, input, movement.MovementType, line);
      }

      const postedAt = new Date();
      await this.markMovementPosted(transaction, input, postedAt);

      return {
        id: movement.InventoryMovementId,
        movementNumber: movement.MovementNumber,
        movementType: movement.MovementType,
        status: "POSTED",
        postedAt,
        postedBy: input.postedBy,
        lineCount: lines.length,
        totalQuantity: lines.reduce((total, line) => total + Number(line.Quantity), 0)
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

  private async lockMovement(transaction: sql.Transaction, input: InventoryPostingInput) {
    const rows = await this.queryInTransaction<MovementRow>(
      transaction,
      `
        SELECT
          InventoryMovementId,
          TenantId,
          CompanyId,
          MovementNumber,
          MovementType,
          Status,
          PostedAt,
          PostedBy
        FROM inventory.InventoryMovements WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE InventoryMovementId = @MovementId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "MovementId", value: input.movementId },
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId }
      ]
    );

    const movement = rows[0];

    if (!movement) {
      throw new NotFoundError(
        "Inventory movement not found.",
        { movementId: input.movementId },
        "INVENTORY_MOVEMENT_NOT_FOUND"
      );
    }

    return movement;
  }

  private validateMovementForPosting(movement: MovementRow) {
    if (movement.Status === "POSTED") {
      throw new AppError({
        statusCode: 409,
        code: "INVENTORY_MOVEMENT_ALREADY_POSTED",
        message: "Inventory movement is already posted.",
        isOperational: true
      });
    }

    if (movement.Status === "VOIDED") {
      throw new AppError({
        statusCode: 409,
        code: "INVENTORY_MOVEMENT_VOIDED",
        message: "Voided inventory movements cannot be posted.",
        isOperational: true
      });
    }

    if (movement.MovementType === "TRANSFER") {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_TRANSFER_POSTING_NOT_IMPLEMENTED",
        message: "Transfer posting not implemented yet.",
        isOperational: true
      });
    }

    if (placeholderMovementTypes.includes(movement.MovementType)) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_SOURCE_POSTING_NOT_IMPLEMENTED",
        message: "Source document posting will be implemented in a future phase.",
        isOperational: true
      });
    }

    if (movement.Status !== "DRAFT") {
      throw new AppError({
        statusCode: 409,
        code: "INVENTORY_MOVEMENT_NOT_DRAFT",
        message: "Only DRAFT inventory movements can be posted.",
        isOperational: true
      });
    }
  }

  private lockMovementLines(transaction: sql.Transaction, input: InventoryPostingInput) {
    return this.queryInTransaction<MovementLineRow>(
      transaction,
      `
        SELECT
          InventoryMovementLineId,
          ItemId,
          WarehouseId,
          Quantity,
          UnitCost,
          LineNumber
        FROM inventory.InventoryMovementLines WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE InventoryMovementId = @MovementId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "MovementId", value: input.movementId },
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId }
      ]
    );
  }

  private async postLine(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    movementType: InventoryMovementType,
    line: MovementLineRow
  ) {
    const quantity = Number(line.Quantity);
    const unitCost = Number(line.UnitCost);
    const stock = await this.lockStock(transaction, input, line);

    if (inboundMovementTypes.includes(movementType)) {
      await this.postInboundLine(transaction, input, line, stock, quantity, unitCost);
      return;
    }

    if (movementType === "ADJUSTMENT_OUT") {
      await this.postOutboundLine(transaction, input, line, stock, quantity);
    }
  }

  private async lockStock(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    line: MovementLineRow
  ) {
    const rows = await this.queryInTransaction<StockRow>(
      transaction,
      `
        SELECT
          ItemStockId,
          QuantityOnHand,
          QuantityReserved,
          AverageCost,
          LastCost,
          StandardCost
        FROM inventory.ItemStocks WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId;
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "ItemId", value: line.ItemId },
        { name: "WarehouseId", value: line.WarehouseId }
      ]
    );

    return rows[0];
  }

  private async postInboundLine(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    line: MovementLineRow,
    stock: StockRow | undefined,
    quantity: number,
    unitCost: number
  ) {
    if (!stock) {
      const itemCosts = await this.queryInTransaction<ItemCostRow>(
        transaction,
        `
          SELECT StandardCost
          FROM inventory.Items
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND ItemId = @ItemId;
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "ItemId", value: line.ItemId }
        ]
      );

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO inventory.ItemStocks (
            TenantId,
            CompanyId,
            ItemId,
            WarehouseId,
            QuantityOnHand,
            QuantityReserved,
            AverageCost,
            LastCost,
            StandardCost,
            LastMovementAt,
            IsActive,
            CreatedBy
          )
          VALUES (
            @TenantId,
            @CompanyId,
            @ItemId,
            @WarehouseId,
            @Quantity,
            0,
            @UnitCost,
            @UnitCost,
            @StandardCost,
            SYSUTCDATETIME(),
            1,
            @PostedBy
          );
        `,
        [
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "ItemId", value: line.ItemId },
          { name: "WarehouseId", value: line.WarehouseId },
          { name: "Quantity", value: quantity },
          { name: "UnitCost", value: unitCost },
          { name: "StandardCost", value: Number(itemCosts[0]?.StandardCost ?? 0) },
          { name: "PostedBy", value: input.postedBy ?? null }
        ]
      );
      return;
    }

    const oldQuantity = Number(stock.QuantityOnHand);
    const oldAverageCost = Number(stock.AverageCost);
    const newQuantity = oldQuantity + quantity;
    const newAverageCost =
      oldQuantity === 0
        ? unitCost
        : ((oldQuantity * oldAverageCost) + (quantity * unitCost)) / newQuantity;

    await this.queryInTransaction(
      transaction,
      `
        UPDATE inventory.ItemStocks
        SET QuantityOnHand = @QuantityOnHand,
            AverageCost = @AverageCost,
            LastCost = @LastCost,
            LastMovementAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @PostedBy
        WHERE ItemStockId = @ItemStockId;
      `,
      [
        { name: "QuantityOnHand", value: newQuantity },
        { name: "AverageCost", value: newAverageCost },
        { name: "LastCost", value: unitCost },
        { name: "PostedBy", value: input.postedBy ?? null },
        { name: "ItemStockId", value: stock.ItemStockId }
      ]
    );
  }

  private async postOutboundLine(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    line: MovementLineRow,
    stock: StockRow | undefined,
    quantity: number
  ) {
    if (!stock) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_STOCK_NOT_FOUND",
        message: `Inventory stock does not exist for movement line ${line.LineNumber}.`,
        isOperational: true
      });
    }

    const oldQuantity = Number(stock.QuantityOnHand);
    const reserved = Number(stock.QuantityReserved);
    const newQuantity = oldQuantity - quantity;

    if (newQuantity < 0 || newQuantity < reserved) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_NEGATIVE_STOCK_NOT_ALLOWED",
        message: `Posting line ${line.LineNumber} would create negative or unavailable stock.`,
        isOperational: true
      });
    }

    await this.queryInTransaction(
      transaction,
      `
        UPDATE inventory.ItemStocks
        SET QuantityOnHand = @QuantityOnHand,
            LastMovementAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @PostedBy
        WHERE ItemStockId = @ItemStockId;
      `,
      [
        { name: "QuantityOnHand", value: newQuantity },
        { name: "PostedBy", value: input.postedBy ?? null },
        { name: "ItemStockId", value: stock.ItemStockId }
      ]
    );
  }

  private markMovementPosted(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    postedAt: Date
  ) {
    return this.queryInTransaction(
      transaction,
      `
        UPDATE inventory.InventoryMovements
        SET Status = 'POSTED',
            PostedAt = @PostedAt,
            PostedBy = @PostedBy,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @PostedBy
        WHERE InventoryMovementId = @MovementId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "MovementId", value: input.movementId },
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "PostedAt", value: postedAt },
        { name: "PostedBy", value: input.postedBy ?? null }
      ]
    );
  }
}

export const inventoryPostingRepository = new InventoryPostingRepository();
