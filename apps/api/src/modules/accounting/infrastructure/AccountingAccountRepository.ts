import { randomUUID } from "node:crypto";
import sql from "mssql";

import { AppError, ConflictError, NotFoundError, ValidationError } from "../../../errors/index.js";
import { BaseSqlRepository, type SqlParameter } from "../../../repositories/BaseSqlRepository.js";
import type {
  AccountingAccountListQuery,
  AccountingAccountPayload
} from "../validators/accounting-account.validators.js";

export type AccountingAccountContextInput = {
  tenantId: string;
  companyId: string;
  userId?: string;
};

export type AccountingAccountResult = {
  accountId: string;
  tenantId: string;
  companyId: string;
  code: string;
  name: string;
  description?: string;
  parentAccountId?: string;
  parentCode?: string;
  parentName?: string;
  level: number;
  accountType: string;
  normalBalance: string;
  classification?: string;
  allowsPosting: boolean;
  requiresCostCenter: boolean;
  requiresThirdParty: boolean;
  isControlAccount: boolean;
  currencyCode?: string;
  validFrom?: Date;
  validTo?: Date;
  isBlocked: boolean;
  blockReason?: string;
  isActive: boolean;
  childCount: number;
  fullPath: string;
  createdAt: Date;
  updatedAt?: Date;
};

type AccountRow = AccountingAccountResult;
type CountRow = { totalItems: number };
type LockedAccountRow = {
  AccountId: string;
  TenantId: string;
  CompanyId: string;
  ParentAccountId: string | null;
  Level: number;
  AllowsPosting: boolean;
  IsActive: boolean;
};

export type AccountingAccountWriteInput = AccountingAccountContextInput & AccountingAccountPayload;

export class AccountingAccountRepository extends BaseSqlRepository {
  async listAccounts(context: AccountingAccountContextInput, query: AccountingAccountListQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const offset = (page - 1) * pageSize;
    const parameters: SqlParameter[] = [
      { name: "TenantId", value: context.tenantId },
      { name: "CompanyId", value: context.companyId },
      { name: "Offset", value: offset },
      { name: "Limit", value: pageSize }
    ];
    const where = ["tenantId = @TenantId", "companyId = @CompanyId"];

    if (query.parentAccountId !== undefined) {
      if (query.parentAccountId) {
        where.push("parentAccountId = @ParentAccountId");
        parameters.push({ name: "ParentAccountId", value: query.parentAccountId });
      } else {
        where.push("parentAccountId IS NULL");
      }
    }
    if (query.accountType) {
      where.push("accountType = @AccountType");
      parameters.push({ name: "AccountType", value: query.accountType });
    }
    if (query.normalBalance) {
      where.push("normalBalance = @NormalBalance");
      parameters.push({ name: "NormalBalance", value: query.normalBalance });
    }
    if (typeof query.allowsPosting === "boolean") {
      where.push("allowsPosting = @AllowsPosting");
      parameters.push({ name: "AllowsPosting", value: query.allowsPosting });
    }
    if (typeof query.requiresCostCenter === "boolean") {
      where.push("requiresCostCenter = @RequiresCostCenter");
      parameters.push({ name: "RequiresCostCenter", value: query.requiresCostCenter });
    }
    if (typeof query.isBlocked === "boolean") {
      where.push("isBlocked = @IsBlocked");
      parameters.push({ name: "IsBlocked", value: query.isBlocked });
    }
    if (typeof query.isActive === "boolean") {
      where.push("isActive = @IsActive");
      parameters.push({ name: "IsActive", value: query.isActive });
    }
    if (query.validOn) {
      where.push("(validFrom IS NULL OR validFrom <= @ValidOn)");
      where.push("(validTo IS NULL OR validTo >= @ValidOn)");
      parameters.push({ name: "ValidOn", value: query.validOn });
    }
    if (query.search) {
      where.push("(code LIKE @Search OR name LIKE @Search OR description LIKE @Search OR fullPath LIKE @Search)");
      parameters.push({ name: "Search", value: `%${query.search}%` });
    }

    const whereSql = where.join(" AND ");
    const rows = await this.query<AccountRow>(
      `
        SELECT *
        FROM accounting.V_AccountSummary
        WHERE ${whereSql}
        ORDER BY fullPath
        OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
      `,
      parameters
    );
    const count = await this.query<CountRow>(
      `
        SELECT COUNT(1) AS totalItems
        FROM accounting.V_AccountSummary
        WHERE ${whereSql};
      `,
      parameters.filter((parameter) => parameter.name !== "Offset" && parameter.name !== "Limit")
    );

    return {
      records: rows.map((row) => this.mapAccount(row)),
      totalItems: count[0]?.totalItems ?? 0,
      page,
      pageSize
    };
  }

