import { BaseService } from "../../../services/BaseService.js";
import { cashFlowRepository, type CashFlowContextInput } from "../infrastructure/CashFlowRepository.js";
import type { CashFlowQuery } from "../validators/cash-flow.validators.js";

export type CashFlowContext = CashFlowContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class CashFlowService extends BaseService {
  constructor(private readonly repository = cashFlowRepository) {
    super();
  }

  getStatement(context: CashFlowContextInput, query: CashFlowQuery) {
    return this.repository.getStatement(context, query);
  }

  getSummary(context: CashFlowContextInput, query: CashFlowQuery) {
    return this.repository.getSummary(context, query);
  }
}

export const cashFlowService = new CashFlowService();
