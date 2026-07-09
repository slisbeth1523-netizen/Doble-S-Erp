import { BaseService } from "../../../services/BaseService.js";
import {
  purchaseOrderRepository,
  type PurchaseOrderCancelInput,
  type PurchaseOrderContextInput,
  type PurchaseOrderCreateInput
} from "../infrastructure/PurchaseOrderRepository.js";
import type {
  PurchaseOrderCancelPayload,
  PurchaseOrderCreatePayload,
  PurchaseOrderListQuery
} from "../validators/purchase-order.validators.js";

export class PurchaseOrderService extends BaseService {
  constructor(private readonly repository = purchaseOrderRepository) {
    super();
  }

  createPurchaseOrder(context: PurchaseOrderContextInput, payload: PurchaseOrderCreatePayload) {
    const input: PurchaseOrderCreateInput = {
      ...payload,
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId
    };

    return this.repository.createPurchaseOrder(input);
  }

  listPurchaseOrders(context: PurchaseOrderContextInput, query: PurchaseOrderListQuery) {
    return this.repository.listPurchaseOrders(context, query);
  }

  getPurchaseOrder(context: PurchaseOrderContextInput, purchaseOrderId: string) {
    return this.repository.getPurchaseOrder(context, purchaseOrderId);
  }

  approvePurchaseOrder(context: PurchaseOrderContextInput, purchaseOrderId: string) {
    return this.repository.approvePurchaseOrder(context, purchaseOrderId);
  }

  cancelPurchaseOrder(
    context: PurchaseOrderContextInput,
    purchaseOrderId: string,
    payload: PurchaseOrderCancelPayload
  ) {
    const input: PurchaseOrderCancelInput = {
      ...payload,
      tenantId: context.tenantId,
      companyId: context.companyId,
      userId: context.userId
    };

    return this.repository.cancelPurchaseOrder(input, purchaseOrderId);
  }
}

export const purchaseOrderService = new PurchaseOrderService();