  async getAccount(context: AccountingAccountContextInput, accountId: string) {
    const row = await this.getAccountRow(context, accountId);
    if (!row) {
      throw new NotFoundError("Accounting account not found.", { accountId }, "ACCOUNTING_ACCOUNT_NOT_FOUND");
    }

    return this.mapAccount(row);
  }

  async createAccount(input: AccountingAccountWriteInput) {
    const id = await this.executeInTransaction(async (transaction) => {
      this.validatePayload(input);
      await this.ensureUniqueCode(transaction, input);
      const parent = input.parentAccountId ? await this.lockAccount(transaction, input, input.parentAccountId) : null;

      if (parent?.AllowsPosting) {
        throw new ConflictError(
          "Parent account allows posting and cannot receive children.",
          { parentAccountId: input.parentAccountId },
          "ACCOUNTING_PARENT_ALLOWS_POSTING"
        );
      }

      const accountId = randomUUID();
      const level = parent ? parent.Level + 1 : 1;
      await this.queryInTransaction(
        transaction,
        `
          INSERT INTO accounting.Accounts (
            AccountId, TenantId, CompanyId, Code, Name, Description, ParentAccountId, Level,
            AccountType, NormalBalance, Classification, AllowsPosting, RequiresCostCenter,
            RequiresThirdParty, IsControlAccount, CurrencyCode, ValidFrom, ValidTo,
            IsBlocked, IsActive, CreatedBy
          )
          VALUES (
            @AccountId, @TenantId, @CompanyId, @Code, @Name, @Description, @ParentAccountId, @Level,
            @AccountType, @NormalBalance, @Classification, @AllowsPosting, @RequiresCostCenter,
            @RequiresThirdParty, @IsControlAccount, @CurrencyCode, @ValidFrom, @ValidTo,
            0, 1, @UserId
          );
        `,
        this.writeParameters({ ...input, accountId, level })
      );

      return accountId;
    });

    return this.getAccount(input, id);
  }

