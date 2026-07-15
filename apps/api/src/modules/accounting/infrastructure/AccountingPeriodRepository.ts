import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, ConflictError, NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  AccountingPeriodCreatePayload,
  AccountingPeriodListQuery,
  AccountingPeriodUpdatePayload
} from "../validators/accounting-period.validators.js";

export type AccountingPeriodStatus = "OPEN" | "CLOSED";

export type AccountingPeriodContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type AccountingPeriodResult = {
  accountingPeriodId: string;
  tenantId: string;
  companyId: string;
  fiscalYear: number;
  periodNumber: number;
  name: string;
  startDate: Date;
  endDate: Date;
  status: AccountingPeriodStatus;
  isAdjustmentPeriod: boolean;
  openedAt?: Date;
  openedBy?: string;
  closedAt?: Date;
  closedBy?: string;
  reopenedAt?: Date;
  reopenedBy?: string;
  reopenReason?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date;
  durationDays: number;
  isCurrentPeriod: boolean;
  displayCode: string;
};

type AccountingPeriodRow = AccountingPeriodResult;
type CountRow = { totalItems: number };

export type AccountingPeriodCreateInput = AccountingPeriodContextInput & AccountingPeriodCreatePayload;
export type AccountingPeriodUpdateInput = AccountingPeriodContextInput & AccountingPeriodUpdatePayload;

