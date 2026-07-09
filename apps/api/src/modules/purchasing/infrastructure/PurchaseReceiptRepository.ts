import { randomUUID } from "node:crypto";

import sql from "mssql";

import { inventoryPostingRepository } from "../../inventory/infrastructure/InventoryPostingRepository.js";
import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  PurchaseReceiptCreatePayload,
  PurchaseReceiptLineCreatePayload,
  PurchaseReceiptListQuery
} from "../validators/purchase-receipt.validators.js";

export type PurchaseReceiptStatus = "DRAFT" | "POSTED";

export type PurchaseReceiptContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type PurchaseReceiptCreateInput = PurchaseReceiptContextInput & PurchaseReceiptCreatePayload;
export type PurchaseReceiptLineCreateInput = PurchaseReceiptContextInput & PurchaseReceiptLineCreatePayload;

export type PurchaseReceiptLineResult = {
  id: string;
  purchaseReceiptId: string;
  purchaseReceiptNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  purchaseOrderLineId: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  unitOfMeasureId?: string;
  unitOfMeasureCode?: string;
  quantityReceived: number;
  orderedQuantity: number;
  unitCost: number;
  lineTotal: number;
  lotNumber?: string;
  serialNumber?: string;
  expirationDate?: Date;
  notes?: string;
};

export type PurchaseReceiptResult = {
  id: string;
  purchaseReceiptNumber: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  inventoryMovementId?: string;
  movementNumber?: string;
  status: PurchaseReceiptStatus;
  receiptDate: Date;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  lineCount: number;
  totalQuantityReceived: number;
  totalAmount: number;
  lines: PurchaseReceiptLineResult[];
};

type PurchaseReceiptSummaryRow = {
  PurchaseReceiptId: string;
  PurchaseReceiptNumber: string;
  PurchaseOrderId: string;
  PurchaseOrderNumber: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  InventoryMovementId: string | null;
  MovementNumber: string | null;
  Status: PurchaseReceiptStatus;
  ReceiptDate: Date;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
  LineCount: number;
  TotalQuantityReceived: number;
  TotalAmount: number;
};

type PurchaseReceiptLineRow = {
  PurchaseReceiptLineId: string;
  PurchaseReceiptId: string;
  PurchaseReceiptNumber: string;
  PurchaseOrderId: string;
  PurchaseOrderNumber: string;
  PurchaseOrderLineId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  WarehouseId: string;
  WarehouseCode: string;
  WarehouseName: string;
  UnitOfMeasureId: string | null;
  UnitOfMeasureCode: string | null;
  QuantityReceived: number;
  OrderedQuantity: number;
  UnitCost: number;
  LineTotal: number;
  LotNumber: string | null;
  SerialNumber: string | null;
  ExpirationDate: Date | null;
  Notes: string | null;
};

type ApprovedOrderRow = {
  PurchaseOrderId: string;
  SupplierId: string;
  Status: "DRAFT" | "APPROVED" | "CANCELLED" | "CLOSED";
};

type ReceiptLockRow = {
  PurchaseReceiptId: string;
  PurchaseReceiptNumber: string;
  PurchaseOrderId: string;
  SupplierId: string;
  Status: PurchaseReceiptStatus;
  InventoryMovementId: string | null;
};

type PurchaseOrderLineLockRow = {
  PurchaseOrderLineId: string;
  ItemId: string;
  WarehouseId: string;
  UnitOfMeasureId: string | null;
  Quantity: number;
  UnitCost: number;
};

type TotalRow = {
  Total: number | null;
};

type NumberRow = {
  DocumentNumber: string;
};

type MovementLineSourceRow = {
  PurchaseReceiptLineId: string;
  LineNumber: number;
  ItemId: string;
  WarehouseId: string;
  UnitOfMeasureId: string | null;
  QuantityReceived: number;
  UnitCost: number;
  LotNumber: string | null;
  SerialNumber: string | null;
  ExpirationDate: Date | null;
  Notes: string | null;
};