  async updateAccount(accountId: string, input: AccountingAccountWriteInput) {
    const hierarchyChanged = await this.executeInTransaction(async (transaction) => {
      this.validatePayload(input);
      const current = await this.lockAccount(transaction, input, accountId);
      await this.lockSubtree(transaction, input, accountId);
      await this.ensureUniqueCode(transaction, input, accountId);
      const childCount = await this.countChildren(transaction, input, accountId, true);

      if (input.allowsPosting && childCount > 0) {
        throw new ConflictError(
          "Accounts with active children cannot allow posting.",
          { accountId },
          "ACCOUNTING_ACCOUNT_HAS_CHILDREN"
        );
      }

      let level = 1;
      if (input.parentAccountId) {
        const parent = await this.lockAccount(transaction, input, input.parentAccountId);
        if (parent.AccountId === accountId) {
          throw new ConflictError("Account cannot be its own parent.", { accountId }, "ACCOUNTING_ACCOUNT_SELF_PARENT");
        }
        if (parent.AllowsPosting) {
          throw new ConflictError(
            "Parent account allows posting and cannot receive children.",
            { parentAccountId: input.parentAccountId },
            "ACCOUNTING_PARENT_ALLOWS_POSTING"
          );
        }
        await this.ensureParentIsNotDescendant(transaction, input, accountId, input.parentAccountId);
        level = parent.Level + 1;
      }

      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.Accounts
          SET
            Code = @Code,
            Name = @Name,
            Description = @Description,
            ParentAccountId = @ParentAccountId,
            Level = @Level,
            AccountType = @AccountType,
            NormalBalance = @NormalBalance,
            Classification = @Classification,
            AllowsPosting = @AllowsPosting,
            RequiresCostCenter = @RequiresCostCenter,
            RequiresThirdParty = @RequiresThirdParty,
            IsControlAccount = @IsControlAccount,
            CurrencyCode = @CurrencyCode,
            ValidFrom = @ValidFrom,
            ValidTo = @ValidTo,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
          WHERE AccountId = @AccountId
            AND TenantId = @TenantId
            AND CompanyId = @CompanyId;
        `,
        this.writeParameters({ ...input, accountId, level })
      );

      const changed = (current.ParentAccountId ?? null) !== (input.parentAccountId ?? null);
      if (changed) {
        await this.recalculateSubtreeLevels(transaction, input, accountId);
      }

      return changed;
    });

    return {
      account: await this.getAccount(input, accountId),
      hierarchyChanged
    };
  }

  async blockAccount(context: AccountingAccountContextInput, accountId: string, reason: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      await this.lockAccount(transaction, context, accountId);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.Accounts
          SET IsBlocked = 1, BlockReason = @BlockReason, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UserId
          WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId;
        `,
        [
          { name: "AccountId", value: accountId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "BlockReason", value: reason },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      return accountId;
    });

    return this.getAccount(context, id);
  }

  async unblockAccount(context: AccountingAccountContextInput, accountId: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      await this.lockAccount(transaction, context, accountId);
      await this.queryInTransaction(
        transaction,
        `
          UPDATE accounting.Accounts
          SET IsBlocked = 0, BlockReason = NULL, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UserId
          WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId;
        `,
        [
          { name: "AccountId", value: accountId },
          { name: "TenantId", value: context.tenantId },
          { name: "CompanyId", value: context.companyId },
          { name: "UserId", value: context.userId ?? null }
        ]
      );
      return accountId;
    });