export class AccountingPeriodRepository extends BaseSqlRepository {
  async listPeriods(context: AccountingPeriodContextInput, query: AccountingPeriodListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const offset = (page - 1) * pageSize;
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "Offset", value: offset },
      { name: "Limit", value: pageSize }
    ];
    const where = ["tenantId = @TenantId", "companyId = @CompanyId"];

    if (query.fiscalYear) {
      where.push("fiscalYear = @FiscalYear");
      parameters.push({ name: "FiscalYear", value: query.fiscalYear });
    }

    if (query.status) {
      where.push("status = @Status");
      parameters.push({ name: "Status", value: query.status });
    }

    if (typeof query.isAdjustmentPeriod === "boolean") {
      where.push("isAdjustmentPeriod = @IsAdjustmentPeriod");
      parameters.push({ name: "IsAdjustmentPeriod", value: query.isAdjustmentPeriod });
    }

    if (query.dateFrom) {
      where.push("endDate >= @DateFrom");
      parameters.push({ name: "DateFrom", value: query.dateFrom });
    }

    if (query.dateTo) {
      where.push("startDate <= @DateTo");
      parameters.push({ name: "DateTo", value: query.dateTo });
    }

    if (query.search) {
      where.push("(name LIKE @Search OR displayCode LIKE @Search)");
      parameters.push({ name: "Search", value: `%${query.search}%` });
    }

    const whereSql = where.join(" AND ");
    const rows = await this.query<AccountingPeriodRow>(
      `
        SELECT *
        FROM accounting.V_AccountingPeriodSummary
        WHERE ${whereSql}
        ORDER BY fiscalYear DESC, periodNumber DESC
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      parameters
    );
    const count = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.V_AccountingPeriodSummary
        WHERE ${whereSql};
      `,
      parameters.filter((parameter) => parameter.name !== "Offset" && parameter.name !== "Limit")
    );

    return {
      records: rows.map((row) => this.mapPeriod(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize
    };
  }

  async getPeriod(context: AccountingPeriodContextInput, accountingPeriodId: string) {
    const row = await this.getPeriodRow(context, accountingPeriodId);
    if (!row) {
      throw new NotFoundError("Accounting period not found.", { accountingPeriodId }, "ACCOUNTING_PERIOD_NOT_FOUND");
    }

    return this.mapPeriod(row);
  }

  async createPeriod(input: AccountingPeriodCreateInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      this.validateDateRange(input.startDate, input.endDate);
      await this.ensureUniqueYearNumber(transaction, input);
      await this.ensureNoOverlap(transaction, input);

      const accountingPeriodId = randomUUID();
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.AccountingPeriods (
            AccountingPeriodId,
            TenantId,
            CompanyId,
            FiscalYear,
            PeriodNumber,
            Name,
            StartDate,
            EndDate,
            Status,
            IsAdjustmentPeriod,
            OpenedAt,
            OpenedBy,
            IsActive,
            CreatedBy
          )
          VALUES (
            @AccountingPeriodId,
            @TenantId,
            @CompanyId,
            @FiscalYear,
            @PeriodNumber,
            @Name,
            @StartDate,
            @EndDate,
            N'OPEN',
            @IsAdjustmentPeriod,
            SYSUTCDATETIME(),
            @UserId,
            1,
            @UserId
          );
        `,
        [
          { name: "AccountingPeriodId", value: accountingPeriodId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "FiscalYear", value: input.fiscalYear },
          { name: "PeriodNumber", value: input.periodNumber },
          { name: "Name", value: input.name },
          { name: "StartDate", value: input.startDate },
          { name: "EndDate", value: input.endDate },
          { name: "IsAdjustmentPeriod", value: input.isAdjustmentPeriod ?? false },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return accountingPeriodId;
    });

    return this.getPeriod(input, id);
  }

  async updatePeriod(accountingPeriodId: string, input: AccountingPeriodUpdateInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      this.validateDateRange(input.startDate, input.endDate);
      const current = await this.lockPeriod(transaction, input, accountingPeriodId);

      if (current.Status !== "OPEN") {
        throw new ConflictError(
          "Only OPEN accounting periods can be edited.",
          { accountingPeriodId, status: current.Status },
          "ACCOUNTING_PERIOD_NOT_OPEN"
        );
      }

      await this.ensureUniqueYearNumber(transaction, input, accountingPeriodId);
      await this.ensureNoOverlap(transaction, input, accountingPeriodId);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.AccountingPeriods
          SET
            FiscalYear = @FiscalYear,
            PeriodNumber = @PeriodNumber,
            Name = @Name,
            StartDate = @StartDate,
            EndDate = @EndDate,
            IsAdjustmentPeriod = @IsAdjustmentPeriod,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE AccountingPeriodId = @AccountingPeriodId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "AccountingPeriodId", value: accountingPeriodId },
          { name: "TenantId", value: input.tenantId },
          { name: "CompanyId", value: input.companyId },
          { name: "FiscalYear", value: input.fiscalYear },
          { name: "PeriodNumber", value: input.periodNumber },
          { name: "Name", value: input.name },
          { name: "StartDate", value: input.startDate },
          { name: "EndDate", value: input.endDate },
          { name: "IsAdjustmentPeriod", value: input.isAdjustmentPeriod ?? false },
          { name: "UserId", value: input.userId ?? null }
        ]
      );

      return accountingPeriodId;
    });

    return this.getPeriod(input, id);
  }

  async closePeriod(context: AccountingPeriodContextInput, accountingPeriodId: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      const current = await this.lockPeriod(transaction, context, accountingPeriodId);

      if (current.Status !== "OPEN") {
        throw new ConflictError(
          "Only OPEN accounting periods can be closed.",
          { accountingPeriodId, status: current.Status },
          "ACCOUNTING_PERIOD_NOT_OPEN"
        );
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.AccountingPeriods
          SET
            Status = N'CLOSED',
            ClosedAt = SYSUTCDATETIME(),
            ClosedBy = @UserId,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE AccountingPeriodId = @AccountingPeriodId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "AccountingPeriodId", value: accountingPeriodId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      return accountingPeriodId;
    });

    return this.getPeriod(context, id);
  }

  async reopenPeriod(context: AccountingPeriodContextInput, accountingPeriodId: string, reason: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      const current = await this.lockPeriod(transaction, context, accountingPeriodId);

      if (current.Status !== "CLOSED") {
        throw new ConflictError(
          "Only CLOSED accounting periods can be reopened.",
          { accountingPeriodId, status: current.Status },
          "ACCOUNTING_PERIOD_NOT_CLOSED"
        );
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.AccountingPeriods
          SET
            Status = N'OPEN',
            ReopenedAt = SYSUTCDATETIME(),
            ReopenedBy = @UserId,
            ReopenReason = @ReopenReason,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE AccountingPeriodId = @AccountingPeriodId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "AccountingPeriodId", value: accountingPeriodId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "ReopenReason", value: reason },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      return accountingPeriodId;
    });

    return this.getPeriod(context, id);
  }

  async deactivatePeriod(context: AccountingPeriodContextInput, accountingPeriodId: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      const current = await this.lockPeriod(transaction, context, accountingPeriodId);

      if (current.Status === "CLOSED") {
        throw new ConflictError(
          "CLOSED accounting periods cannot be deactivated.",
          { accountingPeriodId },
          "ACCOUNTING_PERIOD_CLOSED_DEACTIVATE_FORBIDDEN"
        );
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.AccountingPeriods
          SET
            IsActive = 0,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE AccountingPeriodId = @AccountingPeriodId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        [
          { name: "AccountingPeriodId", value: accountingPeriodId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );

      return accountingPeriodId;
    });

    return this.getPeriod(context, id);
  }

  private async getPeriodRow(context: AccountingPeriodContextInput, accountingPeriodId: string) {
    const rows = await this.query<AccountingPeriodRow>(
      `
        SELECT *
        FROM accounting.V_AccountingPeriodSummary
        WHERE accountingPeriodId = @AccountingPeriodId
          AND tenantId = @TenantId
          AND companyId = @CompanyId;
      `,
      [
        { name: "AccountingPeriodId", value: accountingPeriodId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    return rows[0];
  }

  private async lockPeriod(
    transaction: sql.Transaction,
    context: AccountingPeriodContextInput,
    accountingPeriodId: string
  ) {
    const rows = await this.queryInTransaction<{
      AccountingPeriodId: string;
      Status: AccountingPeriodStatus;
    }>(
      transaction,
      `
        SELECT AccountingPeriodId, Status
        FROM accounting.AccountingPeriods WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE AccountingPeriodId = @AccountingPeriodId
          AND TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `,
      [
        { name: "AccountingPeriodId", value: accountingPeriodId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    if (!rows[0]) {
      throw new NotFoundError("Accounting period not found.", { accountingPeriodId }, "ACCOUNTING_PERIOD_NOT_FOUND");
    }

    return rows[0];
  }

  private async ensureUniqueYearNumber(
    transaction: sql.Transaction,
    input: AccountingPeriodCreateInput | AccountingPeriodUpdateInput,
    excludeId?: string
  ) {
    const rows = await this.queryInTransaction<{ ExistsValue: number }>(
      transaction,
      `
        SELECT TOP 1 1 AS ExistsValue
        FROM accounting.AccountingPeriods WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND FiscalYear = @FiscalYear
          AND PeriodNumber = @PeriodNumber
          ${excludeId ? "AND AccountingPeriodId <> @ExcludeId" : ""};
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "FiscalYear", value: input.fiscalYear },
        { name: "PeriodNumber", value: input.periodNumber },
        ...(excludeId ? [{ name: "ExcludeId", value: excludeId }] : [])
      ]
    );

    if (rows.length > 0) {
      throw new ConflictError(
        "Accounting period fiscal year and number already exist.",
        { fiscalYear: input.fiscalYear, periodNumber: input.periodNumber },
        "ACCOUNTING_PERIOD_DUPLICATE"
      );
    }
  }

  private async ensureNoOverlap(
    transaction: sql.Transaction,
    input: AccountingPeriodCreateInput | AccountingPeriodUpdateInput,
    excludeId?: string
  ) {
    const rows = await this.queryInTransaction<{ AccountingPeriodId: string }>(
      transaction,
      `
        SELECT TOP 1 AccountingPeriodId
        FROM accounting.AccountingPeriods WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND IsActive = 1
          AND StartDate <= @EndDate
          AND EndDate >= @StartDate
          ${excludeId ? "AND AccountingPeriodId <> @ExcludeId" : ""};
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "StartDate", value: input.startDate },
        { name: "EndDate", value: input.endDate },
        ...(excludeId ? [{ name: "ExcludeId", value: excludeId }] : [])
      ]
    );

    if (rows.length > 0) {
      throw new ConflictError(
        "Accounting period date range overlaps another active period.",
        { startDate: input.startDate, endDate: input.endDate },
        "ACCOUNTING_PERIOD_OVERLAP"
      );
    }
  }

  private validateDateRange(startDate: string, endDate: string) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new ValidationError(
        "Accounting period end date cannot be before start date.",
        [{ field: "endDate", message: "End date cannot be before start date" }],
        "ACCOUNTING_PERIOD_INVALID_DATE_RANGE"
      );
    }
  }

  private mapPeriod(row: AccountingPeriodRow): AccountingPeriodResult {
    return {
      ...row,
      openedAt: row.openedAt ?? undefined,
      openedBy: row.openedBy ?? undefined,
      closedAt: row.closedAt ?? undefined,
      closedBy: row.closedBy ?? undefined,
      reopenedAt: row.reopenedAt ?? undefined,
      reopenedBy: row.reopenedBy ?? undefined,
      reopenReason: row.reopenReason ?? undefined
    };
  }

  private async queryInTransaction<TRecord>(
    transaction: sql.Transaction,
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    const request = new sql.Request(transaction);

    for (const parameter of parameters) {
      request.input(parameter.name, parameter.value);
    }

    try {
      const result = await request.query(sqlText);
      return result.recordset as TRecord[];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw error;
    }
  }
}

export const accountingPeriodRepository = new AccountingPeriodRepository();
