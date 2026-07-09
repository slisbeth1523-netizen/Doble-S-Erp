import { BaseService } from "../../../services/BaseService.js";
import {
  purchaseReceiptRepository,
  type PurchaseReceiptContextInput,
  type PurchaseReceiptCreateInput,
  type PurchaseReceiptLineCreateInput
} from "../infrastructure/PurchaseReceiptRepository.js";
import type {
  PurchaseReceiptCreatePayload,
  PurchaseReceiptLineCreatePayload,
  PurchaseReceiptListQuery
} from "../validators/purchase-receipt.validators.js";

export class PurchaseReceiptService extends BaseService {
  private readonly repository = purchaseReceiptRepository;

  createPurchaseReceipt(context: PurchaseReceiptContextInput, payload: PurchaseReceiptCreatePayload) {
    const input: PurchaseReceiptCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.createPurchaseReceipt(input);
  }

  listPurchaseReceipts(context: PurchaseReceiptContextInput, query: PurchaseReceiptListQuery) {
    return this.repository.listPurchaseReceipts(context, query);
  }

  getPurchaseReceipt(context: PurchaseReceiptContextInput, purchaseReceiptId: string) {
    return this.repository.getPurchaseReceipt(context, purchaseReceiptId);
  }

  addPurchaseReceiptLine(
    context: PurchaseReceiptContextInput,
    purchaseReceiptId: string,
    payload: PurchaseReceiptLineCreatePayload
  ) {
    const input: PurchaseReceiptLineCreateInput = {
      ...context,
      ...payload
    };

    return this.repository.addPurchaseReceiptLine(input, purchaseReceiptId, payload);
  }

  completePurchaseReceipt(context: PurchaseReceiptContextInput, purchaseReceiptId: string) {
    return this.repository.completePurchaseReceipt(context, purchaseReceiptId);
  }
}

export const purchaseReceiptService = new PurchaseReceiptService();
