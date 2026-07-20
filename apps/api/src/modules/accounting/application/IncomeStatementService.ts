import { BaseService } from "../../../services/BaseService.js";
import {
  incomeStatementRepository,
  type IncomeStatementContextInput
} from "../infrastructure/IncomeStatementRepository.js";
import type { IncomeStatementQuery } from "../validators/income-statement.validators.js";

export type IncomeStatementContext = IncomeStatementContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class IncomeStatementService extends BaseService {
  constructor(private readonly repository = incomeStatementRepository) {
    super();
  }

  getStatement(context: IncomeStatementContextInput, query: IncomeStatementQuery) {
    return this.repository.getStatement(context, query);
  }

  getSummary(context: IncomeStatementContextInput, query: IncomeStatementQuery) {
    return this.repository.getSummary(context, query);
  }
}

export const incomeStatementService = new IncomeStatementService();
