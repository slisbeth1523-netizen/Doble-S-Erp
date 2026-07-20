import { BaseService } from "../../../services/BaseService.js";
import {
  balanceSheetRepository,
  type BalanceSheetContextInput
} from "../infrastructure/BalanceSheetRepository.js";
import type { BalanceSheetQuery } from "../validators/balance-sheet.validators.js";

export type BalanceSheetContext = BalanceSheetContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class BalanceSheetService extends BaseService {
  constructor(private readonly repository = balanceSheetRepository) {
    super();
  }

  getStatement(context: BalanceSheetContextInput, query: BalanceSheetQuery) {
    return this.repository.getStatement(context, query);
  }

  getSummary(context: BalanceSheetContextInput, query: BalanceSheetQuery) {
    return this.repository.getSummary(context, query);
  }
}

export const balanceSheetService = new BalanceSheetService();
