import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  SupplierInvoiceCreatePayload,
  SupplierInvoiceLineCreatePayload,
  SupplierInvoiceListQuery
} from "../validators/supplier-invoice.validators.js";

export type SupplierInvoiceStatus = "DRAFT" | "POSTED";

export type SupplierInvoiceContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type SupplierInvoiceCreateInput = SupplierInvoiceContextInput & SupplierInvoiceCreatePayload;
export type SupplierInvoiceLineCreateInput = SupplierInvoiceContextInput & SupplierInvoiceLineCreatePayload;

export type SupplierInvoiceLineResult = {
  id: string;
  supplierInvoiceId: string;
  supplierInvoiceNumber: string;
  lineNumber: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  unitOfMeasureId?: string;
  unitOfMeasureCode?: string;
  quantity: number;
  unitCost: number;
  taxAmount: number;
  lineTotal: number;
  notes?: string;
};

export type SupplierInvoiceResult = {
  id: string;
  supplierInvoiceNumber: string;
  purchaseReceiptId: string;
  purchaseReceiptNumber: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  status: SupplierInvoiceStatus;
  invoiceDate: Date;
  dueDate: Date;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  reference?: string;
  notes?: string;
  postedAt?: Date;
  lineCount: number;
  lines: SupplierInvoiceLineResult[];
};

type SupplierInvoiceSummaryRow = {
  SupplierInvoiceId: string;
  TenantId: string;
  CompanyId: string;
  SupplierInvoiceNumber: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  PurchaseReceiptId: string;
  PurchaseReceiptNumber: string;
  InvoiceDate: Date;
  DueDate: Date;
  Status: SupplierInvoiceStatus;
  SubTotal: number;
  TaxAmount: number;
  TotalAmount: number;
  Reference: string | null;
  Notes: string | null;
  PostedAt: Date | null;
  LineCount: number;
};

type SupplierInvoiceLineRow = {
  SupplierInvoiceLineId: string;
  SupplierInvoiceId: string;
  SupplierInvoiceNumber: string;
  TenantId: string;
  CompanyId: string;
  LineNumber: number;
  ItemId: string;
  ItemCode: string;
  ItemDescription: string;
  UnitOfMeasureId: string | null;
  UnitOfMeasureCode: string | null;
  Quantity: number;
  UnitCost: number;
  TaxAmount: number;
  LineTotal: number;
  Notes: string | null;
};

type ReceiptLockRow = {
  PurchaseReceiptId: string;
  PurchaseReceiptNumber: string;
  SupplierId: string;
  Status: string;
};

type ReceiptLineRow = {
  PurchaseReceiptLineId: string;
  ItemId: string;
  QuantityReceived: number;
  UnitCost: number;
};

type InvoiceLockRow = {
  SupplierInvoiceId: string;
  Status: SupplierInvoiceStatus;
  PurchaseReceiptId: string;
  SupplierInvoiceNumber: string;
  SupplierId: string;
  TotalAmount: number;
  InvoiceDate: Date;
  DueDate: Date;
  Notes: string | null;
};