    return this.getAccount(context, id);
  }

  async activateAccount(context: AccountingAccountContextInput, accountId: string) {
    const id = await this.setActive(context, accountId, true);
    return this.getAccount(context, id);
  }

  async deactivateAccount(context: AccountingAccountContextInput, accountId: string) {
    const id = await this.executeInTransaction(async (transaction) => {
      await this.lockAccount(transaction, context, accountId);
      const childCount = await this.countChildren(transaction, context, accountId, true);
      if (childCount > 0) {
        throw new ConflictError(
          "Accounts with active children cannot be deactivated.",
          { accountId },
          "ACCOUNTING_ACCOUNT_ACTIVE_CHILDREN"
        );
      }
      await this.updateActive(transaction, context, accountId, false);
      return accountId;
    });

    return this.getAccount(context, id);
  }

  async listChildren(context: AccountingAccountContextInput, accountId: string) {
    await this.getAccount(context, accountId);
    return this.listAccounts(context, { parentAccountId: accountId, page: 1, pageSize: 200 });
  }

  private async setActive(context: AccountingAccountContextInput, accountId: string, isActive: boolean) {
    return this.executeInTransaction(async (transaction) => {
      await this.lockAccount(transaction, context, accountId);
      await this.updateActive(transaction, context, accountId, isActive);
      return accountId;
    });
  }

  private async updateActive(
    transaction: sql.Transaction,
    context: AccountingAccountContextInput,
    accountId: string,
    isActive: boolean
  ) {
    await this.queryInTransaction(
      transaction,
      `
        UPDATE accounting.Accounts
        SET IsActive = @IsActive, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UserId
        WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId;
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "IsActive", value: isActive },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private validatePayload(input: AccountingAccountWriteInput) {
    if (input.validFrom && input.validTo && new Date(input.validTo) < new Date(input.validFrom)) {
      throw new ValidationError(
        "Account validTo cannot be before validFrom.",
        [{ field: "validTo", message: "ValidTo cannot be before validFrom" }],
        "ACCOUNTING_ACCOUNT_INVALID_DATE_RANGE"
      );
    }

    if (input.currencyCode && input.currencyCode.length !== 3) {
      throw new ValidationError(
        "Currency code must have three characters.",
        [{ field: "currencyCode", message: "Currency code must have three characters" }],
        "ACCOUNTING_ACCOUNT_INVALID_CURRENCY"
      );
    }
  }

  private async getAccountRow(context: AccountingAccountContextInput, accountId: string) {
    const rows = await this.query<AccountRow>(
      `
        SELECT *
        FROM accounting.V_AccountSummary
        WHERE accountId = @AccountId AND tenantId = @TenantId AND companyId = @CompanyId;
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    return rows[0];
  }

  private async lockAccount(transaction: sql.Transaction, context: AccountingAccountContextInput, accountId: string) {
    const rows = await this.queryInTransaction<LockedAccountRow>(
      transaction,
      `
        SELECT AccountId, TenantId, CompanyId, ParentAccountId, Level, AllowsPosting, IsActive
        FROM accounting.Accounts WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
        WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId;
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    if (!rows[0]) {
      throw new NotFoundError("Accounting account not found.", { accountId }, "ACCOUNTING_ACCOUNT_NOT_FOUND");
    }

    return rows[0];
  }

  private async lockSubtree(transaction: sql.Transaction, context: AccountingAccountContextInput, accountId: string) {
    await this.queryInTransaction(
      transaction,
      `
        WITH Subtree AS (
          SELECT AccountId
          FROM accounting.Accounts
          WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId
          UNION ALL
          SELECT child.AccountId
          FROM accounting.Accounts child
          INNER JOIN Subtree parent ON parent.AccountId = child.ParentAccountId
          WHERE child.TenantId = @TenantId AND child.CompanyId = @CompanyId
        )
        SELECT account.AccountId
        FROM accounting.Accounts account WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN Subtree subtree ON subtree.AccountId = account.AccountId
        OPTION (MAXRECURSION 100);
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );
  }

  private async ensureParentIsNotDescendant(
    transaction: sql.Transaction,
    context: AccountingAccountContextInput,
    accountId: string,
    parentAccountId: string
  ) {
    const rows = await this.queryInTransaction<{ AccountId: string }>(
      transaction,
      `
        WITH Subtree AS (
          SELECT AccountId
          FROM accounting.Accounts
          WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId
          UNION ALL
          SELECT child.AccountId
          FROM accounting.Accounts child
          INNER JOIN Subtree parent ON parent.AccountId = child.ParentAccountId
          WHERE child.TenantId = @TenantId AND child.CompanyId = @CompanyId
        )
        SELECT AccountId FROM Subtree WHERE AccountId = @ParentAccountId OPTION (MAXRECURSION 100);
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "ParentAccountId", value: parentAccountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId }
      ]
    );

    if (rows.length > 0) {
      throw new ConflictError(
        "Account cannot be moved below one of its descendants.",
        { accountId, parentAccountId },
        "ACCOUNTING_ACCOUNT_CYCLE"
      );
    }
  }

  private async recalculateSubtreeLevels(
    transaction: sql.Transaction,
    context: AccountingAccountContextInput,
    accountId: string
  ) {
    await this.queryInTransaction(
      transaction,
      `
        WITH Subtree AS (
          SELECT AccountId, Level
          FROM accounting.Accounts
          WHERE AccountId = @AccountId AND TenantId = @TenantId AND CompanyId = @CompanyId
          UNION ALL
          SELECT child.AccountId, parent.Level + 1
          FROM accounting.Accounts child
          INNER JOIN Subtree parent ON parent.AccountId = child.ParentAccountId
          WHERE child.TenantId = @TenantId AND child.CompanyId = @CompanyId
        )
        UPDATE account
        SET Level = subtree.Level, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @UserId
        FROM accounting.Accounts account
        INNER JOIN Subtree subtree ON subtree.AccountId = account.AccountId
        OPTION (MAXRECURSION 100);
      `,
      [
        { name: "AccountId", value: accountId },
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "UserId", value: context.userId ?? null }
      ]
    );
  }

  private async ensureUniqueCode(
    transaction: sql.Transaction,
    input: AccountingAccountWriteInput,
    excludeId?: string
  ) {
    const rows = await this.queryInTransaction<{ AccountId: string }>(
      transaction,
      `
        SELECT TOP 1 AccountId
        FROM accounting.Accounts WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND Code = @Code
          ${excludeId ? "AND AccountId <> @ExcludeId" : ""};
      `,
      [
        { name: "TenantId", value: input.tenantId },
        { name: "CompanyId", value: input.companyId },
        { name: "Code", value: input.code },
        ...(excludeId ? [{ name: "ExcludeId", value: excludeId }] : [])
      ]
    );

    if (rows.length > 0) {
      throw new ConflictError("Accounting account code already exists.", { code: input.code }, "ACCOUNTING_ACCOUNT_DUPLICATE");
    }
  }

  private async countChildren(
    transaction: sql.Transaction,
    context: AccountingAccountContextInput,
    accountId: string,
    activeOnly: boolean
  ) {
    const rows = await this.queryInTransaction<{ Total: number }>(
      transaction,
      `
        SELECT COUNT(1) AS Total
        FROM accounting.Accounts WITH (UPDLOCK, HOLDLOCK)
        WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND ParentAccountId = @AccountId
          ${activeOnly ? "AND IsActive = 1" : ""};
      `,
      [
        { name: "TenantId", value: context.tenantId },
        { name: "CompanyId", value: context.companyId },
        { name: "AccountId", value: accountId }
      ]
    );

    return rows[0]?.Total ?? 0;
  }

  private writeParameters(input: AccountingAccountWriteInput & { accountId: string; level: number }): SqlParameter[] {
    return [
      { name: "AccountId", value: input.accountId },
      { name: "TenantId", value: input.tenantId },
      { name: "CompanyId", value: input.companyId },
      { name: "Code", value: input.code },
      { name: "Name", value: input.name },
      { name: "Description", value: input.description ?? null },
      { name: "ParentAccountId", value: input.parentAccountId ?? null },
      { name: "Level", value: input.level },
      { name: "AccountType", value: input.accountType },
      { name: "NormalBalance", value: input.normalBalance },
      { name: "Classification", value: input.classification ?? null },
      { name: "AllowsPosting", value: input.allowsPosting ?? true },
      { name: "RequiresCostCenter", value: input.requiresCostCenter ?? false },
      { name: "RequiresThirdParty", value: input.requiresThirdParty ?? false },
      { name: "IsControlAccount", value: input.isControlAccount ?? false },
      { name: "CurrencyCode", value: input.currencyCode ?? null },
      { name: "ValidFrom", value: input.validFrom ?? null },
      { name: "ValidTo", value: input.validTo ?? null },
      { name: "UserId", value: input.userId ?? null }
    ];
  }

  private mapAccount(row: AccountRow): AccountingAccountResult {
    return {
      ...row,
      description: row.description ?? undefined,
      parentAccountId: row.parentAccountId ?? undefined,
      parentCode: row.parentCode ?? undefined,
      parentName: row.parentName ?? undefined,
      classification: row.classification ?? undefined,
      currencyCode: row.currencyCode ?? undefined,
      validFrom: row.validFrom ?? undefined,
      validTo: row.validTo ?? undefined,
      blockReason: row.blockReason ?? undefined,
      updatedAt: row.updatedAt ?? undefined
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

export const accountingAccountRepository = new AccountingAccountRepository();