export class PurchaseReceiptRepository extends BaseSqlRepository {
  async createPurchaseReceipt(input: PurchaseReceiptCreateInput): Promise<PurchaseReceiptResult> {
    const purchaseReceiptId = await this.executeInTransaction(async (transaction) => {
      const order = await this.lockApprovedPurchaseOrder(transaction, input, input.purchaseOrderId);
      const receiptId = randomUUID();
      const receiptNumber = await this.generateReceiptNumber(transaction, input);
      const receiptDate = input.receiptDate ? new Date(input.receiptDate) : new Date();

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO purchasing.PurchaseReceipts (
            PurchaseReceiptId,
            TenantId,
            CompanyId,
            PurchaseReceiptNumber,
            PurchaseOrderId,
            SupplierId,
            ReceiptDate,
            Status,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @PurchaseReceiptId,
            @TenantId,
            @CompanyId,
            @PurchaseReceiptNumber,
            @PurchaseOrderId,
            @SupplierId,
            @ReceiptDate,
            'DRAFT',
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "PurchaseReceiptId", value: receiptId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "PurchaseReceiptNumber", value: receiptNumber },
          { name: "PurchaseOrderId", value: order.PurchaseOrderId },
          { name: "SupplierId", value: order.SupplierId },
          { name: "ReceiptDate", value: receiptDate },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return receiptId;
    });

    return this.getPurchaseReceipt(input, purchaseReceiptId);
  }

