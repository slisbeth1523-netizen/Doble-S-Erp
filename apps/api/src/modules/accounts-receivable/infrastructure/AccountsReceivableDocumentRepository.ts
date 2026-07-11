import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, NotFoundError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  AccountsReceivableDocumentCreatePayload,
  AccountsReceivableDocumentListQuery,
  CustomerBalanceListQuery
} from "../validators/accounts-receivable-document.validators.js";

export type AccountsReceivableContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type AccountsReceivableDocumentCreateInput = AccountsReceivableContextInput &
  AccountsReceivableDocumentCreatePayload;

export type AccountsReceivableDocumentResult = {
  id: string;
  documentNumber: string;
  sourceType: string;
  sourceDocumentId?: string;
  sourceDocumentNumber?: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  documentDate: Date;
  dueDate: Date;
  currencyCode: string;
  exchangeRate: number;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysPastDue: number;
  reference?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
};

export type CustomerReceivableBalanceResult = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  totalDocumentAmount: number;
  totalPaidAmount: number;
  totalOpenAmount: number;
  overdueAmount: number;
  notDueAmount: number;
  openDocumentCount: number;
  overdueDocumentCount: number;
  lastDocumentDate?: Date;
};

type DocumentRow = {
  AccountsReceivableDocumentId: string;
  DocumentNumber: string;
  SourceType: string;
  SourceDocumentId: string | null;
  SourceDocumentNumber: string | null;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  DocumentDate: Date;
  DueDate: Date;
  CurrencyCode: string;
  ExchangeRate: number;
  Status: string;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
  DaysPastDue: number;
  Reference: string | null;
  Notes: string | null;
  IsActive: boolean;
  CreatedAt: Date;
};

type BalanceRow = {
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  TotalDocumentAmount: number;
  TotalPaidAmount: number;
  TotalOpenAmount: number;
  OverdueAmount: number;
  NotDueAmount: number;
  OpenDocumentCount: number;
  OverdueDocumentCount: number;
  LastDocumentDate: Date | null;
};

type CustomerRow = { CustomerId: string };
type CountRow = { TotalItems: number };

