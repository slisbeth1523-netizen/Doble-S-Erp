import type { CustomerAgingQuery, CustomerStatementQuery } from "../validators/customer-statement.validators.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";

export type CustomerStatementContextInput = {
  tenantId: string;
  companyId: string;
};

export type CustomerStatementDetail = {
  id: string;
  accountsReceivableDocumentId: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  documentNumber: string;
  sourceDocumentNumber?: string;
  sourceType: string;
  documentDate: Date;
  dueDate: Date;
  currencyCode: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysPastDue: number;
  agingBucket: string;
  reference?: string;
  createdAt: Date;
};

export type CustomerAgingSummary = {
  id: string;
  customerId: string;
  customerCode: string;
  customerName: string;
  currentAmount: number;
  days1To30Amount: number;
  days31To60Amount: number;
  days61To90Amount: number;
  daysOver90Amount: number;
  totalOpenAmount: number;
  overdueAmount: number;
  notDueAmount: number;
  openDocumentCount: number;
  overdueDocumentCount: number;
};

type StatementRow = {
  AccountsReceivableDocumentId: string;
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  DocumentNumber: string;
  SourceDocumentNumber: string | null;
  SourceType: string;
  DocumentDate: Date;
  DueDate: Date;
  CurrencyCode: string;
  Status: string;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
  DaysPastDue: number;
  AgingBucket: string;
  Reference: string | null;
  CreatedAt: Date;
};

type AgingRow = {
  CustomerId: string;
  CustomerCode: string;
  CustomerName: string;
  CurrentAmount: number;
  Days1To30Amount: number;
  Days31To60Amount: number;
  Days61To90Amount: number;
  DaysOver90Amount: number;
  TotalOpenAmount: number;
  OverdueAmount: number;
  NotDueAmount: number;
  OpenDocumentCount: number;
  OverdueDocumentCount: number;
};

type CountRow = { TotalItems: number };

type StatementSummaryRow = {
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
  OverdueAmount: number;
  NotDueAmount: number;
  DocumentCount: number;
  OpenDocumentCount: number;
};

type AgingSummaryRow = {
  CurrentAmount: number;
  Days1To30Amount: number;
  Days31To60Amount: number;
  Days61To90Amount: number;
  DaysOver90Amount: number;
  TotalOpenAmount: number;
  OverdueAmount: number;
  NotDueAmount: number;
  OpenDocumentCount: number;
  OverdueDocumentCount: number;
};

const openStatuses = "'OPEN', 'PARTIALLY_PAID'";

