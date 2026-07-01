import type sql from "mssql";

import { getSqlServerPool } from "../db/sqlserver.js";
import { AppError } from "../errors/index.js";
import { logger } from "../utils/logger.js";

export type SqlParameter = {
  name: string;
  value: unknown;
};

export abstract class BaseSqlRepository {
  protected getPool() {
    return getSqlServerPool();
  }

  protected async query<TRecord>(
    sqlText: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    try {
      const pool = await this.getPool();
      const request = pool.request();

      for (const parameter of parameters) {
        request.input(parameter.name, parameter.value);
      }

      const result = await request.query<TRecord>(sqlText);
      return result.recordset;
    } catch (error) {
      this.handleSqlError(error);
    }
  }

  protected async executeProcedure<TRecord>(
    procedureName: string,
    parameters: readonly SqlParameter[] = []
  ): Promise<TRecord[]> {
    try {
      const pool = await this.getPool();
      const request = pool.request();

      for (const parameter of parameters) {
        request.input(parameter.name, parameter.value);
      }

      const result = await request.execute<TRecord>(procedureName);
      return result.recordset;
    } catch (error) {
      this.handleSqlError(error);
    }
  }

  protected async executeInTransaction<TResult>(
    callback: (transaction: sql.Transaction) => Promise<TResult>
  ): Promise<TResult> {
    try {
      const pool = await this.getPool();
      const transaction = pool.transaction();

      await transaction.begin();

      try {
        const result = await callback(transaction);
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      this.handleSqlError(error);
    }
  }

  private handleSqlError(error: unknown): never {
    logger.error("SQL repository operation failed");

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError({
      statusCode: 500,
      code: "SQL_OPERATION_FAILED",
      message: "Database operation failed",
      isOperational: true
    });
  }
}