export class AccountsReceivableDocumentRepository extends BaseSqlRepository {
  async createDocument(input: AccountsReceivableDocumentCreateInput): Promise<AccountsReceivableDocumentResult> {
    const documentId = await this.executeInTransaction(async (transaction) => {
      await this.validateCustomer(transaction, input, input.customerId);

      const id = randomUUID();
      const documentDate = input.documentDate ? new Date(input.documentDate) : new Date();
      const dueDate = new Date(input.dueDate);
      const documentNumber = await this.generateDocumentNumber(transaction, input);

      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO ar.AccountsReceivableDocuments (
            AccountsReceivableDocumentId,
            TenantId,
            CompanyId,
            DocumentNumber,
            SourceType,
            SourceDocumentId,
            SourceDocumentNumber,
            CustomerId,
            DocumentDate,
            DueDate,
            CurrencyCode,
            ExchangeRate,
            Status,
            TotalAmount,
            PaidAmount,
            Reference,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @AccountsReceivableDocumentId,
            @TenantId,
            @CompanyId,
            @DocumentNumber,
            @SourceType,
            NULL,
            NULL,
            @CustomerId,
            @DocumentDate,
            @DueDate,
            @CurrencyCode,
            @ExchangeRate,
            'OPEN',
            @TotalAmount,
            0,
            @Reference,
            @Notes,
            1,
            @UserId
          );
        `,
        [
          { name: "AccountsReceivableDocumentId", value: id },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "DocumentNumber", value: documentNumber },
          { name: "SourceType", value: input.sourceType },
          { name: "CustomerId", value: input.customerId },
          { name: "DocumentDate", value: documentDate },
          { name: "DueDate", value: dueDate },
          { name: "CurrencyCode", value: input.currencyCode },
          { name: "ExchangeRate", value: input.exchangeRate ?? 1 },
          { name: "TotalAmount", value: input.totalAmount },
          { name: "Reference", value: input.reference ?? null },
          { name: "Notes", value: input.notes ?? null },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return id;
    });

    return this.getDocument(input, documentId);
  }

  async listDocuments(context: AccountsReceivableContextInput, query: AccountsReceivableDocumentListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = this.documentParameters(context, query, search, offset, pageSize);

    const [rows, counts] = await Promise.all([
      this.query<DocumentRow>(
        `
          SELECT
            AccountsReceivableDocumentId,
            DocumentNumber,
            SourceType,
            SourceDocumentId,
            SourceDocumentNumber,
            CustomerId,
            CustomerCode,
            CustomerName,
            DocumentDate,
            DueDate,
            CurrencyCode,
            ExchangeRate,
            Status,
            TotalAmount,
            PaidAmount,
            RemainingAmount,
            DaysPastDue,
            Reference,
            Notes,
            IsActive,
            CreatedAt
          FROM ar.V_AccountsReceivableDocumentSummary
          WHERE ${this.documentWhere()}
          ORDER BY DocumentDate DESC, DocumentNumber DESC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        parameters
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM ar.V_AccountsReceivableDocumentSummary
          WHERE ${this.documentWhere()};
        `,
        parameters
      )
    ]);

    const records = rows.map((row) => this.mapDocument(row));
    const totalItems = Number(counts[0]?.TotalItems ?? 0);

    return {
      records,
      summary: this.summarizeDocuments(records),
      pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) }
    };
  }

  async getDocument(context: AccountsReceivableContextInput, documentId: string): Promise<AccountsReceivableDocumentResult> {
    const rows = await this.query<DocumentRow>(
      `
        SELECT
          AccountsReceivableDocumentId,
          DocumentNumber,
          SourceType,
          SourceDocumentId,
          SourceDocumentNumber,
          CustomerId,
          CustomerCode,
          CustomerName,
          DocumentDate,
          DueDate,
          CurrencyCode,
          ExchangeRate,
          Status,
          TotalAmount,
          PaidAmount,
          RemainingAmount,
          DaysPastDue,
          Reference,
          Notes,
          IsActive,
          CreatedAt
        FROM ar.V_AccountsReceivableDocumentSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND AccountsReceivableDocumentId = @AccountsReceivableDocumentId;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "AccountsReceivableDocumentId", value: documentId }
      ]
    );

    const row = rows[0];
    if (!row) {
      throw new NotFoundError("Accounts receivable document not found.", { documentId }, "AR_DOCUMENT_NOT_FOUND");
    }

