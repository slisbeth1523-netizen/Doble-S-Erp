import type { SupplierAgingQuery, SupplierStatementQuery } from "../validators/supplier-statement.validators.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";

export type SupplierStatementContextInput = {
  tenantId: string;
  companyId: string;
};

export type SupplierStatementDetail = {
  id: string;
  accountsPayableDocumentId: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  documentNumber: string;
  sourceDocumentNumber: string;
  sourceType: string;
  documentDate: Date;
  dueDate: Date;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  daysPastDue: number;
  agingBucket: string;
  createdAt: Date;
};

export type SupplierAgingSummary = {
  id: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
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
  AccountsPayableDocumentId: string;
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
  DocumentNumber: string;
  SourceDocumentNumber: string;
  SourceType: string;
  DocumentDate: Date;
  DueDate: Date;
  Status: string;
  TotalAmount: number;
  PaidAmount: number;
  RemainingAmount: number;
  DaysPastDue: number;
  AgingBucket: string;
  CreatedAt: Date;
};

type AgingRow = {
  SupplierId: string;
  SupplierCode: string;
  SupplierName: string;
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

const openStatuses = "'OPEN', 'PARTIALLY_PAID', 'PENDING'";

export class SupplierStatementRepository extends BaseSqlRepository {
  async listStatementDetails(context: SupplierStatementContextInput, query: SupplierStatementQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const asOfDate = this.resolveAsOfDate(query.asOfDate);
    const search = query.search ? `%${query.search}%` : null;
    const supplierId = query.supplierId ?? null;
    const status = query.status ?? null;
    const agingBucket = query.agingBucket ?? null;
    const overdueOnly = query.overdueOnly === true;
    const parameters = this.statementParameters(context, {
      asOfDate,
      search,
      supplierId,
      status,
      agingBucket,
      overdueOnly,
      offset,
      pageSize
    });

    const [rows, counts] = await Promise.all([
      this.query<StatementRow>(
        `
          ${this.statementCte()}
          SELECT
            AccountsPayableDocumentId,
            SupplierId,
            SupplierCode,
            SupplierName,
            DocumentNumber,
            SourceDocumentNumber,
            SourceType,
            DocumentDate,
            DueDate,
            Status,
            TotalAmount,
            PaidAmount,
            RemainingAmount,
            DaysPastDue,
            AgingBucket,
            CreatedAt
          FROM statement_documents
          WHERE ${this.statementWhere()}
          ORDER BY SupplierName ASC, DocumentDate ASC, DocumentNumber ASC
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
      )
    ]);

    const totalItems = Number(counts[0]?.TotalItems ?? 0);

    return {
      asOfDate,
      records: rows.map((row) => this.mapStatement(row)),
      summary: this.summarizeStatements(rows),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async getSupplierStatement(context: SupplierStatementContextInput, supplierId: string, query: SupplierStatementQuery) {
    return this.listStatementDetails(context, { ...query, supplierId });
  }

  async listAging(context: SupplierStatementContextInput, query: SupplierAgingQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const asOfDate = this.resolveAsOfDate(query.asOfDate);
    const search = query.search ? `%${query.search}%` : null;
    const supplierId = query.supplierId ?? null;
    const parameters = this.agingParameters(context, { asOfDate, search, supplierId, offset, pageSize });

    const [rows, counts] = await Promise.all([
      this.query<AgingRow>(
        `
          ${this.agingCte()}
          SELECT
            SupplierId,
            SupplierCode,
            SupplierName,
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
          FROM supplier_aging
          WHERE ${this.agingWhere()}
          ORDER BY SupplierName ASC
          OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
        `,
        parameters
      ),
      this.query<CountRow>(
        `
          ${this.agingCte()}
          SELECT COUNT(1) AS TotalItems
          FROM supplier_aging
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
      summary: this.summarizeAging(records),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async getSupplierAging(context: SupplierStatementContextInput, supplierId: string, query: SupplierAgingQuery) {
    return this.listAging(context, { ...query, supplierId });
  }

  private resolveAsOfDate(value?: string) {
    return value ?? new Date().toISOString().slice(0, 10);
  }

  private statementCte() {
    return `
      WITH statement_documents AS (
        SELECT
          document.AccountsPayableDocumentId,
          document.TenantId,
          document.CompanyId,
          document.SupplierId,
          supplier.Code AS SupplierCode,
          supplier.Name AS SupplierName,
          document.DocumentNumber,
          document.SourceDocumentNumber,
          document.SourceModule AS SourceType,
          document.DocumentDate,
          document.DueDate,
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
          document.CreatedAt
        FROM ap.AccountsPayableDocuments document
        INNER JOIN purchasing.Suppliers supplier
          ON supplier.SupplierId = document.SupplierId
        WHERE document.TenantId = @TenantId
          AND document.CompanyId = @CompanyId
          AND document.IsActive = 1
          AND CAST(document.DocumentDate AS date) <= @AsOfDate
      )
    `;
  }

  private statementWhere() {
    return `
      (@SupplierId IS NULL OR SupplierId = @SupplierId)
      AND (@Status IS NULL OR Status = @Status)
      AND (@AgingBucket IS NULL OR AgingBucket = @AgingBucket)
      AND (@OverdueOnly = 0 OR DaysPastDue > 0)
      AND (
        @Search IS NULL
        OR DocumentNumber LIKE @Search
        OR SourceDocumentNumber LIKE @Search
        OR SupplierCode LIKE @Search
        OR SupplierName LIKE @Search
        OR Status LIKE @Search
      )
    `;
  }

  private agingCte() {
    return `
      WITH open_documents AS (
        SELECT
          document.SupplierId,
          supplier.Code AS SupplierCode,
          supplier.Name AS SupplierName,
          document.AccountsPayableDocumentId,
          document.RemainingAmount,
          CASE
            WHEN CAST(document.DueDate AS date) >= @AsOfDate THEN 'CURRENT'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 1 AND 30 THEN '1-30'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 31 AND 60 THEN '31-60'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), @AsOfDate) BETWEEN 61 AND 90 THEN '61-90'
            ELSE '90+'
          END AS AgingBucket
        FROM ap.AccountsPayableDocuments document
        INNER JOIN purchasing.Suppliers supplier
          ON supplier.SupplierId = document.SupplierId
        WHERE document.TenantId = @TenantId
          AND document.CompanyId = @CompanyId
          AND document.IsActive = 1
          AND document.Status IN (${openStatuses})
          AND document.RemainingAmount > 0
          AND CAST(document.DocumentDate AS date) <= @AsOfDate
      ),
      supplier_aging AS (
        SELECT
          SupplierId,
          SupplierCode,
          SupplierName,
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
        GROUP BY SupplierId, SupplierCode, SupplierName
      )
    `;
  }

  private agingWhere() {
    return `
      (@SupplierId IS NULL OR SupplierId = @SupplierId)
      AND (
        @Search IS NULL
        OR SupplierCode LIKE @Search
        OR SupplierName LIKE @Search
      )
    `;
  }

  private statementParameters(
    context: SupplierStatementContextInput,
    values: {
      asOfDate: string;
      search: string | null;
      supplierId: string | null;
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
      { name: "SupplierId", value: values.supplierId },
      { name: "Status", value: values.status },
      { name: "AgingBucket", value: values.agingBucket },
      { name: "OverdueOnly", value: values.overdueOnly ? 1 : 0 },
      { name: "Offset", value: values.offset },
      { name: "PageSize", value: values.pageSize }
    ];
  }

  private agingParameters(
    context: SupplierStatementContextInput,
    values: { asOfDate: string; search: string | null; supplierId: string | null; offset: number; pageSize: number }
  ): SqlParameter[] {
    return [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "AsOfDate", value: values.asOfDate },
      { name: "Search", value: values.search },
      { name: "SupplierId", value: values.supplierId },
      { name: "Offset", value: values.offset },
      { name: "PageSize", value: values.pageSize }
    ];
  }

  private summarizeStatements(rows: StatementRow[]) {
    return rows.reduce(
      (summary, row) => ({
        totalAmount: summary.totalAmount + Number(row.TotalAmount ?? 0),
        paidAmount: summary.paidAmount + Number(row.PaidAmount ?? 0),
        remainingAmount: summary.remainingAmount + Number(row.RemainingAmount ?? 0),
        overdueAmount: summary.overdueAmount + (Number(row.DaysPastDue ?? 0) > 0 ? Number(row.RemainingAmount ?? 0) : 0),
        notDueAmount: summary.notDueAmount + (Number(row.DaysPastDue ?? 0) === 0 ? Number(row.RemainingAmount ?? 0) : 0),
        documentCount: summary.documentCount + 1
      }),
      { totalAmount: 0, paidAmount: 0, remainingAmount: 0, overdueAmount: 0, notDueAmount: 0, documentCount: 0 }
    );
  }

  private summarizeAging(records: SupplierAgingSummary[]) {
    return records.reduce(
      (summary, record) => ({
        currentAmount: summary.currentAmount + record.currentAmount,
        days1To30Amount: summary.days1To30Amount + record.days1To30Amount,
        days31To60Amount: summary.days31To60Amount + record.days31To60Amount,
        days61To90Amount: summary.days61To90Amount + record.days61To90Amount,
        daysOver90Amount: summary.daysOver90Amount + record.daysOver90Amount,
        totalOpenAmount: summary.totalOpenAmount + record.totalOpenAmount,
        overdueAmount: summary.overdueAmount + record.overdueAmount,
        notDueAmount: summary.notDueAmount + record.notDueAmount,
        openDocumentCount: summary.openDocumentCount + record.openDocumentCount,
        overdueDocumentCount: summary.overdueDocumentCount + record.overdueDocumentCount
      }),
      {
        currentAmount: 0,
        days1To30Amount: 0,
        days31To60Amount: 0,
        days61To90Amount: 0,
        daysOver90Amount: 0,
        totalOpenAmount: 0,
        overdueAmount: 0,
        notDueAmount: 0,
        openDocumentCount: 0,
        overdueDocumentCount: 0
      }
    );
  }

  private mapStatement(row: StatementRow): SupplierStatementDetail {
    return {
      id: row.AccountsPayableDocumentId,
      accountsPayableDocumentId: row.AccountsPayableDocumentId,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
      documentNumber: row.DocumentNumber,
      sourceDocumentNumber: row.SourceDocumentNumber,
      sourceType: row.SourceType,
      documentDate: row.DocumentDate,
      dueDate: row.DueDate,
      status: row.Status,
      totalAmount: Number(row.TotalAmount ?? 0),
      paidAmount: Number(row.PaidAmount ?? 0),
      remainingAmount: Number(row.RemainingAmount ?? 0),
      daysPastDue: Number(row.DaysPastDue ?? 0),
      agingBucket: row.AgingBucket,
      createdAt: row.CreatedAt
    };
  }

  private mapAging(row: AgingRow): SupplierAgingSummary {
    return {
      id: row.SupplierId,
      supplierId: row.SupplierId,
      supplierCode: row.SupplierCode,
      supplierName: row.SupplierName,
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

export const supplierStatementRepository = new SupplierStatementRepository();