  async listPurchaseReceipts(
    context: PurchaseReceiptContextInput,
    query: PurchaseReceiptListQuery
  ): Promise<PurchaseReceiptResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<PurchaseReceiptSummaryRow>(
      `
        SELECT
          PurchaseReceiptId,
          PurchaseReceiptNumber,
          PurchaseOrderId,
          PurchaseOrderNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          InventoryMovementId,
          MovementNumber,
          Status,
          ReceiptDate,
          Reference,
          Notes,
          PostedAt,
          LineCount,
          TotalQuantityReceived,
          TotalAmount
        FROM purchasing.V_PurchaseReceiptSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (
            @Search IS NULL
            OR PurchaseReceiptNumber LIKE @Search
            OR PurchaseOrderNumber LIKE @Search
            OR SupplierCode LIKE @Search
            OR SupplierName LIKE @Search
            OR MovementNumber LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY ReceiptDate DESC, PurchaseReceiptNumber DESC
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

    return rows.map((row) => this.mapReceipt(row, []));
  }

  async getPurchaseReceipt(
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string
  ): Promise<PurchaseReceiptResult> {
    const rows = await this.query<PurchaseReceiptSummaryRow>(
      `
        SELECT
          PurchaseReceiptId,
          PurchaseReceiptNumber,
          PurchaseOrderId,
          PurchaseOrderNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          InventoryMovementId,
          MovementNumber,
          Status,
          ReceiptDate,
          Reference,
          Notes,
          PostedAt,
          LineCount,
          TotalQuantityReceived,
          TotalAmount
        FROM purchasing.V_PurchaseReceiptSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseReceiptId = @PurchaseReceiptId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseReceiptId", value: purchaseReceiptId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError(
        "Purchase receipt not found.",
        { purchaseReceiptId },
        "PURCHASE_RECEIPT_NOT_FOUND"
      );
    }

    const lines = await this.getPurchaseReceiptLines(context, purchaseReceiptId);
    return this.mapReceipt(row, lines);
  }

  async addPurchaseReceiptLine(
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string,
    payload: PurchaseReceiptLineCreatePayload
  ): Promise<PurchaseReceiptResult> {
    await this.executeInTransaction(async (transaction) => {
      const receipt = await this.lockReceipt(transaction, context, purchaseReceiptId);

      if (receipt.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "PURCHASE_RECEIPT_LINE_INVALID_STATUS",
          message: "Only DRAFT purchase receipts can receive new lines.",
          isOperational: true
        });
      }

      const orderLine = await this.lockPurchaseOrderLine(
        transaction,
        context,
        receipt.PurchaseOrderId,
        payload.purchaseOrderLineId
      );

      await this.ensureQuantityDoesNotExceedOrder(transaction, context, payload, orderLine);

      const nextLineNumber = await this.nextLineNumber(transaction, purchaseReceiptId);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO purchasing.PurchaseReceiptLines (
            PurchaseReceiptLineId,
            PurchaseReceiptId,
            PurchaseOrderLineId,
            TenantId,
            CompanyId,
            LineNumber,
            ItemId,
            WarehouseId,
            UnitOfMeasureId,
            QuantityReceived,
            UnitCost,
            LotNumber,
            SerialNumber,
            ExpirationDate,
            Notes,
            CreatedBy
          )
          VALUES (
            @PurchaseReceiptLineId,
            @PurchaseReceiptId,
            @PurchaseOrderLineId,
            @TenantId,
            @CompanyId,
            @LineNumber,
            @ItemId,
            @WarehouseId,
            @UnitOfMeasureId,
            @QuantityReceived,
            @UnitCost,
            @LotNumber,
            @SerialNumber,
            @ExpirationDate,
            @Notes,
            @UserId
          );
        `,
        [
          { name: "PurchaseReceiptLineId", value: randomUUID() },
          { name: "PurchaseReceiptId", value: purchaseReceiptId },
          { name: "PurchaseOrderLineId", value: payload.purchaseOrderLineId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "LineNumber", value: nextLineNumber },
          { name: "ItemId", value: orderLine.ItemId },
          { name: "WarehouseId", value: orderLine.WarehouseId },
          { name: "UnitOfMeasureId", value: orderLine.UnitOfMeasureId },
          { name: "QuantityReceived", value: payload.quantityReceived },
          { name: "UnitCost", value: payload.unitCost ?? Number(orderLine.UnitCost) },
          { name: "LotNumber", value: payload.lotNumber ?? null },
          { name: "SerialNumber", value: payload.serialNumber ?? null },
          { name: "ExpirationDate", value: payload.expirationDate ?? null },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getPurchaseReceipt(context, purchaseReceiptId);
  }

  async completePurchaseReceipt(
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string
  ): Promise<PurchaseReceiptResult> {
    await this.executeInTransaction(async (transaction) => {
      const receipt = await this.lockReceipt(transaction, context, purchaseReceiptId);

      if (receipt.Status === "POSTED") {
        throw new AppError({
          statusCode: 409,
          code: "PURCHASE_RECEIPT_ALREADY_POSTED",
          message: "Purchase receipt is already posted.",
          isOperational: true
        });
      }

      const lines = await this.lockReceiptLinesForPosting(transaction, context, purchaseReceiptId);

      if (!lines.length) {
        throw new AppError({
          statusCode: 400,
          code: "PURCHASE_RECEIPT_HAS_NO_LINES",
          message: "Purchase receipt has no lines to post.",
          isOperational: true
        });
      }

      const movementId = randomUUID();
      const movementNumber = await this.generateMovementNumber(transaction, context);

      await this.insertInventoryMovement(transaction, context, receipt, movementId, movementNumber);

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
          UPDATE purchasing.PurchaseReceipts
          SET Status = 'POSTED',
              InventoryMovementId = @InventoryMovementId,
              PostedAt = @PostedAt,
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE PurchaseReceiptId = @PurchaseReceiptId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "PurchaseReceiptId", value: purchaseReceiptId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "InventoryMovementId", value: movementId },
          { name: "PostedAt", value: posted.postedAt },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getPurchaseReceipt(context, purchaseReceiptId);
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

  private async lockApprovedPurchaseOrder(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    purchaseOrderId: string
  ) {
    const rows = await this.queryInTransaction<ApprovedOrderRow>(
      transaction,
      `
        SELECT PurchaseOrderId, SupplierId, Status
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

    const order = rows[0];

    if (!order) {
      throw new NotFoundError(
        "Purchase order not found.",
        { purchaseOrderId },
        "PURCHASE_ORDER_NOT_FOUND"
      );
    }

    if (order.Status !== "APPROVED") {
      throw new AppError({
        statusCode: 409,
        code: "PURCHASE_RECEIPT_ORDER_NOT_APPROVED",
        message: "Purchase receipts can only be created for APPROVED purchase orders.",
        isOperational: true
      });
    }

    return order;
  }

  private async lockReceipt(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string
  ) {
    const rows = await this.queryInTransaction<ReceiptLockRow>(
      transaction,
      `
        SELECT
          PurchaseReceiptId,
          PurchaseReceiptNumber,
          PurchaseOrderId,
          SupplierId,
          Status,
          InventoryMovementId
        FROM purchasing.PurchaseReceipts WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseReceiptId = @PurchaseReceiptId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseReceiptId", value: purchaseReceiptId }
      ]
    );

    const receipt = rows[0];

    if (!receipt) {
      throw new NotFoundError(
        "Purchase receipt not found.",
        { purchaseReceiptId },
        "PURCHASE_RECEIPT_NOT_FOUND"
      );
    }

    return receipt;
  }

  private async lockPurchaseOrderLine(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    purchaseOrderId: string,
    purchaseOrderLineId: string
  ) {
    const rows = await this.queryInTransaction<PurchaseOrderLineLockRow>(
      transaction,
      `
        SELECT
          PurchaseOrderLineId,
          ItemId,
          WarehouseId,
          UnitOfMeasureId,
          Quantity,
          UnitCost
        FROM purchasing.PurchaseOrderLines WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseOrderId = @PurchaseOrderId
          AND PurchaseOrderLineId = @PurchaseOrderLineId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseOrderId", value: purchaseOrderId },
        { name: "PurchaseOrderLineId", value: purchaseOrderLineId }
      ]
    );

    const line = rows[0];

    if (!line) {
      throw new NotFoundError(
        "Purchase order line not found for this receipt.",
        { purchaseOrderLineId },
        "PURCHASE_RECEIPT_ORDER_LINE_NOT_FOUND"
      );
    }

    return line;
  }

  private async ensureQuantityDoesNotExceedOrder(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    payload: PurchaseReceiptLineCreatePayload,
    orderLine: PurchaseOrderLineLockRow
  ) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(SUM(line.QuantityReceived), 0) AS Total
        FROM purchasing.PurchaseReceiptLines line WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN purchasing.PurchaseReceipts receipt
          ON receipt.PurchaseReceiptId = line.PurchaseReceiptId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.PurchaseOrderLineId = @PurchaseOrderLineId
          AND receipt.Status IN ('DRAFT', 'POSTED');
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseOrderLineId", value: payload.purchaseOrderLineId }
      ]
    );

    const alreadyReceived = Number(rows[0]?.Total ?? 0);
    const ordered = Number(orderLine.Quantity);

    if (alreadyReceived + payload.quantityReceived > ordered) {
      throw new AppError({
        statusCode: 400,
        code: "PURCHASE_RECEIPT_QUANTITY_EXCEEDS_ORDER",
        message: "Received quantity cannot exceed the purchase order line quantity.",
        isOperational: true
      });
    }
  }

  private async nextLineNumber(transaction: sql.Transaction, purchaseReceiptId: string) {
    const rows = await this.queryInTransaction<TotalRow>(
      transaction,
      `
        SELECT COALESCE(MAX(LineNumber), 0) + 1 AS Total
        FROM purchasing.PurchaseReceiptLines WITH (UPDLOCK, HOLDLOCK)
        WHERE PurchaseReceiptId = @PurchaseReceiptId;
      `,
      [{ name: "PurchaseReceiptId", value: purchaseReceiptId }]
    );

    return Number(rows[0]?.Total ?? 1);
  }

  private lockReceiptLinesForPosting(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string
  ) {
    return this.queryInTransaction<MovementLineSourceRow>(
      transaction,
      `
        SELECT
          PurchaseReceiptLineId,
          LineNumber,
          ItemId,
          WarehouseId,
          UnitOfMeasureId,
          QuantityReceived,
          UnitCost,
          LotNumber,
          SerialNumber,
          ExpirationDate,
          Notes
        FROM purchasing.PurchaseReceiptLines WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseReceiptId = @PurchaseReceiptId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseReceiptId", value: purchaseReceiptId }
      ]
    );
  }

  private insertInventoryMovement(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    receipt: ReceiptLockRow,
    movementId: string,
    movementNumber: string
  ) {
    return this.queryInTransaction(
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
          SourceDocumentId,
          SourceDocumentNumber,
          Reference,
          Notes,
          IsActive,
          CreatedBy
        )
        VALUES (
          @InventoryMovementId,
          @TenantId,
          @CompanyId,
          @MovementNumber,
          'PURCHASE_RECEIPT_PLACEHOLDER',
          SYSUTCDATETIME(),
          'DRAFT',
          'PURCHASING',
          @SourceDocumentId,
          @SourceDocumentNumber,
          @Reference,
          @Notes,
          1,
          @UserId
        );
      `,
      [
        { name: "InventoryMovementId", value: movementId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "MovementNumber", value: movementNumber },
        { name: "SourceDocumentId", value: receipt.PurchaseReceiptId },
        { name: "SourceDocumentNumber", value: receipt.PurchaseReceiptNumber },
        { name: "Reference", value: receipt.PurchaseReceiptNumber },
        { name: "Notes", value: `Purchase receipt ${receipt.PurchaseReceiptNumber}` },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private insertInventoryMovementLine(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    movementId: string,
    line: MovementLineSourceRow
  ) {
    return this.queryInTransaction(
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
          LotNumber,
          SerialNumber,
          ExpirationDate,
          Notes,
          CreatedBy
        )
        VALUES (
          @InventoryMovementLineId,
          @InventoryMovementId,
          @TenantId,
          @CompanyId,
          @LineNumber,
          @ItemId,
          @WarehouseId,
          @UnitOfMeasureId,
          @Quantity,
          @UnitCost,
          @LotNumber,
          @SerialNumber,
          @ExpirationDate,
          @Notes,
          @UserId
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
        { name: "Quantity", value: line.QuantityReceived },
        { name: "UnitCost", value: line.UnitCost },
        { name: "LotNumber", value: line.LotNumber },
        { name: "SerialNumber", value: line.SerialNumber },
        { name: "ExpirationDate", value: line.ExpirationDate },
        { name: "Notes", value: line.Notes },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async getPurchaseReceiptLines(
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string
  ): Promise<PurchaseReceiptLineResult[]> {
    const rows = await this.query<PurchaseReceiptLineRow>(
      `
        SELECT
          PurchaseReceiptLineId,
          PurchaseReceiptId,
          PurchaseReceiptNumber,
          PurchaseOrderId,
          PurchaseOrderNumber,
          PurchaseOrderLineId,
          LineNumber,
          ItemId,
          ItemCode,
          ItemDescription,
          WarehouseId,
          WarehouseCode,
          WarehouseName,
          UnitOfMeasureId,
          UnitOfMeasureCode,
          QuantityReceived,
          OrderedQuantity,
          UnitCost,
          LineTotal,
          LotNumber,
          SerialNumber,
          ExpirationDate,
          Notes
        FROM purchasing.V_PurchaseReceiptLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND PurchaseReceiptId = @PurchaseReceiptId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "PurchaseReceiptId", value: purchaseReceiptId }
      ]
    );

    return rows.map((row) => this.mapLine(row));
  }

  private async generateReceiptNumber(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput
  ) {
    return this.generateNumber(
      transaction,
      context,
      "REC",
      "purchasing.PurchaseReceipts",
      "PurchaseReceiptNumber"
    );
  }

  private async generateMovementNumber(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput
  ) {
    return this.generateNumber(
      transaction,
      context,
      "MOV-REC",
      "inventory.InventoryMovements",
      "MovementNumber"
    );
  }

  private async generateNumber(
    transaction: sql.Transaction,
    context: PurchaseReceiptContextInput,
    prefix: string,
    tableName: string,
    columnName: string
  ) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const documentNumber = this.buildDocumentNumber(prefix);
      const rows = await this.queryInTransaction<NumberRow>(
        transaction,
        `
          SELECT ${columnName} AS DocumentNumber
          FROM ${tableName} WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND ${columnName} = @DocumentNumber;
        `,
        [
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "DocumentNumber", value: documentNumber }
        ]
      );

      if (!rows[0]) {
        return documentNumber;
      }
    }

    throw new AppError({
      statusCode: 409,
      code: "PURCHASE_RECEIPT_NUMBER_COLLISION",
      message: "Could not generate a unique purchase receipt number.",
      isOperational: true
    });
  }

  private buildDocumentNumber(prefix: string) {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const suffix = randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();

    return `${prefix}-${timestamp.slice(0, 8)}-${timestamp.slice(8, 14)}-${suffix}`;
  }

  private mapReceipt(
    row: PurchaseReceiptSummaryRow,
    lines: PurchaseReceiptLineResult[]
  ): PurchaseReceiptResult {
    return {
      id: row.PurchaseReceiptId,
      purchaseReceiptNumber: row.PurchaseReceiptNumber,
      purchaseOrderId: row.PurchaseOrderId,
      purchaseOrderNumber: row.PurchaseOrderNumber,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
      inventoryMovementId: row.InventoryMovementId ?? undefined,
      movementNumber: row.MovementNumber ?? undefined,
      status: row.Status,
      receiptDate: row.ReceiptDate,
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      postedAt: row.PostedAt ?? undefined,
      lineCount: Number(row.LineCount),
      totalQuantityReceived: Number(row.TotalQuantityReceived),
      totalAmount: Number(row.TotalAmount),
      lines
    };
  }

  private mapLine(row: PurchaseReceiptLineRow): PurchaseReceiptLineResult {
    return {
      id: row.PurchaseReceiptLineId,
      purchaseReceiptId: row.PurchaseReceiptId,
      purchaseReceiptNumber: row.PurchaseReceiptNumber,
      purchaseOrderId: row.PurchaseOrderId,
      purchaseOrderNumber: row.PurchaseOrderNumber,
      purchaseOrderLineId: row.PurchaseOrderLineId,
      lineNumber: Number(row.LineNumber),
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      warehouseId: row.WarehouseId,
      warehouseCode: row.WarehouseCode,
      warehouseName: row.WarehouseName,
      unitOfMeasureId: row.UnitOfMeasureId ?? undefined,
      unitOfMeasureCode: row.UnitOfMeasureCode ?? undefined,
      quantityReceived: Number(row.QuantityReceived),
      orderedQuantity: Number(row.OrderedQuantity),
      unitCost: Number(row.UnitCost),
      lineTotal: Number(row.LineTotal),
      lotNumber: row.LotNumber ?? undefined,
      serialNumber: row.SerialNumber ?? undefined,
      expirationDate: row.ExpirationDate ?? undefined,
      notes: row.Notes ?? undefined
    };
  }
}

export const purchaseReceiptRepository = new PurchaseReceiptRepository();
