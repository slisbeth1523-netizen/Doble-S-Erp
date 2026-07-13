import { BaseService } from "../../../services/BaseService.js";
import {
  customerStatementRepository,
  type CustomerStatementContextInput
} from "../infrastructure/CustomerStatementRepository.js";
import type { CustomerAgingQuery, CustomerStatementQuery } from "../validators/customer-statement.validators.js";

export class CustomerStatementService extends BaseService {
  constructor(private readonly repository = customerStatementRepository) {
    super();
  }

  listStatements(context: CustomerStatementContextInput, query: CustomerStatementQuery) {
    return this.repository.listStatementDetails(context, query);
  }

  getCustomerStatement(context: CustomerStatementContextInput, customerId: string, query: CustomerStatementQuery) {
    return this.repository.getCustomerStatement(context, customerId, query);
  }

  listAging(context: CustomerStatementContextInput, query: CustomerAgingQuery) {
    return this.repository.listAging(context, query);
  }

  getCustomerAging(context: CustomerStatementContextInput, customerId: string, query: CustomerAgingQuery) {
    return this.repository.getCustomerAging(context, customerId, query);
  }
}

export const customerStatementService = new CustomerStatementService();
