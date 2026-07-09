import { BaseService } from "../../../services/BaseService.js";
import {
  supplierInvoiceRepository,
  type SupplierInvoiceContextInput,
  type SupplierInvoiceCreateInput,
  type SupplierInvoiceLineCreateInput
} from "../infrastructure/SupplierInvoiceRepository.js";
import type {
  SupplierInvoiceCreatePayload,
  SupplierInvoiceLineCreatePayload,
  SupplierInvoiceListQuery
} from "../validators/supplier-invoice.validators.js";

export class SupplierInvoiceService extends BaseService {
  private readonly repository = supplierInvoiceRepository;

  createSupplierInvoice(context: SupplierInvoiceContextInput, payload: SupplierInvoiceCreatePayload) {
    const input: SupplierInvoiceCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.createSupplierInvoice(input);
  }

  listSupplierInvoices(context: SupplierInvoiceContextInput, query: SupplierInvoiceListQuery) {
    return this.repository.listSupplierInvoices(context, query);
  }

  getSupplierInvoice(context: SupplierInvoiceContextInput, supplierInvoiceId: string) {
    return this.repository.getSupplierInvoice(context, supplierInvoiceId);
  }

  addSupplierInvoiceLine(
    context: SupplierInvoiceContextInput,
    supplierInvoiceId: string,
    payload: SupplierInvoiceLineCreatePayload
  ) {
    const input: SupplierInvoiceLineCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.addSupplierInvoiceLine(input, supplierInvoiceId, payload);
  }

  completeSupplierInvoice(context: SupplierInvoiceContextInput, supplierInvoiceId: string) {
    return this.repository.completeSupplierInvoice(context, supplierInvoiceId);
  }
}

export const supplierInvoiceService = new SupplierInvoiceService();
