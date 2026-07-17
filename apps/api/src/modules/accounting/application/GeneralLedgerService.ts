import { BaseService } from "../../../services/BaseService.js";
import {
  generalLedgerRepository,
  type GeneralLedgerContextInput
} from "../infrastructure/GeneralLedgerRepository.js";
import type { GeneralLedgerQuery } from "../validators/general-ledger.validators.js";

export type GeneralLedgerContext = GeneralLedgerContextInput & {
  requestId?: string;
  correlationId?: string;
};

export class GeneralLedgerService extends BaseService {
  constructor(private readonly repository = generalLedgerRepository) {
    super();
  }

  listEntries(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    return this.repository.listEntries(context, query);
  }

  getSummary(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    return this.repository.getSummary(context, query);
  }

  listAccountSummaries(context: GeneralLedgerContextInput, query: GeneralLedgerQuery) {
    return this.repository.listAccountSummaries(context, query);
  }

  getAccountLedger(context: GeneralLedgerContextInput, accountId: string, query: GeneralLedgerQuery) {
    return this.repository.listEntries(context, { ...query, accountId });
  }

  listAccountPeriodSummaries(context: GeneralLedgerContextInput, accountId: string, query: GeneralLedgerQuery) {
    return this.repository.listAccountPeriodSummaries(context, accountId, query);
  }

  listCostCenterEntries(context: GeneralLedgerContextInput, costCenterId: string, query: GeneralLedgerQuery) {
    return this.repository.listCostCenterEntries(context, costCenterId, query);
  }
}

export const generalLedgerService = new GeneralLedgerService();