export class CustomerStatementRepository extends BaseSqlRepository {
  async listStatementDetails(context: CustomerStatementContextInput, query: CustomerStatementQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const asOfDate = this.resolveAsOfDate(query.asOfDate);
    const search = query.search ? `%${query.search}%` : null;
    const customerId = query.customerId ?? null;
    const status = query.status ?? null;
    const agingBucket = query.agingBucket ?? null;
    const overdueOnly = query.overdueOnly === true;
    const parameters = this.statementParameters(context, {
      asOfDate,
      search,
      customerId,
      status,
      agingBucket,
      overdueOnly,
      offset,
      pageSize
    });

    const [rows, counts, summaries] = await Promise.all([
      this.query<StatementRow>(
        `
          ${this.statementCte()}
          SELECT
            AccountsReceivableDocumentId,
            CustomerId,
            CustomerCode,
            CustomerName,
            DocumentNumber,
            SourceDocumentNumber,
            SourceType,
            DocumentDate,
            DueDate,
            CurrencyCode,
            Status,
            TotalAmount,
            PaidAmount,
            RemainingAmount,
            DaysPastDue,
            AgingBucket,
            Reference,
            CreatedAt
          FROM statement_documents
          WHERE ${this.statementWhere()}
          ORDER BY CustomerName ASC, DocumentDate ASC, DocumentNumber ASC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        parameters
      ),
      this.query<CountRow>(
        `
          ${this.statementCte()}
          SELECT COUNT(1) AS TotalItems
          FROM statement_documents
          WHERE ${this.statementWhere()};
        `,
        parameters
      ),
      this.query<StatementSummaryRow>(
        `
          ${this.statementCte()}
          SELECT
            COALESCE(SUM(TotalAmount), 0) AS TotalAmount,
            COALESCE(SUM(PaidAmount), 0) AS PaidAmount,
            COALESCE(SUM(RemainingAmount), 0) AS RemainingAmount,
            COALESCE(SUM(CASE WHEN DaysPastDue > 0 THEN RemainingAmount ELSE 0 END), 0) AS OverdueAmount,
            COALESCE(SUM(CASE WHEN DaysPastDue = 0 THEN RemainingAmount ELSE 0 END), 0) AS NotDueAmount,
            COUNT(1) AS DocumentCount,
            COALESCE(SUM(CASE WHEN Status IN ('OPEN', 'PARTIALLY_PAID') AND RemainingAmount > 0 THEN 1 ELSE 0 END), 0) AS OpenDocumentCount
          FROM statement_documents
          WHERE ${this.statementWhere()};
        `,
        parameters
      )
    ]);

    const totalItems = Number(counts[0]?.TotalItems ?? 0);

    return {
      asOfDate,
      records: rows.map((row) => this.mapStatement(row)),
      summary: this.mapStatementSummary(summaries[0]),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async getCustomerStatement(context: CustomerStatementContextInput, customerId: string, query: CustomerStatementQuery) {
    return this.listStatementDetails(context, { ...query, customerId });
  }

  async listAging(context: CustomerStatementContextInput, query: CustomerAgingQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const asOfDate = this.resolveAsOfDate(query.asOfDate);
    const search = query.search ? `%${query.search}%` : null;
    const customerId = query.customerId ?? null;
    const parameters = this.agingParameters(context, { asOfDate, search, customerId, offset, pageSize });

    const [rows, counts, summaries] = await Promise.all([
      this.query<AgingRow>(
        `
          ${this.agingCte()}
          SELECT
            CustomerId,
            CustomerCode,
            CustomerName,
            CurrentAmount,
            Days1To30Amount,
            Days31To60Amount,
            Days61To90Amount,
            DaysOver90Amount,
            TotalOpenAmount,
            OverdueAmount,
            NotDueAmount,
            OpenDocumentCount,
            OverdueDocumentCount
          FROM customer_aging
          WHERE ${this.agingWhere()}
          ORDER BY CustomerName ASC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        parameters
      ),
      this.query<CountRow>(
        `
          ${this.agingCte()}
          SELECT COUNT(1) AS TotalItems
          FROM customer_aging
          WHERE ${this.agingWhere()};
        `,
        parameters
      ),
      this.query<AgingSummaryRow>(
        `
          ${this.agingCte()}
          SELECT
            COALESCE(SUM(CurrentAmount), 0) AS CurrentAmount,
            COALESCE(SUM(Days1To30Amount), 0) AS Days1To30Amount,
            COALESCE(SUM(Days31To60Amount), 0) AS Days31To60Amount,
            COALESCE(SUM(Days61To90Amount), 0) AS Days61To90Amount,
            COALESCE(SUM(DaysOver90Amount), 0) AS DaysOver90Amount,
            COALESCE(SUM(TotalOpenAmount), 0) AS TotalOpenAmount,
            COALESCE(SUM(OverdueAmount), 0) AS OverdueAmount,
            COALESCE(SUM(NotDueAmount), 0) AS NotDueAmount,
            COALESCE(SUM(OpenDocumentCount), 0) AS OpenDocumentCount,
            COALESCE(SUM(OverdueDocumentCount), 0) AS OverdueDocumentCount
          FROM customer_aging
          WHERE ${this.agingWhere()};
        `,
        parameters
      )
    ]);

    const records = rows.map((row) => this.mapAging(row));
    const totalItems = Number(counts[0]?.TotalItems ?? 0);

    return {
      asOfDate,
      records,
      summary: this.mapAgingSummary(summaries[0]),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async getCustomerAging(context: CustomerStatementContextInput, customerId: string, query: CustomerAgingQuery) {
    return this.listAging(context, { ...query, customerId });
  }

  private resolveAsOfDate(value?: string) {
    return value ?? new Date().toISOString().slice(0, 10);
  }

  private statementCte() {
    return `
      WITH statement_documents AS (
        SELECT
          document.AccountsReceivableDocumentId,
          document.TenantId,
          document.CompanyId,
          document.CustomerId,
          customer.Code AS CustomerCode,
          customer.Name AS CustomerName,
          document.DocumentNumber,
          document.SourceDocumentNumber,
          document.SourceType AS SourceType,
          document.DocumentDate,
          document.DueDate,
          document.CurrencyCode,
          document.Status,
          document.TotalAmount,
          document.PaidAmount,
          document.RemainingAmount,
          CASE
            WHEN CAST(document.DueDate AS date) >= @AsOfDate THEN 0
            ELSE DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate)
          END AS DaysPastDue,
          CASE
            WHEN CAST(document.DueDate AS date) >= @AsOfDate THEN 'CURRENT'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 1 AND 30 THEN '1-30'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 31 AND 60 THEN '31-60'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 61 AND 90 THEN '61-90'
            ELSE '90+'
          END AS AgingBucket,
          document.Reference,
          document.CreatedAt
        FROM ar.AccountsReceivableDocuments document
        INNER JOIN crm.Customers customer
          ON customer.CustomerId = document.CustomerId
        WHERE document.TenantId = @TenantId
          AND document.CompanyId = @CompanyId
          AND document.IsActive = 1
          AND CAST(document.DocumentDate AS date) <= @AsOfDate
      )
    `;
  }

  private statementWhere() {
    return `
      (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@AgingBucket IS NULL OR AgingBucket = @AgingBucket)
      AND (@OverdueOnly = 0 OR DaysPastDue > 0)
      AND (
        @Search IS NULL
        OR DocumentNumber LIKE @Search
        OR SourceDocumentNumber LIKE @Search
        OR CustomerCode LIKE @Search
        OR CustomerName LIKE @Search
        OR Status LIKE @Search
        OR Reference LIKE @Search
      )
    `;
  }

  private agingCte() {
    return `
      WITH open_documents AS (
        SELECT
          document.CustomerId,
          customer.Code AS CustomerCode,
          customer.Name AS CustomerName,
          document.AccountsReceivableDocumentId,
          document.RemainingAmount,
          CASE
            WHEN CAST(document.DueDate AS date) >= @AsOfDate THEN 'CURRENT'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 1 AND 30 THEN '1-30'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 31 AND 60 THEN '31-60'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 61 AND 90 THEN '61-90'
            ELSE '90+'
          END AS AgingBucket
        FROM ar.AccountsReceivableDocuments document
        INNER JOIN crm.Customers customer
          ON customer.CustomerId = document.CustomerId
        WHERE document.TenantId = @TenantId
          AND document.CompanyId = @CompanyId
          AND document.IsActive = 1
          AND document.Status IN (${openStatuses})
          AND document.RemainingAmount > 0
          AND CAST(document.DocumentDate AS date) <= @AsOfDate
      ),
      customer_aging AS (
        SELECT
          CustomerId,
          CustomerCode,
          CustomerName,
          SUM(CASE WHEN AgingBucket = 'CURRENT' THEN RemainingAmount ELSE 0 END) AS CurrentAmount,
          SUM(CASE WHEN AgingBucket = '1-30' THEN RemainingAmount ELSE 0 END) AS Days1To30Amount,
          SUM(CASE WHEN AgingBucket = '31-60' THEN RemainingAmount ELSE 0 END) AS Days31To60Amount,
          SUM(CASE WHEN AgingBucket = '61-90' THEN RemainingAmount ELSE 0 END) AS Days61To90Amount,
          SUM(CASE WHEN AgingBucket = '90+' THEN RemainingAmount ELSE 0 END) AS DaysOver90Amount,
          SUM(RemainingAmount) AS TotalOpenAmount,
          SUM(CASE WHEN AgingBucket <> 'CURRENT' THEN RemainingAmount ELSE 0 END) AS OverdueAmount,
          SUM(CASE WHEN AgingBucket = 'CURRENT' THEN RemainingAmount ELSE 0 END) AS NotDueAmount,
          COUNT(1) AS OpenDocumentCount,
          SUM(CASE WHEN AgingBucket <> 'CURRENT' THEN 1 ELSE 0 END) AS OverdueDocumentCount
        FROM open_documents
        GROUP BY CustomerId, CustomerCode, CustomerName
      )
    `;
  }

  private agingWhere() {
    return `
      (@CustomerId IS NULL OR CustomerId = @CustomerId)
      AND (
        @Search IS NULL
        OR CustomerCode LIKE @Search
        OR CustomerName LIKE @Search
      )
    `;
  }

  private statementParameters(
    context: CustomerStatementContextInput,
    values: {
      asOfDate: string;
      search: string | null;
      customerId: string | null;
      status: string | null;
      agingBucket: string | null;
      overdueOnly: boolean;
      offset: number;
      pageSize: number;
    }
  ): SqlParameter[] {
    return [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "AsOfDate", value: values.asOfDate },
      { name: "Search", value: values.search },
      { name: "CustomerId", value: values.customerId },
      { name: "Status", value: values.status },
      { name: "AgingBucket", value: values.agingBucket },
      { name: "OverdueOnly", value: values.overdueOnly ? 1 : 0 },
      { name: "Offset", value: values.offset },
      { name: "PageSize", value: values.pageSize }
    ];
  }

  private agingParameters(
    context: CustomerStatementContextInput,
    values: { asOfDate: string; search: string | null; customerId: string | null; offset: number; pageSize: number }
  ): SqlParameter[] {
    return [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "AsOfDate", value: values.asOfDate },
      { name: "Search", value: values.search },
      { name: "CustomerId", value: values.customerId },
      { name: "Offset", value: values.offset },
      { name: "PageSize", value: values.pageSize }
    ];
  }

