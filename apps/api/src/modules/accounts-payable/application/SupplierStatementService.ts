import { BaseService } from "../../../services/BaseService.js";
import {
  supplierStatementRepository,
  type SupplierStatementContextInput
} from "../infrastructure/SupplierStatementRepository.js";
import type { SupplierAgingQuery, SupplierStatementQuery } from "../validators/supplier-statement.validators.js";

export class SupplierStatementService extends BaseService {
  constructor(private readonly repository = supplierStatementRepository) {
    super();
  }

  listStatements(context: SupplierStatementContextInput, query: SupplierStatementQuery) {
    return this.repository.listStatementDetails(context, query);
  }

  getSupplierStatement(context: SupplierStatementContextInput, supplierId: string, query: SupplierStatementQuery) {
    return this.repository.getSupplierStatement(context, supplierId, query);
  }

  listAging(context: SupplierStatementContextInput, query: SupplierAgingQuery) {
    return this.repository.listAging(context, query);
  }

  getSupplierAging(context: SupplierStatementContextInput, supplierId: string, query: SupplierAgingQuery) {
    return this.repository.getSupplierAging(context, supplierId, query);
  }
}

export const supplierStatementService = new SupplierStatementService();
