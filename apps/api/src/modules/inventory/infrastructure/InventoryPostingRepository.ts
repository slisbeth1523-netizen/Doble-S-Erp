import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";

export type InventoryMovementType =
  | "OPENING"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "TRANSFER"
  | "PURCHASE_RECEIPT_PLACEHOLDER"
  | "SALES_SHIPMENT"
  | "SALES_RETURN"
  | "SALES_ISSUE_PLACEHOLDER"
  | "RETURN_IN_PLACEHOLDER"
  | "RETURN_OUT_PLACEHOLDER";

type MovementRow = {
  InventoryMovementId: string;
  TenantId: string;
  CompanyId: string;
  MovementNumber: string;
  MovementType: InventoryMovementType;
  MovementDate: Date;
  Status: "DRAFT" | "POSTED" | "VOIDED";
  SourceModule: string | null;
  SourceDocumentNumber: string | null;
  Reference: string | null;
  PostedAt: Date | null;
  PostedBy: string | null;
};

type MovementLineRow = {
  InventoryMovementLineId: string;
  ItemId: string;
  WarehouseId: string;
  ToWarehouseId: string | null;
  UnitOfMeasureId: string | null;
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

type LedgerDirection = "IN" | "OUT";

type LedgerEntryInput = {
  line: MovementLineRow;
  warehouseId: string;
  direction: LedgerDirection;
  quantityIn: number;
  quantityOut: number;
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

const inboundMovementTypes: InventoryMovementType[] = ["OPENING", "ADJUSTMENT_IN", "PURCHASE_RECEIPT_PLACEHOLDER", "SALES_RETURN"];
const placeholderMovementTypes: InventoryMovementType[] = [
  "SALES_ISSUE_PLACEHOLDER",
  "RETURN_IN_PLACEHOLDER",
  "RETURN_OUT_PLACEHOLDER"
];

export class InventoryPostingRepository extends BaseSqlRepository {
  postMovement(input: InventoryPostingInput): Promise<InventoryPostingResult> {
    return this.executeInTransaction(async (transaction) => {
      return this.postMovementInTransaction(transaction, input);
    });
  }

  async postMovementInTransaction(
    transaction: sql.Transaction,
    input: InventoryPostingInput
  ): Promise<InventoryPostingResult> {
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
    await this.recordLedgerEntries(transaction, input, movement, lines, postedAt);
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
          MovementDate,
          Status,
          SourceModule,
          SourceDocumentNumber,
          Reference,
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
          ToWarehouseId,
          UnitOfMeasureId,
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

  private async recordLedgerEntries(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    movement: MovementRow,
    lines: MovementLineRow[],
    postedAt: Date
  ) {
    for (const line of lines) {
      const entries = this.getLedgerEntriesForLine(movement.MovementType, line);

      for (const entry of entries) {
        await this.insertLedgerEntry(transaction, input, movement, entry, postedAt);
      }
    }
  }

  private getLedgerEntriesForLine(
    movementType: InventoryMovementType,
    line: MovementLineRow
  ): LedgerEntryInput[] {
    const quantity = Number(line.Quantity);

    if (inboundMovementTypes.includes(movementType)) {
      return [
        {
          line,
          warehouseId: line.WarehouseId,
          direction: "IN",
          quantityIn: quantity,
          quantityOut: 0
        }
      ];
    }

    if (movementType === "ADJUSTMENT_OUT" || movementType === "SALES_SHIPMENT") {
      return [
        {
          line,
          warehouseId: line.WarehouseId,
          direction: "OUT",
          quantityIn: 0,
          quantityOut: quantity
        }
      ];
    }

    if (movementType === "TRANSFER" && line.ToWarehouseId) {
      return [
        {
          line,
          warehouseId: line.WarehouseId,
          direction: "OUT",
          quantityIn: 0,
          quantityOut: quantity
        },
        {
          line,
          warehouseId: line.ToWarehouseId,
          direction: "IN",
          quantityIn: quantity,
          quantityOut: 0
        }
      ];
    }

    return [];
  }

  private insertLedgerEntry(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    movement: MovementRow,
    entry: LedgerEntryInput,
    postedAt: Date
  ) {
    const unitCost = Number(entry.line.UnitCost);
    const quantity = Math.max(entry.quantityIn, entry.quantityOut);

    return this.queryInTransaction(
      transaction,
      `
        IF NOT EXISTS (
          SELECT 1
          FROM inventory.InventoryLedgerEntries WITH (UPDLOCK, HOLDLOCK)
          WHERE InventoryMovementLineId = @InventoryMovementLineId
            AND WarehouseId = @WarehouseId
            AND LedgerDirection = @LedgerDirection
        )
        BEGIN
          INSERT INTO inventory.InventoryLedgerEntries (
            TenantId,
            CompanyId,
            InventoryMovementId,
            InventoryMovementLineId,
            MovementNumber,
            MovementType,
            MovementDate,
            PostedAt,
            ItemId,
            WarehouseId,
            UnitOfMeasureId,
            LedgerDirection,
            QuantityIn,
            QuantityOut,
            UnitCost,
            TotalCost,
            SourceModule,
            SourceDocumentNumber,
            Reference,
            Notes,
            CreatedBy
          )
          VALUES (
            @TenantId,
            @CompanyId,
            @InventoryMovementId,
            @InventoryMovementLineId,
            @MovementNumber,
            @MovementType,
            @MovementDate,
            @PostedAt,
            @ItemId,
            @WarehouseId,
            @UnitOfMeasureId,
            @LedgerDirection,
            @QuantityIn,
            @QuantityOut,
            @UnitCost,
            @TotalCost,
            @SourceModule,
            @SourceDocumentNumber,
            @Reference,
            @Notes,
            @PostedBy
          );
        END;
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "InventoryMovementId", value: movement.InventoryMovementId },
        { name: "InventoryMovementLineId", value: entry.line.InventoryMovementLineId },
        { name: "MovementNumber", value: movement.MovementNumber },
        { name: "MovementType", value: movement.MovementType },
        { name: "MovementDate", value: movement.MovementDate },
        { name: "PostedAt", value: postedAt },
        { name: "ItemId", value: entry.line.ItemId },
        { name: "WarehouseId", value: entry.warehouseId },
        { name: "UnitOfMeasureId", value: entry.line.UnitOfMeasureId },
        { name: "LedgerDirection", value: entry.direction },
        { name: "QuantityIn", value: entry.quantityIn },
        { name: "QuantityOut", value: entry.quantityOut },
        { name: "UnitCost", value: unitCost },
        { name: "TotalCost", value: quantity * unitCost },
        { name: "SourceModule", value: movement.SourceModule },
        { name: "SourceDocumentNumber", value: movement.SourceDocumentNumber },
        { name: "Reference", value: movement.Reference },
        { name: "Notes", value: `Ledger generated from inventory posting ${movement.MovementNumber}.` },
        { name: "PostedBy", value: input.postedBy ?? null }
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

    if (inboundMovementTypes.includes(movementType)) {
      const stock = await this.lockStock(transaction, input, line.ItemId, line.WarehouseId);
      await this.postInboundLine(transaction, input, line, stock, quantity, unitCost);
      return;
    }

    if (movementType === "ADJUSTMENT_OUT" || movementType === "SALES_SHIPMENT") {
      const stock = await this.lockStock(transaction, input, line.ItemId, line.WarehouseId);
      await this.postOutboundLine(transaction, input, line, stock, quantity);
      return;
    }

    if (movementType === "TRANSFER") {
      await this.postTransferLine(transaction, input, line, quantity);
    }
  }

  private async lockStock(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    itemId: string,
    warehouseId: string
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
        { name: "ItemId", value: itemId },
        { name: "WarehouseId", value: warehouseId }
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

  private async postTransferLine(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    line: MovementLineRow,
    quantity: number
  ) {
    this.validateTransferLine(line, quantity);

    const originStock = await this.lockStock(transaction, input, line.ItemId, line.WarehouseId);

    if (!originStock) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_STOCK_NOT_FOUND",
        message: `Origin inventory stock does not exist for transfer line ${line.LineNumber}.`,
        isOperational: true
      });
    }

    const destinationStock = await this.lockStock(
      transaction,
      input,
      line.ItemId,
      line.ToWarehouseId as string
    );

    await this.decreaseTransferOriginStock(transaction, input, line, originStock, quantity);
    await this.increaseTransferDestinationStock(
      transaction,
      input,
      line,
      originStock,
      destinationStock,
      quantity
    );
  }

  private validateTransferLine(line: MovementLineRow, quantity: number) {
    if (!line.ToWarehouseId) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_TRANSFER_DESTINATION_REQUIRED",
        message: `Transfer line ${line.LineNumber} requires a destination warehouse.`,
        isOperational: true
      });
    }

    if (line.ToWarehouseId === line.WarehouseId) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_TRANSFER_SAME_WAREHOUSE",
        message: `Transfer line ${line.LineNumber} cannot use the same origin and destination warehouse.`,
        isOperational: true
      });
    }

    if (quantity <= 0) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_INVALID_QUANTITY",
        message: `Transfer line ${line.LineNumber} must have a quantity greater than zero.`,
        isOperational: true
      });
    }
  }

  private async decreaseTransferOriginStock(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    line: MovementLineRow,
    stock: StockRow,
    quantity: number
  ) {
    const oldQuantity = Number(stock.QuantityOnHand);
    const reserved = Number(stock.QuantityReserved);
    const newQuantity = oldQuantity - quantity;

    if (newQuantity < 0 || newQuantity < reserved) {
      throw new AppError({
        statusCode: 400,
        code: "INVENTORY_NEGATIVE_STOCK_NOT_ALLOWED",
        message: `Transfer line ${line.LineNumber} would create negative or unavailable origin stock.`,
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

  private async increaseTransferDestinationStock(
    transaction: sql.Transaction,
    input: InventoryPostingInput,
    line: MovementLineRow,
    originStock: StockRow,
    destinationStock: StockRow | undefined,
    quantity: number
  ) {
    const incomingAverageCost = Number(originStock.AverageCost);
    const incomingLastCost = Number(originStock.LastCost);
    const incomingStandardCost = Number(originStock.StandardCost);

    if (!destinationStock) {
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
            @AverageCost,
            @LastCost,
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
          { name: "WarehouseId", value: line.ToWarehouseId as string },
          { name: "Quantity", value: quantity },
          { name: "AverageCost", value: incomingAverageCost },
          { name: "LastCost", value: incomingLastCost },
          { name: "StandardCost", value: incomingStandardCost },
          { name: "PostedBy", value: input.postedBy ?? null }
        ]
      );
      return;
    }

    const oldQuantity = Number(destinationStock.QuantityOnHand);
    const oldAverageCost = Number(destinationStock.AverageCost);
    const newQuantity = oldQuantity + quantity;
    const newAverageCost =
      oldQuantity === 0
        ? incomingAverageCost
        : ((oldQuantity * oldAverageCost) + (quantity * incomingAverageCost)) / newQuantity;

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
        { name: "LastCost", value: incomingLastCost },
        { name: "PostedBy", value: input.postedBy ?? null },
        { name: "ItemStockId", value: destinationStock.ItemStockId }
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