    return this.mapDocument(row);
  }

  async listCustomerBalances(context: AccountsReceivableContextInput, query: CustomerBalanceListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const search = query.search ? `%${query.search}%` : null;
    const parameters = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "Search", value: search },
      { name: "Offset", value: offset },
      { name: "PageSize", value: pageSize }
    ];
    const where = `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@Search IS NULL OR CustomerCode LIKE @Search OR CustomerName LIKE @Search)
    `;

    const [rows, counts] = await Promise.all([
      this.query<BalanceRow>(
        `
          SELECT
            CustomerId,
            CustomerCode,
            CustomerName,
            TotalDocumentAmount,
            TotalPaidAmount,
            TotalOpenAmount,
            OverdueAmount,
            NotDueAmount,
            OpenDocumentCount,
            OverdueDocumentCount,
            LastDocumentDate
          FROM ar.V_CustomerReceivableBalanceSummary
          WHERE ${where}
          ORDER BY CustomerName ASC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        parameters
      ),
      this.query<CountRow>(
        `
          SELECT COUNT(1) AS TotalItems
          FROM ar.V_CustomerReceivableBalanceSummary
          WHERE ${where};
        `,
        parameters
      )
    ]);

    const records = rows.map((row) => this.mapBalance(row));
    const totalItems = Number(counts[0]?.TotalItems ?? 0);

    return {
      records,
      summary: this.summarizeBalances(records),
      pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) }
    };
  }

  async getCustomerBalance(context: AccountsReceivableContextInput, customerId: string) {
    const result = await this.listCustomerBalances(context, { customerId, page: 1, pageSize: 1 });
    const record = result.records[0];

    if (!record) {
      throw new NotFoundError("Customer receivable balance not found.", { customerId }, "CUSTOMER_BALANCE_NOT_FOUND");
    }

    return record;
  }

  private documentWhere() {
    return `
      TenantId = @TenantId
      AND CompanyId = @CompanyId
      AND IsActive = 1
      AND (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@SourceType IS NULL OR SourceType = @SourceType)
      AND (@OverdueOnly = 0 OR DaysPastDue > 0)
      AND (@DateFrom IS NULL OR DocumentDate >= @DateFrom)
      AND (@DateTo IS NULL OR DocumentDate <= @DateTo)
      AND (@DueDateFrom IS NULL OR DueDate >= @DueDateFrom)
      AND (@DueDateTo IS NULL OR DueDate <= @DueDateTo)
      AND (
        @Search IS NULL
        OR DocumentNumber LIKE @Search
        OR SourceDocumentNumber LIKE @Search
        OR CustomerCode LIKE @Search
        OR CustomerName LIKE @Search
        OR Reference LIKE @Search
      )
    `;
  }

  private documentParameters(
    context: AccountsReceivableContextInput,
    query: AccountsReceivableDocumentListQuery,
    search: string | null,
    offset: number,
    pageSize: number
  ): SqlParameter[] {
    return [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "CustomerId", value: query.customerId ?? null },
      { name: "Status", value: query.status ?? null },
      { name: "SourceType", value: query.sourceType ?? null },
      { name: "OverdueOnly", value: query.overdueOnly === true ? 1 : 0 },
      { name: "DateFrom", value: query.dateFrom ? new Date(query.dateFrom) : null },
      { name: "DateTo", value: query.dateTo ? new Date(query.dateTo) : null },
      { name: "DueDateFrom", value: query.dueDateFrom ? new Date(query.dueDateFrom) : null },
      { name: "DueDateTo", value: query.dueDateTo ? new Date(query.dueDateTo) : null },
      { name: "Search", value: search },
      { name: "Offset", value: offset },
      { name: "PageSize", value: pageSize }
    ];
  }

  private async validateCustomer(
    transaction: sql.Transaction,
    context: AccountsReceivableContextInput,
    customerId: string
  ): Promise<CustomerRow> {
    const rows = await this.queryInTransaction<CustomerRow>(
      transaction,
      `
        SELECT CustomerId
        FROM crm.Customers WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND CustomerId = @CustomerId
          AND IsActive = 1;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "CustomerId", value: customerId }
      ]
    );

    const customer = rows[0];
    if (!customer) {
      throw new NotFoundError("Customer not found.", { customerId }, "CUSTOMER_NOT_FOUND");
    }

    return customer;
  }

  private async generateDocumentNumber(transaction: sql.Transaction, context: AccountsReceivableContextInput) {
    const datePart = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const rows = await this.queryInTransaction<{ NextNumber: number }>(
      transaction,
      `
        SELECT COUNT(1) + 1 AS NextNumber
        FROM ar.AccountsReceivableDocuments WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND DocumentNumber LIKE @Prefix;
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "Prefix", value: `CXC-${datePart}-%` }
      ]
    );

    const nextNumber = rows[0]?.NextNumber ?? 1;
    return `CXC-${datePart}-${String(nextNumber).padStart(4, "0")}`;
  }

  private summarizeDocuments(records: AccountsReceivableDocumentResult[]) {
    return records.reduce(
      (summary, record) => ({
        totalAmount: summary.totalAmount + record.totalAmount,
        paidAmount: summary.paidAmount + record.paidAmount,
        remainingAmount: summary.remainingAmount + record.remainingAmount,
        overdueAmount: summary.overdueAmount + (record.daysPastDue > 0 ? record.remainingAmount : 0),
        openDocumentCount: summary.openDocumentCount + (["OPEN", "PARTIALLY_PAID"].includes(record.status) ? 1 : 0),
        overdueDocumentCount: summary.overdueDocumentCount + (record.daysPastDue > 0 && record.remainingAmount > 0 ? 1 : 0)
      }),
      { totalAmount: 0, paidAmount: 0, remainingAmount: 0, overdueAmount: 0, openDocumentCount: 0, overdueDocumentCount: 0 }
    );
  }

  private summarizeBalances(records: CustomerReceivableBalanceResult[]) {
    return records.reduce(
      (summary, record) => ({
        totalDocumentAmount: summary.totalDocumentAmount + record.totalDocumentAmount,
        totalPaidAmount: summary.totalPaidAmount + record.totalPaidAmount,
        totalOpenAmount: summary.totalOpenAmount + record.totalOpenAmount,
        overdueAmount: summary.overdueAmount + record.overdueAmount,
        notDueAmount: summary.notDueAmount + record.notDueAmount,
        openDocumentCount: summary.openDocumentCount + record.openDocumentCount,
        overdueDocumentCount: summary.overdueDocumentCount + record.overdueDocumentCount
      }),
      {
        totalDocumentAmount: 0,
        totalPaidAmount: 0,
        totalOpenAmount: 0,
        overdueAmount: 0,
        notDueAmount: 0,
        openDocumentCount: 0,
        overdueDocumentCount: 0
      }
    );
  }

  private mapDocument(row: DocumentRow): AccountsReceivableDocumentResult {
    return {
      id: row.AccountsReceivableDocumentId,
      documentNumber: row.DocumentNumber,
      sourceType: row.SourceType,
      sourceDocumentId: row.SourceDocumentId ?? undefined,
      sourceDocumentNumber: row.SourceDocumentNumber ?? undefined,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      documentDate: row.DocumentDate,
      dueDate: row.DueDate,
      currencyCode: row.CurrencyCode,
      exchangeRate: Number(row.ExchangeRate ?? 0),
      status: row.Status,
      totalAmount: Number(row.TotalAmount ?? 0),
      paidAmount: Number(row.PaidAmount ?? 0),
      remainingAmount: Number(row.RemainingAmount ?? 0),
      daysPastDue: Number(row.DaysPastDue ?? 0),
      reference: row.Reference ?? undefined,
      notes: row.Notes ?? undefined,
      isActive: Boolean(row.IsActive),
      createdAt: row.CreatedAt
    };
  }

  private mapBalance(row: BalanceRow): CustomerReceivableBalanceResult {
    return {
      id: row.CustomerId,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      totalDocumentAmount: Number(row.TotalDocumentAmount ?? 0),
      totalPaidAmount: Number(row.TotalPaidAmount ?? 0),
      totalOpenAmount: Number(row.TotalOpenAmount ?? 0),
      overdueAmount: Number(row.OverdueAmount ?? 0),
      notDueAmount: Number(row.NotDueAmount ?? 0),
      openDocumentCount: Number(row.OpenDocumentCount ?? 0),
      overdueDocumentCount: Number(row.OverdueDocumentCount ?? 0),
      lastDocumentDate: row.LastDocumentDate ?? undefined
    };
  }

  private async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    try {
      const request = new sql.Request(transaction);

      for (const parameter of parameters) {
        request.input(parameter.name, parameter.value);
      }

      const result = await request.query<TRecord>(sqlText);
      return result.recordset;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw error;
    }
  }
}

export const accountsReceivableDocumentRepository = new AccountsReceivableDocumentRepository();
