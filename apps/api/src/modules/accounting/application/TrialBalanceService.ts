import { BaseService } from "../../../services/BaseService.js";
import {
  trialBalanceRepository,
  type TrialBalanceContextInput
} from "../infrastructure/TrialBalanceRepository.js";
import type { TrialBalanceQuery } from "../validators/trial-balance.validators.js";

export type TrialBalanceContext = TrialBalanceContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class TrialBalanceService extends BaseService {
  constructor(private readonly repository = trialBalanceRepository) {
    super();
  }

  listAccounts(context: TrialBalanceContextInput, query: TrialBalanceQuery) {
    return this.repository.listAccounts(context, query);
  }

  getSummary(context: TrialBalanceContextInput, query: TrialBalanceQuery) {
    return this.repository.getSummary(context, query);
  }
}

export const trialBalanceService = new TrialBalanceService();