export class SupplierInvoiceRepository extends BaseSqlRepository {
  async createSupplierInvoice(input: SupplierInvoiceCreateInput): Promise<SupplierInvoiceResult> {
    const supplierInvoiceId = await this.executeInTransaction(async (transaction) => {
      // 1. Lock and validate the Purchase Receipt
      const receipt = await this.lockPostedPurchaseReceipt(transaction, input, input.purchaseReceiptId);

      // 2. Validate duplicate invoice number for the company
      const exists = await this.checkInvoiceNumberExists(transaction, input, input.supplierInvoiceNumber);
      if (exists) {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_INVOICE_NUMBER_ALREADY_EXISTS",
          message: `Supplier invoice number ${input.supplierInvoiceNumber} is already registered.`,
          isOperational: true
        });
      }

      const invoiceId = randomUUID();
      const invoiceDate = input.invoiceDate ? new Date(input.invoiceDate) : new Date();
      const dueDate = input.dueDate ? new Date(input.dueDate) : new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days default

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO purchasing.SupplierInvoices (
            SupplierInvoiceId,
            TenantId,
            CompanyId,
            SupplierInvoiceNumber,
            SupplierId,
            PurchaseReceiptId,
            InvoiceDate,
            DueDate,
            Status,
            SubTotal,
            TaxAmount,
            TotalAmount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SupplierInvoiceId,
            @TenantId,
            @CompanyId,
            @SupplierInvoiceNumber,
            @SupplierId,
            @PurchaseReceiptId,
            @InvoiceDate,
            @DueDate,
            'DRAFT',
            0,
            0,
            0,
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "SupplierInvoiceId", value: invoiceId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "SupplierInvoiceNumber", value: input.supplierInvoiceNumber },
          { name: "SupplierId", value: receipt.SupplierId },
          { name: "PurchaseReceiptId", value: receipt.PurchaseReceiptId },
          { name: "InvoiceDate", value: invoiceDate },
          { name: "DueDate", value: dueDate },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return invoiceId;
    });

    return this.getSupplierInvoice(input, supplierInvoiceId);
  }

  async listSupplierInvoices(
    context: SupplierInvoiceContextInput,
    query: SupplierInvoiceListQuery
  ): Promise<SupplierInvoiceResult[]> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;

    const rows = await this.query<SupplierInvoiceSummaryRow>(
      `
        SELECT
          SupplierInvoiceId,
          TenantId,
          CompanyId,
          SupplierInvoiceNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          PurchaseReceiptId,
          PurchaseReceiptNumber,
          InvoiceDate,
          DueDate,
          Status,
          SubTotal,
          TaxAmount,
          TotalAmount,
          Reference,
          Notes,
          PostedAt,
          LineCount
        FROM purchasing.V_SupplierInvoiceSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND (@Status IS NULL OR Status = @Status)
          AND (
            @Search IS NULL
            OR SupplierInvoiceNumber LIKE @Search
            OR PurchaseReceiptNumber LIKE @Search
            OR SupplierCode LIKE @Search
            OR SupplierName LIKE @Search
            OR Reference LIKE @Search
          )
        ORDER BY InvoiceDate DESC, SupplierInvoiceNumber DESC
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

    return rows.map((row) => this.mapInvoice(row, []));
  }

  async getSupplierInvoice(
    context: SupplierInvoiceContextInput,
    supplierInvoiceId: string
  ): Promise<SupplierInvoiceResult> {
    const rows = await this.query<SupplierInvoiceSummaryRow>(
      `
        SELECT
          SupplierInvoiceId,
          TenantId,
          CompanyId,
          SupplierInvoiceNumber,
          SupplierId,
          SupplierCode,
          SupplierName,
          PurchaseReceiptId,
          PurchaseReceiptNumber,
          InvoiceDate,
          DueDate,
          Status,
          SubTotal,
          TaxAmount,
          TotalAmount,
          Reference,
          Notes,
          PostedAt,
          LineCount
        FROM purchasing.V_SupplierInvoiceSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierInvoiceId = @SupplierInvoiceId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierInvoiceId", value: supplierInvoiceId }
      ]
    );

    const row = rows[0];

    if (!row) {
      throw new NotFoundError(
        "Supplier invoice not found.",
        { supplierInvoiceId },
        "SUPPLIER_INVOICE_NOT_FOUND"
      );
    }

    const lines = await this.getSupplierInvoiceLines(context, supplierInvoiceId);
    return this.mapInvoice(row, lines);
  }

  async addSupplierInvoiceLine(
    context: SupplierInvoiceContextInput,
    supplierInvoiceId: string,
    payload: SupplierInvoiceLineCreatePayload
  ): Promise<SupplierInvoiceResult> {
    await this.executeInTransaction(async (transaction) => {
      // 1. Lock invoice
      const invoice = await this.lockInvoice(transaction, context, supplierInvoiceId);
      if (invoice.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_INVOICE_INVALID_STATUS",
          message: "Lines can only be added to DRAFT supplier invoices.",
          isOperational: true
        });
      }

      // 2. Validate against Purchase Receipt Lines
      const receiptLines = await this.queryInTransaction<ReceiptLineRow>(
        transaction,
        `
          SELECT PurchaseReceiptLineId, ItemId, QuantityReceived, UnitCost
          FROM purchasing.PurchaseReceiptLines WITH (UPDLOCK, HOLDLOCK)
          WHERE PurchaseReceiptId = @PurchaseReceiptId
            AND ItemId = @ItemId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "PurchaseReceiptId", value: invoice.PurchaseReceiptId },
          { name: "ItemId", value: payload.itemId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      const receiptLine = receiptLines[0];
      if (!receiptLine) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_INVOICE_ITEM_NOT_IN_RECEIPT",
          message: "The selected item does not exist in the referenced purchase receipt.",
          isOperational: true
        });
      }

      // 3. Check cumulative invoiced quantity limit
      const invoicedQtyRows = await this.queryInTransaction<{ InvoicedQty: number }>(
        transaction,
        `
          SELECT COALESCE(SUM(sil.Quantity), 0) AS InvoicedQty
          FROM purchasing.SupplierInvoiceLines sil
          INNER JOIN purchasing.SupplierInvoices si ON sil.SupplierInvoiceId = si.SupplierInvoiceId
          WHERE si.PurchaseReceiptId = @PurchaseReceiptId
            AND sil.ItemId = @ItemId
            AND si.TenantId = @TenantId
            AND si.CompanyId = @CompanyId;
        `,
        [
          { name: "PurchaseReceiptId", value: invoice.PurchaseReceiptId },
          { name: "ItemId", value: payload.itemId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      const cumulativeInvoiced = invoicedQtyRows[0]?.InvoicedQty ?? 0;
      if (cumulativeInvoiced + payload.quantity > receiptLine.QuantityReceived) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_INVOICE_QUANTITY_EXCEEDS_RECEIPT",
          message: `Invoiced quantity (${payload.quantity}) plus previously invoiced (${cumulativeInvoiced}) exceeds the total received quantity (${receiptLine.QuantityReceived}) for this item.`,
          isOperational: true
        });
      }

      // 4. Get next line number
      const lineNumRows = await this.queryInTransaction<{ NextLine: number }>(
        transaction,
        `
          SELECT COALESCE(MAX(LineNumber), 0) + 1 AS NextLine
          FROM purchasing.SupplierInvoiceLines
          WHERE SupplierInvoiceId = @SupplierInvoiceId;
        `,
        [{ name: "SupplierInvoiceId", value: supplierInvoiceId }]
      );
      const nextLineNumber = lineNumRows[0]?.NextLine ?? 1;

      // 5. Insert line
      const taxAmount = payload.taxAmount ?? 0;
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO purchasing.SupplierInvoiceLines (
            SupplierInvoiceLineId,
            SupplierInvoiceId,
            TenantId,
            CompanyId,
            LineNumber,
            ItemId,
            UnitOfMeasureId,
            Quantity,
            UnitCost,
            TaxAmount,
            Notes,
            CreatedBy
          )
          VALUES (
            @SupplierInvoiceLineId,
            @SupplierInvoiceId,
            @TenantId,
            @CompanyId,
            @LineNumber,
            @ItemId,
            @UnitOfMeasureId,
            @Quantity,
            @UnitCost,
            @TaxAmount,
            @Notes,
            @UserId
          );
        `,
        [
          { name: "SupplierInvoiceLineId", value: randomUUID() },
          { name: "SupplierInvoiceId", value: supplierInvoiceId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "LineNumber", value: nextLineNumber },
          { name: "ItemId", value: payload.itemId },
          { name: "UnitOfMeasureId", value: payload.unitOfMeasureId ?? null },
          { name: "Quantity", value: payload.quantity },
          { name: "UnitCost", value: payload.unitCost },
          { name: "TaxAmount", value: taxAmount },
          { name: "Notes", value: payload.notes ?? null },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      // 6. Recalculate totals
      await this.queryInTransaction(
        transaction,
        `
          UPDATE purchasing.SupplierInvoices
          SET SubTotal = COALESCE((SELECT SUM(Quantity * UnitCost) FROM purchasing.SupplierInvoiceLines WHERE SupplierInvoiceId = @SupplierInvoiceId), 0),
              TaxAmount = COALESCE((SELECT SUM(TaxAmount) FROM purchasing.SupplierInvoiceLines WHERE SupplierInvoiceId = @SupplierInvoiceId), 0),
              TotalAmount = COALESCE((SELECT SUM(LineTotal) FROM purchasing.SupplierInvoiceLines WHERE SupplierInvoiceId = @SupplierInvoiceId), 0),
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SupplierInvoiceId = @SupplierInvoiceId;
        `,
        [
          { name: "SupplierInvoiceId", value: supplierInvoiceId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getSupplierInvoice(context, supplierInvoiceId);
  }

  async completeSupplierInvoice(
    context: SupplierInvoiceContextInput,
    supplierInvoiceId: string
  ): Promise<SupplierInvoiceResult> {
    await this.executeInTransaction(async (transaction) => {
      // 1. Lock invoice header
      const invoice = await this.lockInvoice(transaction, context, supplierInvoiceId);
      if (invoice.Status !== "DRAFT") {
        throw new AppError({
          statusCode: 409,
          code: "SUPPLIER_INVOICE_ALREADY_POSTED",
          message: "Supplier invoice is already posted.",
          isOperational: true
        });
      }

      // 2. Lock invoice lines
      const lines = await this.queryInTransaction<SupplierInvoiceLineRow>(
        transaction,
        `
          SELECT SupplierInvoiceLineId, ItemId, Quantity, UnitCost, TaxAmount
          FROM purchasing.SupplierInvoiceLines WITH (UPDLOCK, HOLDLOCK)
          WHERE SupplierInvoiceId = @SupplierInvoiceId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SupplierInvoiceId", value: supplierInvoiceId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId }
        ]
      );

      if (!lines.length) {
        throw new AppError({
          statusCode: 400,
          code: "SUPPLIER_INVOICE_HAS_NO_LINES",
          message: "Supplier invoice has no lines to complete.",
          isOperational: true
        });
      }

      // 3. Perform final verification check for quantities against Purchase Receipt
      for (const line of lines) {
        const receiptLines = await this.queryInTransaction<ReceiptLineRow>(
          transaction,
          `
            SELECT QuantityReceived
            FROM purchasing.PurchaseReceiptLines WITH (UPDLOCK, HOLDLOCK)
            WHERE PurchaseReceiptId = @PurchaseReceiptId
              AND ItemId = @ItemId
              AND TenantId = @TenantId
              AND CompanyId = @CompanyId;
          `,
          [
            { name: "PurchaseReceiptId", value: invoice.PurchaseReceiptId },
            { name: "ItemId", value: line.ItemId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId }
          ]
        );

        const receiptLine = receiptLines[0];
        if (!receiptLine) {
          throw new AppError({
            statusCode: 400,
            code: "SUPPLIER_INVOICE_POST_ITEM_NOT_IN_RECEIPT",
            message: `Item ${line.ItemId} does not exist in the referenced purchase receipt.`,
            isOperational: true
          });
        }

        const invoicedQtyRows = await this.queryInTransaction<{ InvoicedQty: number }>(
          transaction,
          `
            SELECT COALESCE(SUM(sil.Quantity), 0) AS InvoicedQty
            FROM purchasing.SupplierInvoiceLines sil
            INNER JOIN purchasing.SupplierInvoices si ON sil.SupplierInvoiceId = si.SupplierInvoiceId
            WHERE si.PurchaseReceiptId = @PurchaseReceiptId
              AND sil.ItemId = @ItemId
              AND si.TenantId = @TenantId
              AND si.CompanyId = @CompanyId
              AND si.SupplierInvoiceId <> @SupplierInvoiceId;
          `,
          [
            { name: "PurchaseReceiptId", value: invoice.PurchaseReceiptId },
            { name: "ItemId", value: line.ItemId },
            { name: "TenantId", value: context.tenantId },
            { name: "CompanyId", value: context.companyId },
            { name: "SupplierInvoiceId", value: supplierInvoiceId }
          ]
        );

        const previouslyInvoiced = invoicedQtyRows[0]?.InvoicedQty ?? 0;
        if (previouslyInvoiced + line.Quantity > receiptLine.QuantityReceived) {
          throw new AppError({
            statusCode: 400,
            code: "SUPPLIER_INVOICE_POST_QUANTITY_EXCEEDS_RECEIPT",
            message: `Posting failed: Total quantity invoiced (${previouslyInvoiced + line.Quantity}) exceeds received quantity (${receiptLine.QuantityReceived}) for Item ${line.ItemId}.`,
            isOperational: true
          });
        }
      }

      // 4. Create CxP pending document
      const cxpId = randomUUID();
      const cxpNumber = `CXP-${invoice.SupplierInvoiceNumber}`;

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ap.AccountsPayableDocuments (
            AccountsPayableDocumentId,
            TenantId,
            CompanyId,
            DocumentNumber,
            SupplierId,
            SourceModule,
            SourceDocumentId,
            SourceDocumentNumber,
            DocumentDate,
            DueDate,
            TotalAmount,
            PaidAmount,
            Status,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @AccountsPayableDocumentId,
            @TenantId,
            @CompanyId,
            @DocumentNumber,
            @SupplierId,
            'PURCHASING',
            @SourceDocumentId,
            @SourceDocumentNumber,
            @DocumentDate,
            @DueDate,
            @TotalAmount,
            0,
            'OPEN',
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "AccountsPayableDocumentId", value: cxpId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "DocumentNumber", value: cxpNumber },
          { name: "SupplierId", value: invoice.SupplierId },
          { name: "SourceDocumentId", value: supplierInvoiceId },
          { name: "SourceDocumentNumber", value: invoice.SupplierInvoiceNumber },
          { name: "DocumentDate", value: invoice.InvoiceDate },
          { name: "DueDate", value: invoice.DueDate },
          { name: "TotalAmount", value: invoice.TotalAmount },
          { name: "Notes", value: invoice.Notes },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      // 5. Update invoice status to POSTED
      await this.queryInTransaction(
        transaction,
        `
          UPDATE purchasing.SupplierInvoices
          SET Status = 'POSTED',
              PostedAt = SYSUTCDATETIME(),
              PostedBy = @UserId,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE SupplierInvoiceId = @SupplierInvoiceId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "SupplierInvoiceId", value: supplierInvoiceId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
    });

    return this.getSupplierInvoice(context, supplierInvoiceId);
  }

  private async lockPostedPurchaseReceipt(
    transaction: sql.Transaction,
    context: SupplierInvoiceContextInput,
    purchaseReceiptId: string
  ): Promise<ReceiptLockRow> {
    const rows = await this.queryInTransaction<ReceiptLockRow>(
      transaction,
      `
        SELECT PurchaseReceiptId, PurchaseReceiptNumber, SupplierId, Status
        FROM purchasing.PurchaseReceipts WITH (UPDLOCK, HOLDLOCK)
        WHERE PurchaseReceiptId = @PurchaseReceiptId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "PurchaseReceiptId", value: purchaseReceiptId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const receipt = rows[0];
    if (!receipt) {
      throw new NotFoundError(
        "Referenced purchase receipt not found.",
        { purchaseReceiptId },
        "PURCHASE_RECEIPT_NOT_FOUND"
      );
    }

    if (receipt.Status !== "POSTED") {
      throw new AppError({
        statusCode: 400,
        code: "PURCHASE_RECEIPT_NOT_POSTED",
        message: "Supplier invoices can only be created from completed/posted purchase receipts.",
        isOperational: true
      });
    }

    return receipt;
  }

  private async checkInvoiceNumberExists(
    transaction: sql.Transaction,
    context: SupplierInvoiceContextInput,
    invoiceNumber: string
  ): Promise<boolean> {
    const rows = await this.queryInTransaction<{ Exists: number }>(
      transaction,
      `
        SELECT 1 AS [Exists]
        FROM purchasing.SupplierInvoices
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierInvoiceNumber = @SupplierInvoiceNumber;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierInvoiceNumber", value: invoiceNumber }
      ]
    );

    return rows.length > 0;
  }

  private async lockInvoice(
    transaction: sql.Transaction,
    context: SupplierInvoiceContextInput,
    supplierInvoiceId: string
  ): Promise<InvoiceLockRow> {
    const rows = await this.queryInTransaction<InvoiceLockRow>(
      transaction,
      `
        SELECT SupplierInvoiceId, Status, PurchaseReceiptId, SupplierInvoiceNumber, SupplierId, TotalAmount, InvoiceDate, DueDate, Notes
        FROM purchasing.SupplierInvoices WITH (UPDLOCK, HOLDLOCK)
        WHERE SupplierInvoiceId = @SupplierInvoiceId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "SupplierInvoiceId", value: supplierInvoiceId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    const invoice = rows[0];
    if (!invoice) {
      throw new NotFoundError(
        "Supplier invoice not found.",
        { supplierInvoiceId },
        "SUPPLIER_INVOICE_NOT_FOUND"
      );
    }

    return invoice;
  }

  private async getSupplierInvoiceLines(
    context: SupplierInvoiceContextInput,
    supplierInvoiceId: string
  ): Promise<SupplierInvoiceLineResult[]> {
    const rows = await this.query<SupplierInvoiceLineRow>(
      `
        SELECT
          SupplierInvoiceLineId,
          SupplierInvoiceId,
          SupplierInvoiceNumber,
          TenantId,
          CompanyId,
          LineNumber,
          ItemId,
          ItemCode,
          ItemDescription,
          UnitOfMeasureId,
          UnitOfMeasureCode,
          Quantity,
          UnitCost,
          TaxAmount,
          LineTotal,
          Notes
        FROM purchasing.V_SupplierInvoiceLineSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SupplierInvoiceId = @SupplierInvoiceId
        ORDER BY LineNumber ASC;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "SupplierInvoiceId", value: supplierInvoiceId }
      ]
    );

    return rows.map((row) => ({
      id: row.SupplierInvoiceLineId,
      supplierInvoiceId: row.SupplierInvoiceId,
      supplierInvoiceNumber: row.SupplierInvoiceNumber,
      lineNumber: row.LineNumber,
      itemId: row.ItemId,
      itemCode: row.ItemCode,
      itemDescription: row.ItemDescription,
      unitOfMeasureId: row.UnitOfMeasureId ?? undefined,
      unitOfMeasureCode: row.UnitOfMeasureCode ?? undefined,
      quantity: Number(row.Quantity),
      unitCost: Number(row.UnitCost),
      taxAmount: Number(row.TaxAmount),
      lineTotal: Number(row.LineTotal),
      notes: row.Notes ?? undefined
    }));
  }

  private mapInvoice(row: SupplierInvoiceSummaryRow, lines: SupplierInvoiceLineResult[]): SupplierInvoiceResult {
    return {
      id: row.SupplierInvoiceId,
      supplierInvoiceNumber: row.SupplierInvoiceNumber,
      purchaseReceiptId: row.PurchaseReceiptId,
      purchaseReceiptNumber: row.PurchaseReceiptNumber,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
      status: row.Status,
      invoiceDate: row.InvoiceDate,
      dueDate: row.DueDate,
      subTotal: Number(row.SubTotal),
      taxAmount: Number(row.TaxAmount),
      totalAmount: Number(row.TotalAmount),
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      postedAt: row.PostedAt ?? undefined,
      lineCount: row.LineCount,
      lines
    };
  }

  private async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    const request = new sql.Request(transaction);

    for (const p of parameters) {
      request.input(p.name, p.value);
    }

    const result = await request.query(sqlText);
    return result.recordset as TRecord[];
  }
}

export const supplierInvoiceRepository = new SupplierInvoiceRepository();