  private mapStatementSummary(row?: StatementSummaryRow) {
    return {
      totalAmount: Number(row?.TotalAmount ?? 0),
      paidAmount: Number(row?.PaidAmount ?? 0),
      remainingAmount: Number(row?.RemainingAmount ?? 0),
      overdueAmount: Number(row?.OverdueAmount ?? 0),
      notDueAmount: Number(row?.NotDueAmount ?? 0),
      documentCount: Number(row?.DocumentCount ?? 0),
      openDocumentCount: Number(row?.OpenDocumentCount ?? 0)
    };
  }

  private mapAgingSummary(row?: AgingSummaryRow) {
    return {
      currentAmount: Number(row?.CurrentAmount ?? 0),
      days1To30Amount: Number(row?.Days1To30Amount ?? 0),
      days31To60Amount: Number(row?.Days31To60Amount ?? 0),
      days61To90Amount: Number(row?.Days61To90Amount ?? 0),
      daysOver90Amount: Number(row?.DaysOver90Amount ?? 0),
      totalOpenAmount: Number(row?.TotalOpenAmount ?? 0),
      overdueAmount: Number(row?.OverdueAmount ?? 0),
      notDueAmount: Number(row?.NotDueAmount ?? 0),
      openDocumentCount: Number(row?.OpenDocumentCount ?? 0),
      overdueDocumentCount: Number(row?.OverdueDocumentCount ?? 0)
    };
  }

  private mapStatement(row: StatementRow): CustomerStatementDetail {
    return {
      id: row.AccountsReceivableDocumentId,
      accountsReceivableDocumentId: row.AccountsReceivableDocumentId,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      documentNumber: row.DocumentNumber,
      sourceDocumentNumber: row.SourceDocumentNumber ?? undefined,
      sourceType: row.SourceType,
      documentDate: row.DocumentDate,
      dueDate: row.DueDate,
      currencyCode: row.CurrencyCode,
      status: row.Status,
      totalAmount: Number(row.TotalAmount ?? 0),
      paidAmount: Number(row.PaidAmount ?? 0),
      remainingAmount: Number(row.RemainingAmount ?? 0),
      daysPastDue: Number(row.DaysPastDue ?? 0),
      agingBucket: row.AgingBucket,
      reference: row.Reference ?? undefined,
      createdAt: row.CreatedAt
    };
  }

  private mapAging(row: AgingRow): CustomerAgingSummary {
    return {
      id: row.CustomerId,
      customerId: row.CustomerId,
      customerCode: row.CustomerCode,
      customerName: row.CustomerName,
      currentAmount: Number(row.CurrentAmount ?? 0),
      days1To30Amount: Number(row.Days1To30Amount ?? 0),
      days31To60Amount: Number(row.Days31To60Amount ?? 0),
      days61To90Amount: Number(row.Days61To90Amount ?? 0),
      daysOver90Amount: Number(row.DaysOver90Amount ?? 0),
      totalOpenAmount: Number(row.TotalOpenAmount ?? 0),
      overdueAmount: Number(row.OverdueAmount ?? 0),
      notDueAmount: Number(row.NotDueAmount ?? 0),
      openDocumentCount: Number(row.OpenDocumentCount ?? 0),
      overdueDocumentCount: Number(row.OverdueDocumentCount ?? 0)
    };
  }
}

export const customerStatementRepository = new CustomerStatementRepository();
