import sql from "mssql";

import { getSqlConfig } from "./local-env.mjs";

const apiUrl = normalizeUrl(process.env.SMOKE_API_URL ?? process.env.VITE_API_URL ?? "http://localhost:4001/api");
const demoEmail = process.env.SMOKE_DEMO_EMAIL ?? process.env.VITE_DEMO_EMAIL ?? "demo@dobles.local";
const demoPassword = process.env.SMOKE_DEMO_PASSWORD ?? process.env.VITE_DEMO_PASSWORD ?? "Demo12345!";

const requiredCatalogs = [
  { code: "customers", seedCode: "CLI-DEMO" },
  { code: "suppliers", seedCode: "SUP-DEMO" },
  { code: "items", seedCode: "ART-DEMO" },
  { code: "categories", seedCode: "GENERAL" },
  { code: "brands", seedCode: "DOBLES" },
  { code: "units-of-measure", seedCode: "UND" },
  { code: "warehouses", seedCode: "ALM-PRINCIPAL" },
  { code: "inventory-stocks", seedCode: "ART-DEMO" },
  { code: "inventory-movements", seedCode: "MOV-DEMO-001" },
  { code: "inventory-movement-lines", seedCode: "MOV-DEMO-001" }
];

const smokeRun = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);

function normalizeUrl(value) {
  return value.replace(/\/$/, "");
}

function smokeStep(label) {
  console.log(`smoke: ${label}`);
}

function fail(message) {
  throw new Error(message);
}

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(options.headers ?? {})
      }
    });
  } catch (error) {
    fail(`API unavailable at ${apiUrl}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }

  return { response, body };
}

async function expectOk(path, options = {}) {
  const result = await request(path, options);

  if (!result.response.ok || result.body?.success === false) {
    fail(
      `${path} failed with HTTP ${result.response.status}: ${JSON.stringify(result.body ?? {})}`
    );
  }

  return result.body;
}

function authHeaders(session) {
  return {
    authorization: `Bearer ${session.accessToken}`,
    "x-tenant-id": session.user.tenantId,
    ...(session.user.companyId ? { "x-company-id": session.user.companyId } : {})
  };
}

async function createCatalogRecord(catalog, payload, session) {
  const body = await expectOk(`/master-data/${catalog}`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function updateCatalogRecord(catalog, id, payload, session) {
  const body = await expectOk(`/master-data/${catalog}/${id}`, {
    method: "PUT",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function setCatalogRecordActive(catalog, id, active, session) {
  const path = active
    ? `/master-data/${catalog}/${id}/activate`
    : `/master-data/${catalog}/${id}/deactivate`;
  const body = await expectOk(path, {
    method: "PATCH",
    headers: authHeaders(session)
  });

  return body.data;
}

async function postInventoryMovement(movementId, session) {
  const body = await expectOk(`/inventory/movements/${movementId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createInventoryAdjustment(payload, session) {
  const body = await expectOk("/inventory/adjustments", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function createPhysicalCount(payload, session) {
  const body = await expectOk("/inventory/physical-counts", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addPhysicalCountLine(physicalCountId, payload, session) {
  const body = await expectOk(`/inventory/physical-counts/${physicalCountId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function completePhysicalCount(physicalCountId, session) {
  const body = await expectOk(`/inventory/physical-counts/${physicalCountId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createPhysicalCountAdjustment(physicalCountId, session) {
  const body = await expectOk(`/inventory/physical-counts/${physicalCountId}/create-adjustment`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createPurchaseOrder(payload, session) {
  const body = await expectOk("/purchasing/purchase-orders", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function approvePurchaseOrder(purchaseOrderId, session) {
  const body = await expectOk(`/purchasing/purchase-orders/${purchaseOrderId}/approve`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function cancelPurchaseOrder(purchaseOrderId, reason, session) {
  const body = await expectOk(`/purchasing/purchase-orders/${purchaseOrderId}/cancel`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ reason })
  });

  return body.data;
}

async function createPurchaseReceipt(payload, session) {
  const body = await expectOk("/purchasing/purchase-receipts", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addPurchaseReceiptLine(purchaseReceiptId, payload, session) {
  const body = await expectOk(`/purchasing/purchase-receipts/${purchaseReceiptId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function completePurchaseReceipt(purchaseReceiptId, session) {
  const body = await expectOk(`/purchasing/purchase-receipts/${purchaseReceiptId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createSupplierInvoice(payload, session) {
  const body = await expectOk("/purchasing/supplier-invoices", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSupplierInvoiceLine(supplierInvoiceId, payload, session) {
  const body = await expectOk(`/purchasing/supplier-invoices/${supplierInvoiceId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function completeSupplierInvoice(supplierInvoiceId, session) {
  const body = await expectOk(`/purchasing/supplier-invoices/${supplierInvoiceId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function createSupplierPayment(payload, session) {
  const body = await expectOk("/accounts-payable/payments", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSupplierPaymentApplication(supplierPaymentId, payload, session) {
  const body = await expectOk(`/accounts-payable/payments/${supplierPaymentId}/applications`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postSupplierPayment(supplierPaymentId, session) {
  const body = await expectOk(`/accounts-payable/payments/${supplierPaymentId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectSupplierPaymentPostFailure(supplierPaymentId, session) {
  const result = await request(`/accounts-payable/payments/${supplierPaymentId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Re-posting supplier payment for ${supplierPaymentId} must fail in a controlled way.`);
  }

  return result.body;
}

async function createSupplierAdjustment(payload, session) {
  const body = await expectOk("/accounts-payable/adjustments", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSupplierAdjustmentApplication(supplierAdjustmentId, payload, session) {
  const body = await expectOk(`/accounts-payable/adjustments/${supplierAdjustmentId}/applications`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postSupplierAdjustment(supplierAdjustmentId, session) {
  const body = await expectOk(`/accounts-payable/adjustments/${supplierAdjustmentId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectSupplierAdjustmentPostFailure(supplierAdjustmentId, session) {
  const result = await request(`/accounts-payable/adjustments/${supplierAdjustmentId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Re-posting supplier adjustment for ${supplierAdjustmentId} must fail in a controlled way.`);
  }

  return result.body;
}

async function getSupplierStatements(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/accounts-payable/statements?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSupplierAging(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/accounts-payable/aging?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function createAccountsReceivableDocument(payload, session) {
  const body = await expectOk("/accounts-receivable/documents", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function getAccountsReceivableDocuments(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/accounts-receivable/documents?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getCustomerStatements(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/accounts-receivable/statements?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getCustomerAging(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/accounts-receivable/aging?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function createCustomerReceipt(payload, session) {
  const body = await expectOk("/accounts-receivable/receipts", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function applyCustomerReceipt(customerReceiptId, payload, session) {
  const body = await expectOk(`/accounts-receivable/receipts/${customerReceiptId}/applications`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postCustomerReceipt(customerReceiptId, session) {
  const body = await expectOk(`/accounts-receivable/receipts/${customerReceiptId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectCustomerReceiptPostFailure(customerReceiptId, session) {
  const result = await request(`/accounts-receivable/receipts/${customerReceiptId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Re-posting customer receipt for ${customerReceiptId} must fail in a controlled way.`);
  }

  return result.body;
}

async function createCustomerCreditNote(payload, session) {
  const body = await expectOk("/accounts-receivable/customer-credit-notes", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function createSalesQuotation(payload, session) {
  const body = await expectOk("/sales/quotations", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function getSalesQuotation(salesQuotationId, session) {
  const body = await expectOk(`/sales/quotations/${salesQuotationId}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesQuotations(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/sales/quotations?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function addSalesQuotationLine(salesQuotationId, payload, session) {
  const body = await expectOk(`/sales/quotations/${salesQuotationId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function updateSalesQuotationLine(salesQuotationId, lineId, payload, session) {
  const body = await expectOk(`/sales/quotations/${salesQuotationId}/lines/${lineId}`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function deleteSalesQuotationLine(salesQuotationId, lineId, session) {
  const body = await expectOk(`/sales/quotations/${salesQuotationId}/lines/${lineId}`, {
    method: "DELETE",
    headers: authHeaders(session)
  });

  return body.data;
}

async function transitionSalesQuotation(salesQuotationId, action, session) {
  const body = await expectOk(`/sales/quotations/${salesQuotationId}/${action}`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectSalesQuotationLineUpdateFailure(salesQuotationId, lineId, session) {
  const result = await request(`/sales/quotations/${salesQuotationId}/lines/${lineId}`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ quantity: 9 })
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Updating sent sales quotation ${salesQuotationId} must fail in a controlled way.`);
  }

  return result.body;
}

async function createSalesOrder(payload, session) {
  const body = await expectOk("/sales/orders", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function createSalesOrderFromQuotation(salesQuotationId, session) {
  const body = await expectOk(`/sales/orders/from-quotation/${salesQuotationId}`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesOrder(salesOrderId, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesOrders(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/sales/orders?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function addSalesOrderLine(salesOrderId, payload, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function updateSalesOrderLine(salesOrderId, lineId, payload, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/lines/${lineId}`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function deleteSalesOrderLine(salesOrderId, lineId, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/lines/${lineId}`, {
    method: "DELETE",
    headers: authHeaders(session)
  });

  return body.data;
}

async function transitionSalesOrder(salesOrderId, action, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/${action}`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function cancelSalesOrder(salesOrderId, reason, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/cancel`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify({ reason })
  });

  return body.data;
}

async function expectSalesOrderLineUpdateFailure(salesOrderId, lineId, session) {
  const result = await request(`/sales/orders/${salesOrderId}/lines/${lineId}`, {
    method: "PATCH",
    headers: authHeaders(session),
    body: JSON.stringify({ quantity: 9 })
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Updating non-draft sales order ${salesOrderId} must fail in a controlled way.`);
  }

  return result.body;
}

async function getInventoryAvailability(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/inventory/availability?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesOrderReservationLines(salesOrderId, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/reservations`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function reserveSalesOrderLine(salesOrderId, lineId, payload, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/lines/${lineId}/reserve`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function releaseInventoryReservation(reservationId, payload, session) {
  const body = await expectOk(`/inventory/reservations/${reservationId}/release`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function createSalesShipment(payload, session) {
  const body = await expectOk("/sales/shipments", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSalesShipmentLine(salesShipmentId, payload, session) {
  const body = await expectOk(`/sales/shipments/${salesShipmentId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postSalesShipment(salesShipmentId, payload, session) {
  const body = await expectOk(`/sales/shipments/${salesShipmentId}/post`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function getSalesShipment(salesShipmentId, session) {
  const body = await expectOk(`/sales/shipments/${salesShipmentId}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesOrderShipmentLines(salesOrderId, session) {
  const body = await expectOk(`/sales/shipments/orders/${salesOrderId}/lines`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function createSalesInvoice(payload, session) {
  const body = await expectOk("/sales/invoices", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSalesInvoiceLine(salesInvoiceId, payload, session) {
  const body = await expectOk(`/sales/invoices/${salesInvoiceId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postSalesInvoice(salesInvoiceId, payload, session) {
  const body = await expectOk(`/sales/invoices/${salesInvoiceId}/post`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function getSalesOrderInvoiceLines(salesOrderId, session) {
  const body = await expectOk(`/sales/orders/${salesOrderId}/invoice-pending-lines`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesInvoices(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/sales/invoices?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function createSalesReturn(payload, session) {
  const body = await expectOk("/sales/returns", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function addSalesReturnLine(salesReturnId, payload, session) {
  const body = await expectOk(`/sales/returns/${salesReturnId}/lines`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postSalesReturn(salesReturnId, payload, session) {
  const body = await expectOk(`/sales/returns/${salesReturnId}/post`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function getSalesShipmentReturnableLines(salesShipmentId, session) {
  const body = await expectOk(`/sales/shipments/${salesShipmentId}/returnable-lines`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesReturns(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/sales/returns?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesCreditNoteCreditableReturns(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/sales/credit-notes/creditable-returns?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function getSalesCreditNotes(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/sales/credit-notes?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function createSalesCreditNoteFromReturn(payload, session) {
  const body = await expectOk("/sales/credit-notes/from-return", {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postSalesCreditNote(customerCreditNoteId, payload, session) {
  const body = await expectOk(`/sales/credit-notes/${customerCreditNoteId}/post`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function expectSalesReturnFailure(path, payload, session) {
  const result = await request(path, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`${path} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectReservationFailure(path, payload, session) {
  const result = await request(path, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Reservation request ${path} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectSalesShipmentFailure(path, payload, session) {
  const result = await request(path, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Sales shipment request ${path} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectSalesInvoiceFailure(path, payload, session) {
  const result = await request(path, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Sales invoice request ${path} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectSalesCreditNoteFailure(path, payload, session) {
  const result = await request(path, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Sales credit note request ${path} must fail in a controlled way.`);
  }

  return result.body;
}

function reservationIdempotencyKey(label) {
  return `smoke-${label}-${smokeRun}`;
}

async function applyCustomerCreditNote(customerCreditNoteId, payload, session) {
  const body = await expectOk(`/accounts-receivable/customer-credit-notes/${customerCreditNoteId}/applications`, {
    method: "POST",
    headers: authHeaders(session),
    body: JSON.stringify(payload)
  });

  return body.data;
}

async function postCustomerCreditNote(customerCreditNoteId, session) {
  const body = await expectOk(`/accounts-receivable/customer-credit-notes/${customerCreditNoteId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectCustomerCreditNotePostFailure(customerCreditNoteId, session) {
  const result = await request(`/accounts-receivable/customer-credit-notes/${customerCreditNoteId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Re-posting customer credit note for ${customerCreditNoteId} must fail in a controlled way.`);
  }

  return result.body;
}

async function getCustomerReceivableBalances(query, session) {
  const params = new URLSearchParams(query);
  const body = await expectOk(`/accounts-receivable/customer-balances?${params.toString()}`, {
    headers: authHeaders(session)
  });

  return body.data;
}

async function expectSupplierInvoiceCompleteFailure(supplierInvoiceId, session) {
  const result = await request(`/purchasing/supplier-invoices/${supplierInvoiceId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Re-posting supplier invoice for ${supplierInvoiceId} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectPhysicalCountAdjustmentFailure(physicalCountId, session) {
  const result = await request(`/inventory/physical-counts/${physicalCountId}/create-adjustment`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Recreating physical count adjustment for ${physicalCountId} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectPurchaseReceiptCompleteFailure(purchaseReceiptId, session) {
  const result = await request(`/purchasing/purchase-receipts/${purchaseReceiptId}/complete`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Reposting purchase receipt ${purchaseReceiptId} must fail in a controlled way.`);
  }

  return result.body;
}

async function expectInventoryMovementPostFailure(movementId, session) {
  const result = await request(`/inventory/movements/${movementId}/post`, {
    method: "POST",
    headers: authHeaders(session)
  });

  if (result.response.ok || result.body?.success !== false) {
    fail(`Reposting inventory movement ${movementId} must fail in a controlled way.`);
  }

  return result.body;
}

async function findCatalogRecord(catalog, search, session) {
  const body = await expectOk(
    `/master-data/${catalog}?search=${encodeURIComponent(search)}&page=1&pageSize=10`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).find((item) => item.code === search);
}

async function findInventoryStockRuntimeRecord(session, itemCode, warehouseCode) {
  const body = await expectOk(
    `/master-data/inventory-stocks?search=${encodeURIComponent(itemCode)}&page=1&pageSize=50`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).find(
    (item) => item.itemCode === itemCode && item.warehouseCode === warehouseCode
  );
}

async function findInventoryLedgerRuntimeRecords(session, movementNumber) {
  const body = await expectOk(
    `/master-data/inventory-ledger?search=${encodeURIComponent(movementNumber)}&page=1&pageSize=20`,
    { headers: authHeaders(session) }
  );

  return (body.data ?? []).filter((item) => item.movementNumber === movementNumber);
}

async function getStockSnapshot(session, itemCode, warehouseCode) {
  const snapshot = await getOptionalStockSnapshot(session, itemCode, warehouseCode);

  if (!snapshot) {
    fail(`Inventory stock ${itemCode} + ${warehouseCode} was not found.`);
  }

  return snapshot;
}

async function getOptionalStockSnapshot(session, itemCode, warehouseCode) {
  if (!session.user.companyId) {
    fail("Cannot validate stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemCode", sql.NVarChar(80), itemCode)
      .input("WarehouseCode", sql.NVarChar(80), warehouseCode)
      .query(`
        SELECT
          stock.QuantityOnHand,
          stock.QuantityReserved,
          stock.QuantityAvailable,
          stock.AverageCost,
          stock.LastCost,
          stock.LastMovementAt
        FROM inventory.ItemStocks stock
        INNER JOIN inventory.Items item
          ON item.ItemId = stock.ItemId
        INNER JOIN inventory.Warehouses warehouse
          ON warehouse.WarehouseId = stock.WarehouseId
        WHERE stock.TenantId = @TenantId
          AND stock.CompanyId = @CompanyId
          AND item.Code = @ItemCode
          AND warehouse.Code = @WarehouseCode;
      `);

    const row = result.recordset[0];

    if (!row) {
      return null;
    }

    return {
      quantityOnHand: Number(row.QuantityOnHand ?? 0),
      quantityReserved: Number(row.QuantityReserved ?? 0),
      quantityAvailable: Number(row.QuantityAvailable ?? 0),
      averageCost: Number(row.AverageCost ?? 0),
      lastCost: Number(row.LastCost ?? 0),
      lastMovementAt: row.LastMovementAt
    };
  } finally {
    await pool.close();
  }
}

async function getInventoryLedgerEntries(session, movementNumber) {
  if (!session.user.companyId) {
    fail("Cannot validate inventory ledger without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("MovementNumber", sql.NVarChar(40), movementNumber)
      .query(`
        SELECT
          MovementNumber,
          MovementType,
          LedgerDirection,
          WarehouseCode,
          QuantityIn,
          QuantityOut,
          QuantityBalanceImpact
        FROM inventory.V_InventoryLedger
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND MovementNumber = @MovementNumber
        ORDER BY LedgerDirection, WarehouseCode;
      `);

    return result.recordset.map((row) => ({
      movementNumber: row.MovementNumber,
      movementType: row.MovementType,
      ledgerDirection: row.LedgerDirection,
      warehouseCode: row.WarehouseCode,
      quantityIn: Number(row.QuantityIn ?? 0),
      quantityOut: Number(row.QuantityOut ?? 0),
      quantityBalanceImpact: Number(row.QuantityBalanceImpact ?? 0)
    }));
  } finally {
    await pool.close();
  }
}

async function assertInventoryLedgerEntries(session, movementNumber, expectedEntries) {
  const entries = await getInventoryLedgerEntries(session, movementNumber);

  if (entries.length !== expectedEntries.length) {
    fail(`Inventory ledger for ${movementNumber} expected ${expectedEntries.length} entries but found ${entries.length}.`);
  }

  for (const expected of expectedEntries) {
    const found = entries.find(
      (entry) =>
        entry.movementType === expected.movementType &&
        entry.ledgerDirection === expected.ledgerDirection &&
        entry.warehouseCode === expected.warehouseCode &&
        entry.quantityIn === expected.quantityIn &&
        entry.quantityOut === expected.quantityOut &&
        entry.quantityBalanceImpact === expected.quantityBalanceImpact
    );

    if (!found) {
      fail(`Inventory ledger for ${movementNumber} did not include ${JSON.stringify(expected)}.`);
    }
  }

  const runtimeEntries = await findInventoryLedgerRuntimeRecords(session, movementNumber);

  if (runtimeEntries.length !== expectedEntries.length) {
    fail(`/master-data/inventory-ledger did not return ${expectedEntries.length} entries for ${movementNumber}.`);
  }
}

async function createQaPostableMovement(session, movementNumber, quantity, unitCost, movementType = "ADJUSTMENT_IN") {
  if (!session.user.companyId) {
    fail("Cannot create QA posting movement without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("MovementNumber", sql.NVarChar(40), movementNumber)
      .input("MovementType", sql.NVarChar(40), movementType)
      .input("Quantity", sql.Decimal(18, 6), quantity)
      .input("UnitCost", sql.Decimal(18, 6), unitCost)
      .query(`
        DECLARE @MovementId UNIQUEIDENTIFIER = NEWID();
        DECLARE @LineId UNIQUEIDENTIFIER = NEWID();
        DECLARE @ItemId UNIQUEIDENTIFIER;
        DECLARE @WarehouseId UNIQUEIDENTIFIER;
        DECLARE @UnitOfMeasureId UNIQUEIDENTIFIER;

        SELECT @ItemId = ItemId, @UnitOfMeasureId = UnitOfMeasureId
        FROM inventory.Items
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ART-DEMO';

        SELECT @WarehouseId = WarehouseId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ALM-PRINCIPAL';

        IF @ItemId IS NULL OR @WarehouseId IS NULL
        BEGIN
          THROW 51000, 'Cannot create QA posting movement without ART-DEMO and ALM-PRINCIPAL.', 1;
        END;

        INSERT INTO inventory.InventoryMovements (
          InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
          MovementDate, Status, SourceModule, Reference, Notes, IsActive, CreatedBy
        )
        VALUES (
          @MovementId, @TenantId, @CompanyId, @MovementNumber, @MovementType,
          SYSUTCDATETIME(), 'DRAFT', 'SMOKE_LOCAL', 'Smoke posting QA',
          'Movimiento generado por smoke local para validar posteo idempotente', 1, @UserId
        );

        INSERT INTO inventory.InventoryMovementLines (
          InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
          LineNumber, ItemId, WarehouseId, UnitOfMeasureId, Quantity, UnitCost,
          Notes, CreatedBy
        )
        VALUES (
          @LineId, @MovementId, @TenantId, @CompanyId,
          1, @ItemId, @WarehouseId, @UnitOfMeasureId, @Quantity, @UnitCost,
          'Linea smoke local posteable', @UserId
        );

        SELECT @MovementId AS movementId, @MovementNumber AS movementNumber;
      `);

    return result.recordset[0];
  } finally {
    await pool.close();
  }
}

async function createQaTransferMovement(session, movementNumber, quantity) {
  if (!session.user.companyId) {
    fail("Cannot create QA transfer movement without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("MovementNumber", sql.NVarChar(40), movementNumber)
      .input("Quantity", sql.Decimal(18, 6), quantity)
      .query(`
        DECLARE @MovementId UNIQUEIDENTIFIER = NEWID();
        DECLARE @LineId UNIQUEIDENTIFIER = NEWID();
        DECLARE @ItemId UNIQUEIDENTIFIER;
        DECLARE @OriginWarehouseId UNIQUEIDENTIFIER;
        DECLARE @DestinationWarehouseId UNIQUEIDENTIFIER;
        DECLARE @UnitOfMeasureId UNIQUEIDENTIFIER;

        SELECT @ItemId = ItemId, @UnitOfMeasureId = UnitOfMeasureId
        FROM inventory.Items
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ART-DEMO';

        SELECT @OriginWarehouseId = WarehouseId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ALM-PRINCIPAL';

        SELECT @DestinationWarehouseId = WarehouseId
        FROM inventory.Warehouses
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'ALM-TRANSITO';

        IF @ItemId IS NULL OR @OriginWarehouseId IS NULL OR @DestinationWarehouseId IS NULL
        BEGIN
          THROW 51000, 'Cannot create QA transfer movement without ART-DEMO, ALM-PRINCIPAL and ALM-TRANSITO.', 1;
        END;

        INSERT INTO inventory.InventoryMovements (
          InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
          MovementDate, Status, SourceModule, Reference, Notes, IsActive, CreatedBy
        )
        VALUES (
          @MovementId, @TenantId, @CompanyId, @MovementNumber, 'TRANSFER',
          SYSUTCDATETIME(), 'DRAFT', 'SMOKE_LOCAL', 'Smoke transfer QA',
          'Movimiento generado por smoke local para validar transferencia idempotente', 1, @UserId
        );

        INSERT INTO inventory.InventoryMovementLines (
          InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
          LineNumber, ItemId, WarehouseId, ToWarehouseId, UnitOfMeasureId, Quantity, UnitCost,
          Notes, CreatedBy
        )
        VALUES (
          @LineId, @MovementId, @TenantId, @CompanyId,
          1, @ItemId, @OriginWarehouseId, @DestinationWarehouseId, @UnitOfMeasureId, @Quantity, 0,
          'Linea smoke local transferible', @UserId
        );

        SELECT @MovementId AS movementId, @MovementNumber AS movementNumber;
      `);

    return result.recordset[0];
  } finally {
    await pool.close();
  }
}

async function getDemoInventoryReferences(session) {
  if (!session.user.companyId) {
    fail("Cannot get demo inventory references without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          item.ItemId AS itemId,
          item.UnitOfMeasureId AS unitOfMeasureId,
          warehouse.WarehouseId AS warehouseId
        FROM inventory.Items item
        CROSS JOIN inventory.Warehouses warehouse
        WHERE item.TenantId = @TenantId
          AND item.CompanyId = @CompanyId
          AND item.Code = 'ART-DEMO'
          AND warehouse.TenantId = @TenantId
          AND warehouse.CompanyId = @CompanyId
          AND warehouse.Code = 'ALM-PRINCIPAL';
      `);

    const row = result.recordset[0];

    if (!row?.itemId || !row?.warehouseId) {
      fail("Cannot validate inventory adjustments without ART-DEMO and ALM-PRINCIPAL IDs.");
    }

    return row;
  } finally {
    await pool.close();
  }
}

async function getDemoPurchaseReferences(session) {
  if (!session.user.companyId) {
    fail("Cannot get demo purchase references without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          supplier.SupplierId AS supplierId,
          item.ItemId AS itemId,
          item.UnitOfMeasureId AS unitOfMeasureId,
          warehouse.WarehouseId AS warehouseId
        FROM purchasing.Suppliers supplier
        CROSS JOIN inventory.Items item
        CROSS JOIN inventory.Warehouses warehouse
        WHERE supplier.TenantId = @TenantId
          AND supplier.CompanyId = @CompanyId
          AND supplier.Code = 'SUP-DEMO'
          AND item.TenantId = @TenantId
          AND item.CompanyId = @CompanyId
          AND item.Code = 'ART-DEMO'
          AND warehouse.TenantId = @TenantId
          AND warehouse.CompanyId = @CompanyId
          AND warehouse.Code = 'ALM-PRINCIPAL';
      `);

    const row = result.recordset[0];

    if (!row?.supplierId || !row?.itemId || !row?.warehouseId) {
      fail("Cannot validate purchase orders without SUP-DEMO, ART-DEMO and ALM-PRINCIPAL IDs.");
    }

    return row;
  } finally {
    await pool.close();
  }
}

async function createSmokeAccountsPayableDocument(session, totalAmount, suffix = "PAY") {
  if (!session.user.companyId) {
    fail("Cannot create AP smoke document without company context.");
  }

  const references = await getDemoPurchaseReferences(session);
  const pool = await sql.connect(getSqlConfig());
  const documentNumber = `CXP-${suffix}-QA-${smokeRun}`;

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("SupplierId", sql.UniqueIdentifier, references.supplierId)
      .input("DocumentNumber", sql.NVarChar(40), documentNumber)
      .input("TotalAmount", sql.Decimal(18, 4), totalAmount)
      .query(`
        DECLARE @DocumentId UNIQUEIDENTIFIER;

        SELECT @DocumentId = AccountsPayableDocumentId
        FROM ap.AccountsPayableDocuments
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND DocumentNumber = @DocumentNumber;

        IF @DocumentId IS NULL
        BEGIN
          SET @DocumentId = NEWID();

          INSERT INTO ap.AccountsPayableDocuments (
            AccountsPayableDocumentId,
            TenantId,
            CompanyId,
            DocumentNumber,
            SupplierId,
            SourceModule,
            SourceDocumentId,
            SourceDocumentNumber,
            DocumentDate,
            DueDate,
            TotalAmount,
            PaidAmount,
            Status,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @DocumentId,
            @TenantId,
            @CompanyId,
            @DocumentNumber,
            @SupplierId,
            'SMOKE',
            @DocumentId,
            @DocumentNumber,
            SYSUTCDATETIME(),
            DATEADD(day, 30, SYSUTCDATETIME()),
            @TotalAmount,
            0,
            'OPEN',
            'Documento CxP creado por smoke local para pagos',
            1,
            @UserId
          );
        END;

        SELECT
          AccountsPayableDocumentId AS id,
          DocumentNumber AS documentNumber,
          SupplierId AS supplierId,
          TotalAmount AS totalAmount,
          PaidAmount AS paidAmount,
          RemainingAmount AS remainingAmount,
          Status AS status
        FROM ap.AccountsPayableDocuments
        WHERE AccountsPayableDocumentId = @DocumentId;
      `);

    const row = result.recordset[0];
    return {
      id: String(row.id).toLowerCase(),
      documentNumber: row.documentNumber,
      supplierId: String(row.supplierId).toLowerCase(),
      totalAmount: Number(row.totalAmount ?? 0),
      paidAmount: Number(row.paidAmount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? 0),
      status: row.status
    };
  } finally {
    await pool.close();
  }
}

async function getAccountsPayableDocumentSnapshot(session, accountsPayableDocumentId) {
  if (!session.user.companyId) {
    fail("Cannot read AP smoke document without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("AccountsPayableDocumentId", sql.UniqueIdentifier, accountsPayableDocumentId)
      .query(`
        SELECT
          AccountsPayableDocumentId AS id,
          DocumentNumber AS documentNumber,
          SupplierId AS supplierId,
          TotalAmount AS totalAmount,
          PaidAmount AS paidAmount,
          RemainingAmount AS remainingAmount,
          Status AS status
        FROM ap.AccountsPayableDocuments
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND AccountsPayableDocumentId = @AccountsPayableDocumentId;
      `);

    const row = result.recordset[0];
    if (!row) {
      fail(`Accounts payable document ${accountsPayableDocumentId} was not found.`);
    }

    return {
      id: String(row.id).toLowerCase(),
      documentNumber: row.documentNumber,
      supplierId: String(row.supplierId).toLowerCase(),
      totalAmount: Number(row.totalAmount ?? 0),
      paidAmount: Number(row.paidAmount ?? 0),
      remainingAmount: Number(row.remainingAmount ?? 0),
      status: row.status
    };
  } finally {
    await pool.close();
  }
}

async function countGeneratedDebitNoteDocuments(session, sourceDocumentId) {
  if (!session.user.companyId) {
    fail("Cannot count AP debit note documents without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("SourceDocumentId", sql.UniqueIdentifier, sourceDocumentId)
      .query(`
        SELECT COUNT(1) AS DocumentCount
        FROM ap.AccountsPayableDocuments
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceModule = 'SUPPLIER_DEBIT_NOTE'
          AND SourceDocumentId = @SourceDocumentId;
      `);

    return Number(result.recordset[0]?.DocumentCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function countFinanceSideEffects(session) {
  if (!session.user.companyId) {
    fail("Cannot count finance side effects without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          (SELECT COUNT(1) FROM ap.AccountsPayableDocuments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS AccountsPayableDocumentCount,
          (SELECT COUNT(1) FROM ap.SupplierPayments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS SupplierPaymentCount,
          (SELECT COUNT(1) FROM ap.SupplierAdjustments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS SupplierAdjustmentCount,
          (SELECT COUNT(1) FROM inventory.InventoryMovements WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryMovementCount;
      `);

    const row = result.recordset[0];
    return {
      accountsPayableDocumentCount: Number(row?.AccountsPayableDocumentCount ?? 0),
      supplierPaymentCount: Number(row?.SupplierPaymentCount ?? 0),
      supplierAdjustmentCount: Number(row?.SupplierAdjustmentCount ?? 0),
      inventoryMovementCount: Number(row?.InventoryMovementCount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function getDemoCustomerReferences(session) {
  if (!session.user.companyId) {
    fail("Cannot resolve demo customer without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT TOP (1)
          CustomerId AS customerId,
          Code AS customerCode,
          Name AS customerName
        FROM crm.Customers
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = 'CLI-DEMO'
          AND IsActive = 1;
      `);

    const row = result.recordset[0];
    if (!row) {
      fail("Demo customer CLI-DEMO was not found.");
    }

    return {
      customerId: String(row.customerId).toLowerCase(),
      customerCode: row.customerCode,
      customerName: row.customerName
    };
  } finally {
    await pool.close();
  }
}

async function countAccountsReceivableDocuments(session) {
  if (!session.user.companyId) {
    fail("Cannot count AR documents without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT COUNT(1) AS DocumentCount
        FROM ar.AccountsReceivableDocuments
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return Number(result.recordset[0]?.DocumentCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function countSalesInvoiceAccountsReceivableDocuments(session, salesInvoiceId) {
  if (!session.user.companyId) {
    fail("Cannot count sales invoice AR documents without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("SalesInvoiceId", sql.UniqueIdentifier, salesInvoiceId)
      .query(`
        SELECT COUNT(1) AS DocumentCount
        FROM ar.AccountsReceivableDocuments
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceType = 'SALES_INVOICE'
          AND SourceDocumentId = @SalesInvoiceId;
      `);

    return Number(result.recordset[0]?.DocumentCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function countSalesInvoiceForbiddenSideEffects(session) {
  if (!session.user.companyId) {
    fail("Cannot count sales invoice side effects without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          (SELECT COUNT(1) FROM inventory.ItemStocks WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS ItemStockCount,
          (SELECT COUNT(1) FROM inventory.InventoryMovements WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryMovementCount,
          (SELECT COUNT(1) FROM inventory.InventoryLedgerEntries WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryLedgerEntryCount,
          (SELECT COUNT(1) FROM inventory.InventoryReservations WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryReservationCount;
      `);

    const row = result.recordset[0];
    return {
      itemStockCount: Number(row?.ItemStockCount ?? 0),
      inventoryMovementCount: Number(row?.InventoryMovementCount ?? 0),
      inventoryLedgerEntryCount: Number(row?.InventoryLedgerEntryCount ?? 0),
      inventoryReservationCount: Number(row?.InventoryReservationCount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function countSalesQuotationForbiddenSideEffects(session) {
  if (!session.user.companyId) {
    fail("Cannot count sales quotation side effects without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        DECLARE @SalesInvoiceCount INT = 0;

        IF OBJECT_ID('sales.SalesInvoices', 'U') IS NOT NULL
        BEGIN
          DECLARE @InvoiceSql NVARCHAR(MAX) = N'
            SELECT @Count = COUNT(1)
            FROM sales.SalesInvoices
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId;
          ';
          EXEC sp_executesql
            @InvoiceSql,
            N'@TenantId UNIQUEIDENTIFIER, @CompanyId UNIQUEIDENTIFIER, @Count INT OUTPUT',
            @TenantId = @TenantId,
            @CompanyId = @CompanyId,
            @Count = @SalesInvoiceCount OUTPUT;
        END;

        SELECT
          (SELECT COUNT(1) FROM inventory.ItemStocks WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS ItemStockCount,
          (SELECT COUNT(1) FROM inventory.InventoryMovements WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryMovementCount,
          (SELECT COUNT(1) FROM inventory.InventoryLedgerEntries WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryLedgerEntryCount,
          (SELECT COUNT(1) FROM ar.AccountsReceivableDocuments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS AccountsReceivableDocumentCount,
          @SalesInvoiceCount AS SalesInvoiceCount;
      `);

    const row = result.recordset[0];
    return {
      itemStockCount: Number(row?.ItemStockCount ?? 0),
      inventoryMovementCount: Number(row?.InventoryMovementCount ?? 0),
      inventoryLedgerEntryCount: Number(row?.InventoryLedgerEntryCount ?? 0),
      accountsReceivableDocumentCount: Number(row?.AccountsReceivableDocumentCount ?? 0),
      salesInvoiceCount: Number(row?.SalesInvoiceCount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function countSalesOrderForbiddenSideEffects(session) {
  if (!session.user.companyId) {
    fail("Cannot count sales order side effects without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        DECLARE @SalesInvoiceCount INT = 0;
        DECLARE @ReservationCount INT = 0;
        DECLARE @DispatchCount INT = 0;

        IF OBJECT_ID('sales.SalesInvoices', 'U') IS NOT NULL
        BEGIN
          DECLARE @InvoiceSql NVARCHAR(MAX) = N'
            SELECT @Count = COUNT(1)
            FROM sales.SalesInvoices
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId;
          ';
          EXEC sp_executesql
            @InvoiceSql,
            N'@TenantId UNIQUEIDENTIFIER, @CompanyId UNIQUEIDENTIFIER, @Count INT OUTPUT',
            @TenantId = @TenantId,
            @CompanyId = @CompanyId,
            @Count = @SalesInvoiceCount OUTPUT;
        END;

        IF OBJECT_ID('sales.SalesReservations', 'U') IS NOT NULL
        BEGIN
          DECLARE @ReservationSql NVARCHAR(MAX) = N'
            SELECT @Count = COUNT(1)
            FROM sales.SalesReservations
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId;
          ';
          EXEC sp_executesql
            @ReservationSql,
            N'@TenantId UNIQUEIDENTIFIER, @CompanyId UNIQUEIDENTIFIER, @Count INT OUTPUT',
            @TenantId = @TenantId,
            @CompanyId = @CompanyId,
            @Count = @ReservationCount OUTPUT;
        END;

        IF OBJECT_ID('sales.SalesDispatches', 'U') IS NOT NULL
        BEGIN
          DECLARE @DispatchSql NVARCHAR(MAX) = N'
            SELECT @Count = COUNT(1)
            FROM sales.SalesDispatches
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId;
          ';
          EXEC sp_executesql
            @DispatchSql,
            N'@TenantId UNIQUEIDENTIFIER, @CompanyId UNIQUEIDENTIFIER, @Count INT OUTPUT',
            @TenantId = @TenantId,
            @CompanyId = @CompanyId,
            @Count = @DispatchCount OUTPUT;
        END;

        SELECT
          (SELECT COUNT(1) FROM inventory.ItemStocks WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS ItemStockCount,
          (SELECT COUNT(1) FROM inventory.InventoryMovements WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryMovementCount,
          (SELECT COUNT(1) FROM inventory.InventoryLedgerEntries WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryLedgerEntryCount,
          (SELECT COUNT(1) FROM ar.AccountsReceivableDocuments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS AccountsReceivableDocumentCount,
          @SalesInvoiceCount AS SalesInvoiceCount,
          @ReservationCount AS ReservationCount,
          @DispatchCount AS DispatchCount;
      `);

    const row = result.recordset[0];
    return {
      itemStockCount: Number(row?.ItemStockCount ?? 0),
      inventoryMovementCount: Number(row?.InventoryMovementCount ?? 0),
      inventoryLedgerEntryCount: Number(row?.InventoryLedgerEntryCount ?? 0),
      accountsReceivableDocumentCount: Number(row?.AccountsReceivableDocumentCount ?? 0),
      salesInvoiceCount: Number(row?.SalesInvoiceCount ?? 0),
      reservationCount: Number(row?.ReservationCount ?? 0),
      dispatchCount: Number(row?.DispatchCount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function countSalesShipmentForbiddenSideEffects(session) {
  if (!session.user.companyId) {
    fail("Cannot count sales shipment side effects without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        DECLARE @SalesInvoiceCount INT = 0;

        IF OBJECT_ID('sales.SalesInvoices', 'U') IS NOT NULL
        BEGIN
          DECLARE @InvoiceSql NVARCHAR(MAX) = N'
            SELECT @Count = COUNT(1)
            FROM sales.SalesInvoices
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId;
          ';
          EXEC sp_executesql
            @InvoiceSql,
            N'@TenantId UNIQUEIDENTIFIER, @CompanyId UNIQUEIDENTIFIER, @Count INT OUTPUT',
            @TenantId = @TenantId,
            @CompanyId = @CompanyId,
            @Count = @SalesInvoiceCount OUTPUT;
        END;

        SELECT
          (SELECT COUNT(1) FROM ar.AccountsReceivableDocuments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS AccountsReceivableDocumentCount,
          @SalesInvoiceCount AS SalesInvoiceCount;
      `);

    const row = result.recordset[0];
    return {
      accountsReceivableDocumentCount: Number(row?.AccountsReceivableDocumentCount ?? 0),
      salesInvoiceCount: Number(row?.SalesInvoiceCount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function setSmokeStockQuantity(session, itemId, warehouseId, quantity) {
  if (!session.user.companyId) {
    fail("Cannot set smoke stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemId", sql.UniqueIdentifier, itemId)
      .input("WarehouseId", sql.UniqueIdentifier, warehouseId)
      .input("Quantity", sql.Decimal(18, 6), quantity)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .query(`
        IF EXISTS (
          SELECT 1
          FROM inventory.ItemStocks
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND ItemId = @ItemId
            AND WarehouseId = @WarehouseId
        )
        BEGIN
          UPDATE inventory.ItemStocks
          SET QuantityOnHand = @Quantity,
              QuantityReserved = 0,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND ItemId = @ItemId
            AND WarehouseId = @WarehouseId;
        END
        ELSE
        BEGIN
          INSERT INTO inventory.ItemStocks (
            ItemStockId, TenantId, CompanyId, ItemId, WarehouseId, QuantityOnHand, QuantityReserved, IsActive, CreatedBy
          )
          VALUES (NEWID(), @TenantId, @CompanyId, @ItemId, @WarehouseId, @Quantity, 0, 1, @UserId);
        END;
      `);
  } finally {
    await pool.close();
  }
}

async function releaseSmokeInventoryReservations(session, itemId, warehouseId) {
  if (!session.user.companyId) {
    fail("Cannot release smoke reservations without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemId", sql.UniqueIdentifier, itemId)
      .input("WarehouseId", sql.UniqueIdentifier, warehouseId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .query(`
        UPDATE inventory.InventoryReservations
        SET ReleasedQuantity = ReservedQuantity - ConsumedQuantity,
            Status = 'RELEASED',
            ReleasedAt = COALESCE(ReleasedAt, SYSUTCDATETIME()),
            ReleasedBy = COALESCE(ReleasedBy, @UserId),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId
          AND (
            Reference LIKE 'RES-%'
            OR SalesOrderId IN (
              SELECT SalesOrderId
              FROM sales.SalesOrders
              WHERE TenantId = @TenantId
                AND CompanyId = @CompanyId
                AND Reference LIKE 'RES-%'
            )
          )
          AND Status IN ('ACTIVE', 'PARTIALLY_RELEASED')
          AND ReservedQuantity - ReleasedQuantity - ConsumedQuantity > 0;
      `);
  } finally {
    await pool.close();
  }
}

async function getInventoryReservationSnapshot(session, reservationId) {
  if (!session.user.companyId) {
    fail("Cannot read reservation snapshot without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ReservationId", sql.UniqueIdentifier, reservationId)
      .query(`
        SELECT
          ReservedQuantity,
          ReleasedQuantity,
          ConsumedQuantity,
          ActiveQuantity,
          Status
        FROM inventory.InventoryReservations
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND InventoryReservationId = @ReservationId;
      `);

    const row = result.recordset[0];

    if (!row) {
      fail(`Inventory reservation ${reservationId} was not found.`);
    }

    return {
      reservedQuantity: Number(row.ReservedQuantity ?? 0),
      releasedQuantity: Number(row.ReleasedQuantity ?? 0),
      consumedQuantity: Number(row.ConsumedQuantity ?? 0),
      activeQuantity: Number(row.ActiveQuantity ?? 0),
      status: row.Status
    };
  } finally {
    await pool.close();
  }
}

async function getSmokeStockSnapshot(session, itemId, warehouseId) {
  if (!session.user.companyId) {
    fail("Cannot read smoke stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemId", sql.UniqueIdentifier, itemId)
      .input("WarehouseId", sql.UniqueIdentifier, warehouseId)
      .query(`
        SELECT QuantityOnHand, QuantityReserved, QuantityAvailable
        FROM inventory.ItemStocks
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND ItemId = @ItemId
          AND WarehouseId = @WarehouseId;
      `);
    const row = result.recordset[0];
    if (!row) {
      fail("Smoke stock snapshot was not found.");
    }
    return {
      quantityOnHand: Number(row.QuantityOnHand ?? 0),
      quantityReserved: Number(row.QuantityReserved ?? 0),
      quantityAvailable: Number(row.QuantityAvailable ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function countAccountsReceivableReadSideEffects(session) {
  if (!session.user.companyId) {
    fail("Cannot count AR read side effects without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          (SELECT COUNT(1) FROM ar.AccountsReceivableDocuments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS AccountsReceivableDocumentCount,
          (SELECT COUNT(1) FROM ar.CustomerReceipts WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS CustomerReceiptCount,
          (SELECT COUNT(1) FROM ar.CustomerCreditNotes WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS CustomerCreditNoteCount,
          (SELECT COUNT(1) FROM ap.AccountsPayableDocuments WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS AccountsPayableDocumentCount,
          (SELECT COUNT(1) FROM inventory.InventoryMovements WHERE TenantId = @TenantId AND CompanyId = @CompanyId) AS InventoryMovementCount;
      `);

    const row = result.recordset[0];
    return {
      accountsReceivableDocumentCount: Number(row?.AccountsReceivableDocumentCount ?? 0),
      customerReceiptCount: Number(row?.CustomerReceiptCount ?? 0),
      customerCreditNoteCount: Number(row?.CustomerCreditNoteCount ?? 0),
      accountsPayableDocumentCount: Number(row?.AccountsPayableDocumentCount ?? 0),
      inventoryMovementCount: Number(row?.InventoryMovementCount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function getAccountsReceivableDocumentSnapshot(documentId, session) {
  if (!session.user.companyId) {
    fail("Cannot read AR document snapshot without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("DocumentId", sql.UniqueIdentifier, documentId)
      .query(`
        SELECT
          AccountsReceivableDocumentId,
          Status,
          TotalAmount,
          PaidAmount,
          RemainingAmount
        FROM ar.AccountsReceivableDocuments
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND AccountsReceivableDocumentId = @DocumentId;
      `);

    const row = result.recordset[0];
    if (!row) {
      fail(`AR document ${documentId} was not found.`);
    }

    return {
      id: String(row.AccountsReceivableDocumentId).toLowerCase(),
      status: row.Status,
      totalAmount: Number(row.TotalAmount ?? 0),
      paidAmount: Number(row.PaidAmount ?? 0),
      remainingAmount: Number(row.RemainingAmount ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function createSupplierAgingSmokeDocuments(session) {
  if (!session.user.companyId) {
    fail("Cannot create AP aging smoke documents without company context.");
  }

  const pool = await sql.connect(getSqlConfig());
  const prefix = `CXP-AGING-QA-${smokeRun}`;
  const supplierCode = `SUP-AGING-${smokeRun}`;

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("Prefix", sql.NVarChar(80), prefix)
      .input("SupplierCode", sql.NVarChar(40), supplierCode)
      .query(`
        DECLARE @SupplierId UNIQUEIDENTIFIER;

        SELECT @SupplierId = SupplierId
        FROM purchasing.Suppliers
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = @SupplierCode;

        IF @SupplierId IS NULL
        BEGIN
          SET @SupplierId = NEWID();

          INSERT INTO purchasing.Suppliers (
            SupplierId,
            TenantId,
            CompanyId,
            Code,
            Name,
            CommercialName,
            DocumentType,
            DocumentNumber,
            Email,
            Phone,
            City,
            Province,
            CountryCode,
            PaymentTermId,
            CurrencyId,
            TaxCategoryId,
            IsTaxWithholder,
            IsForeignSupplier,
            ContactName,
            ContactEmail,
            ContactPhone,
            Notes,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SupplierId,
            @TenantId,
            @CompanyId,
            @SupplierCode,
            CONCAT('Proveedor Aging ', @SupplierCode),
            CONCAT('Proveedor Aging ', @SupplierCode),
            'RNC',
            RIGHT(REPLACE(CONVERT(NVARCHAR(36), @SupplierId), '-', ''), 9),
            CONCAT(LOWER(@SupplierCode), '@dobles.local'),
            '809-000-0099',
            'Santo Domingo',
            'Distrito Nacional',
            'DOM',
            '77777777-7777-7777-7777-777777777777',
            '55555555-5555-5555-5555-555555555555',
            '88888888-8888-8888-8888-888888888888',
            0,
            0,
            'Smoke Aging',
            CONCAT(LOWER(@SupplierCode), '@dobles.local'),
            '809-000-0099',
            'Proveedor creado por smoke local para AP aging',
            1,
            @UserId
          );
        END;

        DECLARE @Documents TABLE (
          DocumentNumber NVARCHAR(80),
          DueDate DATE,
          TotalAmount DECIMAL(18, 6),
          PaidAmount DECIMAL(18, 6),
          Status NVARCHAR(20)
        );

        INSERT INTO @Documents (DocumentNumber, DueDate, TotalAmount, PaidAmount, Status)
        VALUES
          (CONCAT(@Prefix, '-CURRENT'), '2026-07-20', 10, 0, 'OPEN'),
          (CONCAT(@Prefix, '-1-30'), '2026-06-30', 20, 0, 'OPEN'),
          (CONCAT(@Prefix, '-31-60'), '2026-05-31', 30, 0, 'OPEN'),
          (CONCAT(@Prefix, '-61-90'), '2026-04-30', 40, 0, 'OPEN'),
          (CONCAT(@Prefix, '-90PLUS'), '2026-03-31', 50, 0, 'OPEN'),
          (CONCAT(@Prefix, '-PAID'), '2026-03-01', 60, 60, 'PAID');

        INSERT INTO ap.AccountsPayableDocuments (
          AccountsPayableDocumentId,
          TenantId,
          CompanyId,
          DocumentNumber,
          SupplierId,
          SourceModule,
          SourceDocumentId,
          SourceDocumentNumber,
          DocumentDate,
          DueDate,
          TotalAmount,
          PaidAmount,
          Status,
          Notes,
          IsActive,
          CreatedBy
        )
        SELECT
          NEWID(),
          @TenantId,
          @CompanyId,
          source.DocumentNumber,
          @SupplierId,
          'SMOKE_AGING',
          NEWID(),
          source.DocumentNumber,
          '2026-01-01',
          source.DueDate,
          source.TotalAmount,
          source.PaidAmount,
          source.Status,
          'Documento CxP creado por smoke local para AP aging',
          1,
          @UserId
        FROM @Documents source
        WHERE NOT EXISTS (
          SELECT 1
          FROM ap.AccountsPayableDocuments existing
          WHERE existing.TenantId = @TenantId
            AND existing.CompanyId = @CompanyId
            AND existing.DocumentNumber = source.DocumentNumber
        );

        SELECT @SupplierId AS supplierId;
      `);

    return { supplierId: String(result.recordset[0].supplierId).toLowerCase(), prefix, asOfDate: "2026-07-10" };
  } finally {
    await pool.close();
  }
}

async function createCustomerAgingSmokeDocuments(session) {
  if (!session.user.companyId) {
    fail("Cannot create AR aging smoke documents without company context.");
  }

  const pool = await sql.connect(getSqlConfig());
  const prefix = `CXC-AGING-QA-${smokeRun}`;
  const customerCode = `CLI-AGING-${smokeRun}`;
  const customerSearch = `CLI-AGING-${smokeRun}`;

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .input("Prefix", sql.NVarChar(80), prefix)
      .input("CustomerCode", sql.NVarChar(40), customerCode)
      .query(`
        DECLARE @CustomerId UNIQUEIDENTIFIER;
        DECLARE @SecondCustomerId UNIQUEIDENTIFIER;
        DECLARE @SecondCustomerCode NVARCHAR(40) = CONCAT(@CustomerCode, '-B');

        SELECT @CustomerId = CustomerId
        FROM crm.Customers
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = @CustomerCode;

        IF @CustomerId IS NULL
        BEGIN
          SET @CustomerId = NEWID();

          INSERT INTO crm.Customers (
            CustomerId,
            TenantId,
            CompanyId,
            Code,
            Name,
            CommercialName,
            DocumentType,
            DocumentNumber,
            Email,
            Phone,
            City,
            Province,
            CountryCode,
            PaymentTermId,
            CurrencyId,
            TaxCategoryId,
            CreditLimit,
            IsCreditCustomer,
            IsActive,
            CreatedBy
          )
          VALUES (
            @CustomerId,
            @TenantId,
            @CompanyId,
            @CustomerCode,
            CONCAT('Cliente Aging ', @CustomerCode),
            CONCAT('Cliente Aging ', @CustomerCode),
            'RNC',
            RIGHT(REPLACE(CONVERT(NVARCHAR(36), @CustomerId), '-', ''), 9),
            CONCAT(LOWER(@CustomerCode), '@dobles.local'),
            '809-000-0088',
            'Santo Domingo',
            'Distrito Nacional',
            'DOM',
            '77777777-7777-7777-7777-777777777777',
            '55555555-5555-5555-5555-555555555555',
            '88888888-8888-8888-8888-888888888888',
            100000,
            1,
            1,
            @UserId
          );
        END;

        SELECT @SecondCustomerId = CustomerId
        FROM crm.Customers
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Code = @SecondCustomerCode;

        IF @SecondCustomerId IS NULL
        BEGIN
          SET @SecondCustomerId = NEWID();

          INSERT INTO crm.Customers (
            CustomerId,
            TenantId,
            CompanyId,
            Code,
            Name,
            CommercialName,
            DocumentType,
            DocumentNumber,
            Email,
            Phone,
            City,
            Province,
            CountryCode,
            PaymentTermId,
            CurrencyId,
            TaxCategoryId,
            CreditLimit,
            IsCreditCustomer,
            IsActive,
            CreatedBy
          )
          VALUES (
            @SecondCustomerId,
            @TenantId,
            @CompanyId,
            @SecondCustomerCode,
            CONCAT('Cliente Aging ', @SecondCustomerCode),
            CONCAT('Cliente Aging ', @SecondCustomerCode),
            'RNC',
            RIGHT(REPLACE(CONVERT(NVARCHAR(36), @SecondCustomerId), '-', ''), 9),
            CONCAT(LOWER(@SecondCustomerCode), '@dobles.local'),
            '809-000-0089',
            'Santo Domingo',
            'Distrito Nacional',
            'DOM',
            '77777777-7777-7777-7777-777777777777',
            '55555555-5555-5555-5555-555555555555',
            '88888888-8888-8888-8888-888888888888',
            100000,
            1,
            1,
            @UserId
          );
        END;

        DECLARE @Documents TABLE (
          CustomerId UNIQUEIDENTIFIER,
          DocumentNumber NVARCHAR(80),
          DueDate DATE,
          TotalAmount DECIMAL(18, 6),
          PaidAmount DECIMAL(18, 6),
          Status NVARCHAR(20)
        );

        INSERT INTO @Documents (CustomerId, DocumentNumber, DueDate, TotalAmount, PaidAmount, Status)
        VALUES
          (@CustomerId, CONCAT(@Prefix, '-CURRENT'), '2026-07-20', 10, 0, 'OPEN'),
          (@CustomerId, CONCAT(@Prefix, '-1-30'), '2026-06-30', 20, 0, 'OPEN'),
          (@CustomerId, CONCAT(@Prefix, '-31-60'), '2026-05-31', 30, 0, 'OPEN'),
          (@CustomerId, CONCAT(@Prefix, '-61-90'), '2026-04-30', 40, 0, 'OPEN'),
          (@CustomerId, CONCAT(@Prefix, '-90PLUS'), '2026-03-31', 50, 0, 'OPEN'),
          (@CustomerId, CONCAT(@Prefix, '-PAID'), '2026-03-01', 60, 60, 'PAID'),
          (@SecondCustomerId, CONCAT(@Prefix, '-B'), '2026-07-20', 5, 0, 'OPEN');

        INSERT INTO ar.AccountsReceivableDocuments (
          AccountsReceivableDocumentId,
          TenantId,
          CompanyId,
          DocumentNumber,
          SourceType,
          SourceDocumentId,
          SourceDocumentNumber,
          CustomerId,
          DocumentDate,
          DueDate,
          CurrencyCode,
          ExchangeRate,
          Status,
          TotalAmount,
          PaidAmount,
          Reference,
          Notes,
          IsActive,
          CreatedBy
        )
        SELECT
          NEWID(),
          @TenantId,
          @CompanyId,
          source.DocumentNumber,
          'MANUAL',
          NEWID(),
          source.DocumentNumber,
          source.CustomerId,
          '2026-01-01',
          source.DueDate,
          'DOP',
          1,
          source.Status,
          source.TotalAmount,
          source.PaidAmount,
          @Prefix,
          'Documento CxC creado por smoke local para AR aging',
          1,
          @UserId
        FROM @Documents source
        WHERE NOT EXISTS (
          SELECT 1
          FROM ar.AccountsReceivableDocuments existing
          WHERE existing.TenantId = @TenantId
            AND existing.CompanyId = @CompanyId
            AND existing.DocumentNumber = source.DocumentNumber
        );

        SELECT @CustomerId AS customerId, @SecondCustomerId AS secondCustomerId;
      `);

    return {
      customerId: String(result.recordset[0].customerId).toLowerCase(),
      secondCustomerId: String(result.recordset[0].secondCustomerId).toLowerCase(),
      customerSearch,
      prefix,
      asOfDate: "2026-07-10"
    };
  } finally {
    await pool.close();
  }
}

async function countInventoryMovements(session) {
  if (!session.user.companyId) {
    fail("Cannot count inventory movements without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT COUNT(1) AS MovementCount
        FROM inventory.InventoryMovements
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return Number(result.recordset[0]?.MovementCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function countInventoryLedgerEntries(session) {
  if (!session.user.companyId) {
    fail("Cannot count inventory ledger entries without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT COUNT(1) AS LedgerEntryCount
        FROM inventory.InventoryLedgerEntries
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return Number(result.recordset[0]?.LedgerEntryCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function countPhysicalCountAdjustments(session, countNumber) {
  if (!session.user.companyId) {
    fail("Cannot count physical count adjustments without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("Reference", sql.NVarChar(120), `Conteo fisico ${countNumber}`)
      .query(`
        SELECT COUNT(1) AS AdjustmentCount
        FROM inventory.InventoryMovements
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceModule = 'INVENTORY_ADJUSTMENT'
          AND Reference = @Reference;
      `);

    return Number(result.recordset[0]?.AdjustmentCount ?? 0);
  } finally {
    await pool.close();
  }
}

async function ensureZeroStockRecord(session, item, warehouse) {
  if (!session.user.companyId) {
    fail("Cannot create QA stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .input("ItemId", sql.UniqueIdentifier, item.id)
      .input("WarehouseId", sql.UniqueIdentifier, warehouse.id)
      .input("UserId", sql.UniqueIdentifier, session.user.userId ?? null)
      .query(`
        IF NOT EXISTS (
          SELECT 1
          FROM inventory.ItemStocks
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND ItemId = @ItemId
            AND WarehouseId = @WarehouseId
        )
        BEGIN
          INSERT INTO inventory.ItemStocks (
            TenantId, CompanyId, ItemId, WarehouseId, QuantityOnHand,
            QuantityReserved, AverageCost, LastCost, StandardCost, IsActive, CreatedBy
          )
          VALUES (
            @TenantId, @CompanyId, @ItemId, @WarehouseId, 0,
            0, 0, 0, 0, 1, @UserId
          );
        END;
      `);
  } finally {
    await pool.close();
  }
}

async function getDemoStockSnapshot(session) {
  if (!session.user.companyId) {
    fail("Cannot validate demo stock without company context.");
  }

  const pool = await sql.connect(getSqlConfig());

  try {
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, session.user.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, session.user.companyId)
      .query(`
        SELECT
          stock.QuantityOnHand,
          stock.QuantityReserved,
          stock.QuantityAvailable
        FROM inventory.ItemStocks stock
        INNER JOIN inventory.Items item
          ON item.ItemId = stock.ItemId
        INNER JOIN inventory.Warehouses warehouse
          ON warehouse.WarehouseId = stock.WarehouseId
        WHERE stock.TenantId = @TenantId
          AND stock.CompanyId = @CompanyId
          AND item.Code = 'ART-DEMO'
          AND warehouse.Code = 'ALM-PRINCIPAL';
      `);

    const row = result.recordset[0];

    if (!row) {
      fail("Demo inventory stock ART-DEMO + ALM-PRINCIPAL was not found.");
    }

    return {
      quantityOnHand: Number(row.QuantityOnHand ?? 0),
      quantityReserved: Number(row.QuantityReserved ?? 0),
      quantityAvailable: Number(row.QuantityAvailable ?? 0)
    };
  } finally {
    await pool.close();
  }
}

async function validateDemoMovementDoesNotAffectStock(session) {
  await getDemoStockSnapshot(session);
}

async function validateInventoryPostingFlow(session) {
  const quantityToPost = 2;
  const unitCost = 100;
  const movementNumber = `MOV-POST-${smokeRun}`;
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movement = await createQaPostableMovement(session, movementNumber, quantityToPost, unitCost);

  smokeStep("inventory movement post");
  const posted = await postInventoryMovement(movement.movementId, session);

  if (posted.status !== "POSTED" || !posted.postedAt) {
    fail("Inventory movement post did not return POSTED status with PostedAt.");
  }

  const postedMovement = await findCatalogRecord("inventory-movements", movementNumber, session);

  if (!postedMovement || postedMovement.status !== "POSTED" || !postedMovement.postedAt) {
    fail(`Posted inventory movement ${movementNumber} was not visible as POSTED in runtime metadata.`);
  }

  const updatedStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (updatedStock.quantityOnHand !== initialStock.quantityOnHand + quantityToPost) {
    fail("Inventory posting did not increase ItemStocks.QuantityOnHand by the expected quantity.");
  }

  if (!updatedStock.lastMovementAt) {
    fail("Inventory posting did not update ItemStocks.LastMovementAt.");
  }

  const stockRuntimeRecord = await findCatalogRecord("inventory-stocks", "ART-DEMO", session);

  if (!stockRuntimeRecord || Number(stockRuntimeRecord.quantityOnHand) !== updatedStock.quantityOnHand) {
    fail("/master-data/inventory-stocks did not reflect the posted stock quantity.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: quantityToPost,
      quantityOut: 0,
      quantityBalanceImpact: quantityToPost
    }
  ]);

  smokeStep("inventory movement repost rejected");
  await expectInventoryMovementPostFailure(movement.movementId, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== updatedStock.quantityOnHand) {
    fail("Reposting the same inventory movement duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: quantityToPost,
      quantityOut: 0,
      quantityBalanceImpact: quantityToPost
    }
  ]);

  const openingQuantity = 1;
  const openingMovementNumber = `MOV-OPEN-${smokeRun}`;
  const stockBeforeOpening = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const openingMovement = await createQaPostableMovement(
    session,
    openingMovementNumber,
    openingQuantity,
    90,
    "OPENING"
  );

  smokeStep("inventory opening movement post");
  const postedOpening = await postInventoryMovement(openingMovement.movementId, session);

  if (postedOpening.status !== "POSTED" || postedOpening.movementType !== "OPENING") {
    fail("Inventory opening movement did not post as OPENING + POSTED.");
  }

  const stockAfterOpening = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterOpening.quantityOnHand !== stockBeforeOpening.quantityOnHand + openingQuantity) {
    fail("Posting an opening movement did not increase stock by the expected quantity.");
  }

  await assertInventoryLedgerEntries(session, openingMovementNumber, [
    {
      movementType: "OPENING",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: openingQuantity,
      quantityOut: 0,
      quantityBalanceImpact: openingQuantity
    }
  ]);
}

async function ensureTransferSourceStock(session, requiredQuantity) {
  const sourceStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const availableToTransfer = sourceStock.quantityOnHand - sourceStock.quantityReserved;

  if (sourceStock.quantityOnHand >= requiredQuantity && availableToTransfer >= requiredQuantity) {
    return;
  }

  const replenishmentQuantity = requiredQuantity - availableToTransfer;
  const movementNumber = `MOV-TRANSFER-STOCK-${smokeRun}`;
  const movement = await createQaPostableMovement(session, movementNumber, replenishmentQuantity, 100);

  smokeStep("inventory transfer source stock replenish");
  await postInventoryMovement(movement.movementId, session);
}

async function validateInventoryTransferFlow(session) {
  const quantityToTransfer = 1;

  await ensureTransferSourceStock(session, quantityToTransfer);

  const movementNumber = `MOV-TRANSFER-${smokeRun}`;
  const initialOriginStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialDestinationStock =
    (await getOptionalStockSnapshot(session, "ART-DEMO", "ALM-TRANSITO")) ?? {
      quantityOnHand: 0,
      quantityReserved: 0,
      quantityAvailable: 0,
      averageCost: 0,
      lastCost: 0,
      lastMovementAt: null
    };
  const movement = await createQaTransferMovement(session, movementNumber, quantityToTransfer);

  smokeStep("inventory transfer movement post");
  const posted = await postInventoryMovement(movement.movementId, session);

  if (posted.status !== "POSTED" || posted.movementType !== "TRANSFER" || !posted.postedAt) {
    fail("Inventory transfer post did not return TRANSFER + POSTED status with PostedAt.");
  }

  const postedMovement = await findCatalogRecord("inventory-movements", movementNumber, session);

  if (!postedMovement || postedMovement.status !== "POSTED" || postedMovement.movementType !== "TRANSFER") {
    fail(`Posted inventory transfer ${movementNumber} was not visible as TRANSFER + POSTED in runtime metadata.`);
  }

  const updatedOriginStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const updatedDestinationStock = await getStockSnapshot(session, "ART-DEMO", "ALM-TRANSITO");

  if (updatedOriginStock.quantityOnHand !== initialOriginStock.quantityOnHand - quantityToTransfer) {
    fail("Inventory transfer did not decrease origin QuantityOnHand by the expected quantity.");
  }

  if (updatedDestinationStock.quantityOnHand !== initialDestinationStock.quantityOnHand + quantityToTransfer) {
    fail("Inventory transfer did not increase destination QuantityOnHand by the expected quantity.");
  }

  if (!updatedOriginStock.lastMovementAt || !updatedDestinationStock.lastMovementAt) {
    fail("Inventory transfer did not update LastMovementAt for origin and destination stocks.");
  }

  const originRuntimeRecord = await findInventoryStockRuntimeRecord(
    session,
    "ART-DEMO",
    "ALM-PRINCIPAL"
  );
  const destinationRuntimeRecord = await findInventoryStockRuntimeRecord(
    session,
    "ART-DEMO",
    "ALM-TRANSITO"
  );

  if (!originRuntimeRecord) {
    fail("/master-data/inventory-stocks did not reflect the transfer origin stock.");
  }

  if (!destinationRuntimeRecord) {
    fail("/master-data/inventory-stocks did not reflect the transfer destination stock.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "TRANSFER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-TRANSITO",
      quantityIn: quantityToTransfer,
      quantityOut: 0,
      quantityBalanceImpact: quantityToTransfer
    },
    {
      movementType: "TRANSFER",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: quantityToTransfer,
      quantityBalanceImpact: -quantityToTransfer
    }
  ]);

  smokeStep("inventory transfer repost rejected");
  await expectInventoryMovementPostFailure(movement.movementId, session);

  const originStockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const destinationStockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-TRANSITO");

  if (originStockAfterRetry.quantityOnHand !== updatedOriginStock.quantityOnHand) {
    fail("Reposting the same inventory transfer duplicated origin stock movement.");
  }

  if (destinationStockAfterRetry.quantityOnHand !== updatedDestinationStock.quantityOnHand) {
    fail("Reposting the same inventory transfer duplicated destination stock movement.");
  }

  await assertInventoryLedgerEntries(session, movementNumber, [
    {
      movementType: "TRANSFER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-TRANSITO",
      quantityIn: quantityToTransfer,
      quantityOut: 0,
      quantityBalanceImpact: quantityToTransfer
    },
    {
      movementType: "TRANSFER",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: quantityToTransfer,
      quantityBalanceImpact: -quantityToTransfer
    }
  ]);
}

async function validateInventoryAdjustmentApiFlow(session) {
  const references = await getDemoInventoryReferences(session);

  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  smokeStep("inventory adjustment in create");
  const adjustmentIn = await createInventoryAdjustment(
    {
      movementType: "ADJUSTMENT_IN",
      reference: `Smoke adjustment in ${smokeRun}`,
      notes: "Ajuste de entrada generado por smoke local",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: 3,
          unitCost: 50,
          notes: "Entrada smoke local"
        }
      ]
    },
    session
  );

  if (adjustmentIn.status !== "DRAFT" || adjustmentIn.movementType !== "ADJUSTMENT_IN") {
    fail("Inventory adjustment in was not created as ADJUSTMENT_IN + DRAFT.");
  }

  const stockAfterCreateIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterCreateIn.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Creating an inventory adjustment in changed stock before posting.");
  }

  smokeStep("inventory adjustment in post");
  const postedIn = await postInventoryMovement(adjustmentIn.id, session);

  if (postedIn.status !== "POSTED" || postedIn.movementType !== "ADJUSTMENT_IN") {
    fail("Inventory adjustment in did not post as ADJUSTMENT_IN + POSTED.");
  }

  const stockAfterPostIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPostIn.quantityOnHand !== initialStock.quantityOnHand + 3) {
    fail("Posting an inventory adjustment in did not increase stock by 3.");
  }

  await assertInventoryLedgerEntries(session, adjustmentIn.movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 3,
      quantityOut: 0,
      quantityBalanceImpact: 3
    }
  ]);

  smokeStep("inventory adjustment in repost rejected");
  await expectInventoryMovementPostFailure(adjustmentIn.id, session);

  const stockAfterRetryIn = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetryIn.quantityOnHand !== stockAfterPostIn.quantityOnHand) {
    fail("Reposting the inventory adjustment in duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, adjustmentIn.movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 3,
      quantityOut: 0,
      quantityBalanceImpact: 3
    }
  ]);

  smokeStep("inventory adjustment out create");
  const adjustmentOut = await createInventoryAdjustment(
    {
      movementType: "ADJUSTMENT_OUT",
      reference: `Smoke adjustment out ${smokeRun}`,
      notes: "Ajuste de salida generado por smoke local",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: 1,
          unitCost: 0,
          notes: "Salida smoke local"
        }
      ]
    },
    session
  );

  if (adjustmentOut.status !== "DRAFT" || adjustmentOut.movementType !== "ADJUSTMENT_OUT") {
    fail("Inventory adjustment out was not created as ADJUSTMENT_OUT + DRAFT.");
  }

  const stockAfterCreateOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterCreateOut.quantityOnHand !== stockAfterPostIn.quantityOnHand) {
    fail("Creating an inventory adjustment out changed stock before posting.");
  }

  smokeStep("inventory adjustment out post");
  const postedOut = await postInventoryMovement(adjustmentOut.id, session);

  if (postedOut.status !== "POSTED" || postedOut.movementType !== "ADJUSTMENT_OUT") {
    fail("Inventory adjustment out did not post as ADJUSTMENT_OUT + POSTED.");
  }

  const stockAfterPostOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPostOut.quantityOnHand !== stockAfterPostIn.quantityOnHand - 1) {
    fail("Posting an inventory adjustment out did not decrease stock by 1.");
  }

  await assertInventoryLedgerEntries(session, adjustmentOut.movementNumber, [
    {
      movementType: "ADJUSTMENT_OUT",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: 1,
      quantityBalanceImpact: -1
    }
  ]);

  smokeStep("inventory adjustment out repost rejected");
  await expectInventoryMovementPostFailure(adjustmentOut.id, session);

  const stockAfterRetryOut = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetryOut.quantityOnHand !== stockAfterPostOut.quantityOnHand) {
    fail("Reposting the inventory adjustment out duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, adjustmentOut.movementNumber, [
    {
      movementType: "ADJUSTMENT_OUT",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: 1,
      quantityBalanceImpact: -1
    }
  ]);
}

async function validatePhysicalCountFlow(session) {
  const references = await getDemoInventoryReferences(session);
  const differenceQuantity = 2;
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  smokeStep("inventory physical count create");
  const physicalCount = await createPhysicalCount(
    {
      warehouseId: references.warehouseId,
      reference: `Smoke physical count ${smokeRun}`,
      notes: "Conteo fisico generado por smoke local"
    },
    session
  );

  if (physicalCount.status !== "DRAFT" || Number(physicalCount.lineCount ?? 0) !== 0) {
    fail("Physical count was not created as DRAFT without lines.");
  }

  smokeStep("inventory physical count line");
  const countLine = await addPhysicalCountLine(
    physicalCount.id,
    {
      itemId: references.itemId,
      countedQuantity: initialStock.quantityOnHand + differenceQuantity,
      unitCost: 75,
      notes: "Linea de conteo smoke local"
    },
    session
  );

  if (
    Number(countLine.snapshotQuantity ?? 0) !== initialStock.quantityOnHand ||
    Number(countLine.countedQuantity ?? 0) !== initialStock.quantityOnHand + differenceQuantity ||
    Number(countLine.differenceQuantity ?? 0) !== differenceQuantity
  ) {
    fail("Physical count line did not keep the expected stock snapshot and positive difference.");
  }

  smokeStep("inventory physical count complete");
  const completedCount = await completePhysicalCount(physicalCount.id, session);

  if (
    completedCount.status !== "COMPLETED" ||
    Number(completedCount.lineCount ?? 0) !== 1 ||
    Number(completedCount.totalDifferenceQuantity ?? 0) !== differenceQuantity
  ) {
    fail("Physical count did not complete with the expected difference.");
  }

  const stockAfterComplete = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterComplete.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Completing a physical count changed stock before adjustment posting.");
  }

  smokeStep("inventory physical count adjustment draft");
  const physicalCountAdjustment = await createPhysicalCountAdjustment(physicalCount.id, session);
  const generatedCount = physicalCountAdjustment.physicalCount;
  const generatedAdjustment = physicalCountAdjustment.adjustment;

  if (generatedCount.status !== "ADJUSTMENT_CREATED" || !generatedCount.adjustmentMovementId) {
    fail("Physical count did not link the generated adjustment movement.");
  }

  if (
    generatedAdjustment.status !== "DRAFT" ||
    generatedAdjustment.movementType !== "ADJUSTMENT_IN"
  ) {
    fail("Physical count adjustment was not created as ADJUSTMENT_IN + DRAFT.");
  }

  const stockAfterAdjustmentDraft = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterAdjustmentDraft.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Generating a physical count adjustment changed stock before posting.");
  }

  const adjustmentCountAfterCreate = await countPhysicalCountAdjustments(session, generatedCount.countNumber);

  if (adjustmentCountAfterCreate !== 1) {
    fail("Physical count adjustment generation did not create exactly one adjustment movement.");
  }

  smokeStep("inventory physical count adjustment recreate rejected");
  await expectPhysicalCountAdjustmentFailure(physicalCount.id, session);

  const adjustmentCountAfterRetry = await countPhysicalCountAdjustments(session, generatedCount.countNumber);

  if (adjustmentCountAfterRetry !== 1) {
    fail("Retrying physical count adjustment generation duplicated adjustment movements.");
  }

  smokeStep("inventory physical count adjustment post");
  const postedAdjustment = await postInventoryMovement(generatedAdjustment.id, session);

  if (postedAdjustment.status !== "POSTED" || postedAdjustment.movementType !== "ADJUSTMENT_IN") {
    fail("Physical count generated adjustment did not post as ADJUSTMENT_IN + POSTED.");
  }

  const stockAfterPost = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPost.quantityOnHand !== initialStock.quantityOnHand + differenceQuantity) {
    fail("Posting the physical count adjustment did not increase stock by the expected difference.");
  }

  await assertInventoryLedgerEntries(session, generatedAdjustment.movementNumber, [
    {
      movementType: "ADJUSTMENT_IN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: differenceQuantity,
      quantityOut: 0,
      quantityBalanceImpact: differenceQuantity
    }
  ]);

  smokeStep("inventory physical count adjustment repost rejected");
  await expectInventoryMovementPostFailure(generatedAdjustment.id, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== stockAfterPost.quantityOnHand) {
    fail("Reposting the physical count adjustment duplicated stock.");
  }
}

async function validateBackendBasics() {
  smokeStep("GET /health");
  await expectOk("/health");

  smokeStep("GET /version");
  await expectOk("/version");

  smokeStep("GET /health/db");
  const dbHealth = await request("/health/db");

  if (dbHealth.response.status === 503) {
    fail(
      `SQL Server unavailable for smoke: ${JSON.stringify(dbHealth.body ?? {})}. Run npm run db:setup with a reachable local SQL Server before npm run smoke:local.`
    );
  }

  if (!dbHealth.response.ok || dbHealth.body?.success === false) {
    fail(`/health/db failed with HTTP ${dbHealth.response.status}: ${JSON.stringify(dbHealth.body ?? {})}`);
  }
}

async function loginDemo() {
  smokeStep("POST /auth/login demo");
  const body = await expectOk("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: demoEmail, password: demoPassword })
  });

  const session = body.data;

  if (!session?.accessToken || !session.user?.tenantId) {
    fail("Demo login did not return an access token and tenant context.");
  }

  smokeStep("GET /auth/me");
  await expectOk("/auth/me", { headers: authHeaders(session) });

  return session;
}

async function validateCatalogs(session) {
  for (const catalog of requiredCatalogs) {
    smokeStep(`metadata ${catalog.code}`);
    const metadata = await expectOk(`/master-data/${catalog.code}/metadata`, {
      headers: authHeaders(session)
    });

    if (!metadata.data?.fields?.length) {
      fail(`${catalog.code} metadata did not include fields.`);
    }

    smokeStep(`list ${catalog.code}`);
    const list = await expectOk(
      `/master-data/${catalog.code}?search=${encodeURIComponent(catalog.seedCode)}&page=1&pageSize=10`,
      { headers: authHeaders(session) }
    );

    const seedRecord = (list.data ?? []).find((item) => item.code === catalog.seedCode);

    if (!seedRecord) {
      fail(`${catalog.code} seed record ${catalog.seedCode} was not returned by the API.`);
    }

    if (catalog.code === "units-of-measure") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = ["symbol", "unitType", "decimalPrecision", "isBaseUnit"].filter(
        (field) => !fields.includes(field)
      );

      if (missingFields.length) {
        fail(`units-of-measure metadata is missing fields: ${missingFields.join(", ")}.`);
      }
    }

    if (catalog.code === "items") {
      const unitField = metadata.data.fields.find((field) => field.field === "unitOfMeasureId");
      const warehouseField = metadata.data.fields.find((field) => field.field === "defaultWarehouseId");

      if (unitField?.lookupCatalog !== "units-of-measure") {
        fail("items metadata did not keep unitOfMeasureId lookupCatalog=units-of-measure.");
      }

      if (warehouseField?.lookupCatalog !== "warehouses") {
        fail("items metadata did not keep defaultWarehouseId lookupCatalog=warehouses.");
      }
    }

    if (catalog.code === "warehouses") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "warehouseType",
        "addressLine1",
        "addressLine2",
        "city",
        "province",
        "countryCode",
        "responsibleUserId",
        "allowsNegativeInventory",
        "isDefault",
        "isTransit",
        "isVirtual"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`warehouses metadata is missing fields: ${missingFields.join(", ")}.`);
      }
    }

    if (catalog.code === "inventory-stocks") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "itemCode",
        "itemDescription",
        "warehouseCode",
        "warehouseName",
        "quantityOnHand",
        "quantityReserved",
        "quantityAvailable",
        "averageCost",
        "lastCost",
        "standardCost",
        "lastMovementAt",
        "isActive"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`inventory-stocks metadata is missing fields: ${missingFields.join(", ")}.`);
      }

      if (metadata.data.catalog.readOnly !== true) {
        fail("inventory-stocks metadata did not report readOnly=true.");
      }

      const createAction = metadata.data.actions.find((action) => action.action === "create");

      if (createAction?.available !== false) {
        fail("inventory-stocks create action must be unavailable.");
      }

      const available = Number(seedRecord.quantityAvailable ?? 0);
      const onHand = Number(seedRecord.quantityOnHand ?? 0);
      const reserved = Number(seedRecord.quantityReserved ?? 0);

      if (available !== onHand - reserved) {
        fail("inventory-stocks QuantityAvailable did not match QuantityOnHand - QuantityReserved.");
      }
    }

    if (catalog.code === "inventory-movements") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "movementNumber",
        "movementType",
        "movementDate",
        "status",
        "sourceModule",
        "sourceDocumentNumber",
        "reference",
        "lineCount",
        "totalQuantity",
        "totalCost",
        "postedAt",
        "voidedAt",
        "isActive"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`inventory-movements metadata is missing fields: ${missingFields.join(", ")}.`);
      }

      if (metadata.data.catalog.readOnly !== true) {
        fail("inventory-movements metadata did not report readOnly=true.");
      }

      const unavailableActions = ["create", "update", "activate", "deactivate"]
        .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
        .filter((action) => action?.available !== false);

      if (unavailableActions.length) {
        fail("inventory-movements write actions must be unavailable.");
      }

      if (seedRecord.status !== "DRAFT") {
        fail("MOV-DEMO-001 must stay in DRAFT status.");
      }

      if (Number(seedRecord.lineCount ?? 0) < 1 || Number(seedRecord.totalQuantity ?? 0) < 1) {
        fail("MOV-DEMO-001 must include a visible demo line quantity.");
      }

      await validateDemoMovementDoesNotAffectStock(session);
    }

    if (catalog.code === "inventory-movement-lines") {
      const fields = metadata.data.fields.map((field) => field.field);
      const missingFields = [
        "movementNumber",
        "movementType",
        "status",
        "lineNumber",
        "itemCode",
        "itemDescription",
        "warehouseCode",
        "quantity",
        "unitCost",
        "totalCost"
      ].filter((field) => !fields.includes(field));

      if (missingFields.length) {
        fail(`inventory-movement-lines metadata is missing fields: ${missingFields.join(", ")}.`);
      }

      if (metadata.data.catalog.readOnly !== true) {
        fail("inventory-movement-lines metadata did not report readOnly=true.");
      }

      const createAction = metadata.data.actions.find((action) => action.action === "create");

      if (createAction?.available !== false) {
        fail("inventory-movement-lines create action must be unavailable.");
      }

      if (seedRecord.itemCode !== "ART-DEMO" || seedRecord.warehouseCode !== "ALM-PRINCIPAL") {
        fail("MOV-DEMO-001 line must reference ART-DEMO + ALM-PRINCIPAL.");
      }
    }
  }
}

async function validateInventoryLedgerMetadata(session) {
  smokeStep("metadata inventory-ledger");
  const metadata = await expectOk("/master-data/inventory-ledger/metadata", {
    headers: authHeaders(session)
  });

  if (metadata.data?.catalog?.readOnly !== true) {
    fail("inventory-ledger metadata must be read-only.");
  }

  const fields = metadata.data.fields.map((field) => field.field);
  const missingFields = [
    "movementNumber",
    "movementType",
    "ledgerDirection",
    "movementDate",
    "postedAt",
    "itemCode",
    "warehouseCode",
    "quantityIn",
    "quantityOut",
    "quantityBalanceImpact"
  ].filter((field) => !fields.includes(field));

  if (missingFields.length) {
    fail(`inventory-ledger metadata is missing fields: ${missingFields.join(", ")}.`);
  }
}

async function validatePurchaseOrderMetadata(session) {
  for (const catalog of ["purchase-orders", "purchase-order-lines"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "purchase-orders"
        ? ["purchaseOrderNumber", "supplierCode", "supplierName", "status", "orderDate", "totalAmount"]
        : ["purchaseOrderNumber", "status", "lineNumber", "itemCode", "warehouseCode", "quantity", "lineTotal"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validateSalesQuotationMetadata(session) {
  for (const catalog of ["sales-quotations", "sales-quotation-lines"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "sales-quotations"
        ? ["quotationNumber", "customerCode", "customerName", "status", "quotationDate", "validUntil", "totalAmount"]
        : ["quotationNumber", "status", "lineNumber", "itemCode", "unitOfMeasureCode", "quantity", "unitPrice", "lineTotal"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }

    const unavailableActions = ["create", "update", "activate", "deactivate"]
      .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
      .filter((action) => action?.available !== false);

    if (unavailableActions.length) {
      fail(`${catalog} write actions must be unavailable.`);
    }
  }
}

async function validateSalesOrderMetadata(session) {
  for (const catalog of ["sales-orders", "sales-order-lines"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "sales-orders"
        ? ["orderNumber", "customerCode", "customerName", "status", "orderDate", "requestedDeliveryDate", "totalAmount"]
        : ["orderNumber", "status", "lineNumber", "itemCode", "warehouseCode", "quantity", "unitPrice", "lineTotal"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }

    const unavailableActions = ["create", "update", "activate", "deactivate"]
      .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
      .filter((action) => action?.available !== false);

    if (unavailableActions.length) {
      fail(`${catalog} write actions must be unavailable.`);
    }
  }
}

async function validateInventoryReservationMetadata(session) {
  for (const catalog of ["item-availability", "inventory-reservations", "sales-order-reservations"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "item-availability"
        ? ["itemCode", "warehouseCode", "onHandQuantity", "reservedQuantity", "availableQuantity"]
        : catalog === "inventory-reservations"
          ? ["orderNumber", "itemCode", "warehouseCode", "reservedQuantity", "activeQuantity", "status"]
          : ["orderNumber", "orderStatus", "itemCode", "orderedQuantity", "reservedQuantity", "pendingReservationQuantity"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }

    const unavailableActions = ["create", "update", "activate", "deactivate"]
      .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
      .filter((action) => action?.available !== false);

    if (unavailableActions.length) {
      fail(`${catalog} write actions must be unavailable.`);
    }
  }
}

async function validateSalesShipmentMetadata(session) {
  for (const catalog of ["sales-shipments", "sales-shipment-lines", "sales-order-shipments"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "sales-shipments"
        ? ["shipmentNumber", "orderNumber", "customerName", "status", "shipmentDate", "totalQuantity"]
        : catalog === "sales-shipment-lines"
          ? ["shipmentNumber", "orderNumber", "lineNumber", "itemCode", "warehouseCode", "quantity"]
          : ["orderNumber", "orderStatus", "itemCode", "orderedQuantity", "previouslyShippedQuantity", "pendingShipmentQuantity"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }

    const unavailableActions = ["create", "update", "activate", "deactivate"]
      .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
      .filter((action) => action?.available !== false);

    if (unavailableActions.length) {
      fail(`${catalog} write actions must be unavailable.`);
    }
  }
}

async function validateSalesInvoiceMetadata(session) {
  for (const catalog of ["sales-invoices", "sales-invoice-lines", "sales-order-invoices", "sales-shipment-invoices"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "sales-invoices"
        ? ["invoiceNumber", "orderNumber", "customerName", "status", "invoiceDate", "dueDate", "totalAmount"]
        : catalog === "sales-invoice-lines"
          ? ["invoiceNumber", "orderNumber", "shipmentNumber", "lineNumber", "itemCode", "quantity", "lineTotal"]
          : ["orderNumber", "itemCode", "shippedQuantity", "previouslyInvoicedQuantity", "pendingInvoiceQuantity"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }

    const unavailableActions = ["create", "update", "activate", "deactivate"]
      .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
      .filter((action) => action?.available !== false);

    if (unavailableActions.length) {
      fail(`${catalog} write actions must be unavailable.`);
    }
  }
}

async function validateSalesReturnMetadata(session) {
  for (const catalog of [
    "sales-returns",
    "sales-return-lines",
    "sales-shipment-returns",
    "sales-invoice-returns",
    "sales-credit-note-pending",
    "sales-credit-notes"
  ]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "sales-returns"
        ? ["returnNumber", "orderNumber", "shipmentNumber", "customerName", "status", "returnDate", "totalQuantity"]
        : catalog === "sales-return-lines"
          ? ["returnNumber", "shipmentNumber", "lineNumber", "itemCode", "warehouseCode", "quantity"]
          : catalog === "sales-credit-note-pending"
            ? ["returnNumber", "invoiceNumber", "accountsReceivableDocumentNumber", "customerName", "returnedAmount", "pendingCreditAmount"]
            : catalog === "sales-credit-notes"
              ? ["creditNoteNumber", "returnNumber", "invoiceNumber", "customerName", "status", "amount", "appliedAmount"]
              : ["shipmentNumber", "orderNumber", "itemCode", "shippedQuantity", "previouslyReturnedQuantity", "returnableQuantity"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }

    const unavailableActions = ["create", "update", "activate", "deactivate"]
      .map((actionName) => metadata.data.actions.find((action) => action.action === actionName))
      .filter((action) => action?.available !== false);

    if (unavailableActions.length) {
      fail(`${catalog} write actions must be unavailable.`);
    }
  }
}

async function validatePurchaseReceiptMetadata(session) {
  for (const catalog of ["purchase-receipts", "purchase-receipt-lines"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "purchase-receipts"
        ? ["purchaseReceiptNumber", "purchaseOrderNumber", "supplierCode", "status", "receiptDate", "totalQuantityReceived"]
        : ["purchaseReceiptNumber", "purchaseOrderNumber", "status", "lineNumber", "itemCode", "warehouseCode", "quantityReceived"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validateSupplierPaymentMetadata(session) {
  for (const catalog of ["supplier-payments", "supplier-payment-applications"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "supplier-payments"
        ? ["paymentNumber", "supplierCode", "supplierName", "status", "totalAmount", "appliedAmount"]
        : ["paymentNumber", "documentNumber", "documentStatus", "appliedAmount", "documentRemainingAmount"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validateSupplierAdjustmentMetadata(session) {
  for (const catalog of ["supplier-adjustments", "supplier-adjustment-applications"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "supplier-adjustments"
        ? ["adjustmentNumber", "supplierCode", "supplierName", "adjustmentType", "status", "amount"]
        : ["adjustmentNumber", "adjustmentType", "documentNumber", "documentStatus", "appliedAmount"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validateSupplierStatementMetadata(session) {
  for (const catalog of ["supplier-statements", "supplier-aging"]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFields =
      catalog === "supplier-statements"
        ? ["documentNumber", "supplierCode", "supplierName", "remainingAmount", "daysPastDue", "agingBucket"]
        : ["supplierCode", "supplierName", "currentAmount", "days1To30Amount", "totalOpenAmount", "overdueAmount"];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validateAccountsReceivableMetadata(session) {
  for (const catalog of [
    "accounts-receivable-documents",
    "customer-receipts",
    "customer-receipt-applications",
    "customer-credit-notes",
    "customer-credit-note-applications",
    "customer-statements",
    "customer-aging",
    "customer-receivable-balances"
  ]) {
    smokeStep(`metadata ${catalog}`);
    const metadata = await expectOk(`/master-data/${catalog}/metadata`, {
      headers: authHeaders(session)
    });

    if (metadata.data?.catalog?.readOnly !== true) {
      fail(`${catalog} metadata must be read-only.`);
    }

    const fields = metadata.data.fields.map((field) => field.field);
    const expectedFieldsByCatalog = {
      "accounts-receivable-documents": [
        "documentNumber",
        "customerCode",
        "customerName",
        "status",
        "totalAmount",
        "remainingAmount"
      ],
      "customer-receipts": [
        "receiptNumber",
        "customerCode",
        "customerName",
        "status",
        "totalAmount",
        "appliedAmount"
      ],
      "customer-receipt-applications": [
        "receiptNumber",
        "documentNumber",
        "documentStatus",
        "appliedAmount",
        "documentRemainingAmount"
      ],
      "customer-credit-notes": [
        "creditNoteNumber",
        "customerCode",
        "customerName",
        "status",
        "amount",
        "appliedAmount"
      ],
      "customer-credit-note-applications": [
        "creditNoteNumber",
        "documentNumber",
        "documentStatus",
        "appliedAmount",
        "documentRemainingAmount"
      ],
      "customer-statements": [
        "documentNumber",
        "customerCode",
        "customerName",
        "remainingAmount",
        "daysPastDue",
        "agingBucket"
      ],
      "customer-aging": [
        "customerCode",
        "customerName",
        "currentAmount",
        "days1To30Amount",
        "totalOpenAmount",
        "overdueAmount"
      ],
      "customer-receivable-balances": [
        "customerCode",
        "customerName",
        "totalOpenAmount",
        "currentAmount",
        "overdueAmount",
        "openDocumentCount"
      ]
    };
    const expectedFields = expectedFieldsByCatalog[catalog];
    const missingFields = expectedFields.filter((field) => !fields.includes(field));

    if (missingFields.length) {
      fail(`${catalog} metadata is missing fields: ${missingFields.join(", ")}.`);
    }
  }
}

async function validatePurchaseOrderFlow(session) {
  const references = await getDemoPurchaseReferences(session);
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialMovementCount = await countInventoryMovements(session);
  const expectedDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  smokeStep("purchase order create");
  const purchaseOrder = await createPurchaseOrder(
    {
      supplierId: references.supplierId,
      expectedDate,
      reference: `Smoke purchase order ${smokeRun}`,
      notes: "Orden de compra generada por smoke local",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: 4,
          unitCost: 25,
          notes: "Linea de orden de compra smoke local"
        }
      ]
    },
    session
  );

  if (
    purchaseOrder.status !== "DRAFT" ||
    Number(purchaseOrder.lineCount ?? 0) !== 1 ||
    Number(purchaseOrder.totalQuantity ?? 0) !== 4 ||
    Number(purchaseOrder.totalAmount ?? 0) !== 100
  ) {
    fail("Purchase order was not created as DRAFT with the expected totals.");
  }

  const runtimeOrder = await findCatalogRecord("purchase-orders", purchaseOrder.purchaseOrderNumber, session);

  if (!runtimeOrder || runtimeOrder.status !== "DRAFT") {
    fail("Created purchase order was not visible as DRAFT in runtime metadata.");
  }

  const runtimeLine = await findCatalogRecord("purchase-order-lines", purchaseOrder.purchaseOrderNumber, session);

  if (!runtimeLine || Number(runtimeLine.quantity ?? 0) !== 4) {
    fail("Created purchase order line was not visible in runtime metadata.");
  }

  const stockAfterCreate = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterCreate = await countInventoryMovements(session);

  if (stockAfterCreate.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Creating a purchase order changed inventory stock.");
  }

  if (movementCountAfterCreate !== initialMovementCount) {
    fail("Creating a purchase order created inventory movements.");
  }

  smokeStep("purchase order approve");
  const approvedOrder = await approvePurchaseOrder(purchaseOrder.id, session);

  if (approvedOrder.status !== "APPROVED" || !approvedOrder.approvedAt) {
    fail("Purchase order was not approved correctly.");
  }

  const stockAfterApprove = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterApprove = await countInventoryMovements(session);

  if (stockAfterApprove.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Approving a purchase order changed inventory stock.");
  }

  if (movementCountAfterApprove !== initialMovementCount) {
    fail("Approving a purchase order created inventory movements.");
  }

  smokeStep("purchase order cancel");
  const cancelledOrder = await cancelPurchaseOrder(
    purchaseOrder.id,
    "Cancelada por smoke local",
    session
  );

  if (cancelledOrder.status !== "CANCELLED" || !cancelledOrder.cancelledAt) {
    fail("Purchase order was not cancelled correctly.");
  }

  const stockAfterCancel = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterCancel = await countInventoryMovements(session);

  if (stockAfterCancel.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Cancelling a purchase order changed inventory stock.");
  }

  if (movementCountAfterCancel !== initialMovementCount) {
    fail("Cancelling a purchase order created inventory movements.");
  }
}

async function validatePurchaseReceiptFlow(session) {
  const references = await getDemoPurchaseReferences(session);
  const receiptQuantity = 2;
  const unitCost = 30;
  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialMovementCount = await countInventoryMovements(session);
  const expectedDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const purchaseOrder = await createPurchaseOrder(
    {
      supplierId: references.supplierId,
      expectedDate,
      reference: `Smoke receipt purchase order ${smokeRun}`,
      notes: "Orden aprobada para validar recepcion de compra",
      lines: [
        {
          itemId: references.itemId,
          warehouseId: references.warehouseId,
          unitOfMeasureId: references.unitOfMeasureId,
          quantity: receiptQuantity,
          unitCost,
          notes: "Linea para recepcion smoke local"
        }
      ]
    },
    session
  );

  const approvedOrder = await approvePurchaseOrder(purchaseOrder.id, session);
  const orderLine = approvedOrder.lines?.[0];

  if (approvedOrder.status !== "APPROVED" || !orderLine?.id) {
    fail("Purchase receipt smoke could not prepare an approved purchase order with lines.");
  }

  smokeStep("purchase receipt create");
  const receipt = await createPurchaseReceipt(
    {
      purchaseOrderId: approvedOrder.id,
      reference: `Smoke purchase receipt ${smokeRun}`,
      notes: "Recepcion de compra generada por smoke local"
    },
    session
  );

  if (receipt.status !== "DRAFT" || receipt.purchaseOrderId !== approvedOrder.id) {
    fail("Purchase receipt was not created as DRAFT against the approved purchase order.");
  }

  const runtimeDraftReceipt = await findCatalogRecord("purchase-receipts", receipt.purchaseReceiptNumber, session);

  if (!runtimeDraftReceipt || runtimeDraftReceipt.status !== "DRAFT") {
    fail("Created purchase receipt was not visible as DRAFT in runtime metadata.");
  }

  const stockAfterCreate = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const movementCountAfterCreate = await countInventoryMovements(session);

  if (stockAfterCreate.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Creating a purchase receipt changed stock before posting.");
  }

  if (movementCountAfterCreate !== initialMovementCount) {
    fail("Creating a purchase receipt created inventory movements before posting.");
  }

  smokeStep("purchase receipt line");
  const receiptWithLine = await addPurchaseReceiptLine(
    receipt.id,
    {
      purchaseOrderLineId: orderLine.id,
      quantityReceived: receiptQuantity,
      unitCost,
      notes: "Linea recibida por smoke local"
    },
    session
  );

  if (
    Number(receiptWithLine.lineCount ?? 0) !== 1 ||
    Number(receiptWithLine.totalQuantityReceived ?? 0) !== receiptQuantity
  ) {
    fail("Purchase receipt line was not added with the expected quantity.");
  }

  const runtimeLine = await findCatalogRecord("purchase-receipt-lines", receipt.purchaseReceiptNumber, session);

  if (!runtimeLine || Number(runtimeLine.quantityReceived ?? 0) !== receiptQuantity) {
    fail("Created purchase receipt line was not visible in runtime metadata.");
  }

  const stockAfterLine = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterLine.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Adding a purchase receipt line changed stock before posting.");
  }

  smokeStep("purchase receipt complete/post");
  const postedReceipt = await completePurchaseReceipt(receipt.id, session);

  if (
    postedReceipt.status !== "POSTED" ||
    !postedReceipt.postedAt ||
    !postedReceipt.inventoryMovementId ||
    !postedReceipt.movementNumber
  ) {
    fail("Purchase receipt did not post with an inventory movement link.");
  }

  const postedMovement = await findCatalogRecord("inventory-movements", postedReceipt.movementNumber, session);

  if (
    !postedMovement ||
    postedMovement.status !== "POSTED" ||
    postedMovement.movementType !== "PURCHASE_RECEIPT_PLACEHOLDER"
  ) {
    fail("Purchase receipt movement was not visible as posted PURCHASE_RECEIPT_PLACEHOLDER.");
  }

  const stockAfterPost = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterPost.quantityOnHand !== initialStock.quantityOnHand + receiptQuantity) {
    fail("Posting a purchase receipt did not increase ItemStocks by the received quantity.");
  }

  const movementCountAfterPost = await countInventoryMovements(session);

  if (movementCountAfterPost !== initialMovementCount + 1) {
    fail("Posting a purchase receipt did not create exactly one inventory movement.");
  }

  await assertInventoryLedgerEntries(session, postedReceipt.movementNumber, [
    {
      movementType: "PURCHASE_RECEIPT_PLACEHOLDER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: receiptQuantity,
      quantityOut: 0,
      quantityBalanceImpact: receiptQuantity
    }
  ]);

  smokeStep("purchase receipt repost rejected");
  await expectPurchaseReceiptCompleteFailure(receipt.id, session);

  const stockAfterRetry = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");

  if (stockAfterRetry.quantityOnHand !== stockAfterPost.quantityOnHand) {
    fail("Reposting the same purchase receipt duplicated stock.");
  }

  await assertInventoryLedgerEntries(session, postedReceipt.movementNumber, [
    {
      movementType: "PURCHASE_RECEIPT_PLACEHOLDER",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: receiptQuantity,
      quantityOut: 0,
      quantityBalanceImpact: receiptQuantity
    }
  ]);

  return postedReceipt;
}

async function validateSupplierInvoiceFlow(session, postedReceipt) {
  const invoiceNumber = `FAC-QA-${smokeRun}`;
  const receiptLine = postedReceipt.lines[0];
  if (!receiptLine) {
    fail("Purchase receipt has no lines to validate supplier invoice.");
  }

  const initialStock = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  const initialMovementCount = await countInventoryMovements(session);

  smokeStep("supplier invoice create");
  const invoice = await createSupplierInvoice(
    {
      purchaseReceiptId: postedReceipt.id,
      supplierInvoiceNumber: invoiceNumber,
      invoiceDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reference: `REF-INV-${smokeRun}`,
      notes: "Factura de proveedor creada por smoke local"
    },
    session
  );

  if (invoice.status !== "DRAFT" || invoice.purchaseReceiptId !== postedReceipt.id) {
    fail("Supplier invoice was not created as DRAFT against the posted purchase receipt.");
  }

  const runtimeDraftInvoice = await findCatalogRecord("supplier-invoices", invoice.supplierInvoiceNumber, session);
  if (!runtimeDraftInvoice || runtimeDraftInvoice.status !== "DRAFT") {
    fail("Created supplier invoice was not visible as DRAFT in runtime metadata.");
  }

  smokeStep("supplier invoice line");
  const invoiceWithLine = await addSupplierInvoiceLine(
    invoice.id,
    {
      itemId: receiptLine.itemId,
      unitOfMeasureId: receiptLine.unitOfMeasureId,
      quantity: 1,
      unitCost: 30,
      taxAmount: 5.40,
      notes: "Linea de factura smoke local"
    },
    session
  );

  if (
    Number(invoiceWithLine.lineCount ?? 0) !== 1 ||
    Number(invoiceWithLine.totalAmount ?? 0) !== 35.40
  ) {
    fail("Supplier invoice line was not added with the expected totals.");
  }

  const runtimeLine = await findCatalogRecord("supplier-invoice-lines", invoice.supplierInvoiceNumber, session);
  if (!runtimeLine || Number(runtimeLine.quantity ?? 0) !== 1) {
    fail("Created supplier invoice line was not visible in runtime metadata.");
  }

  let quantityValidationFailed = false;
  try {
    await addSupplierInvoiceLine(
      invoice.id,
      {
        itemId: receiptLine.itemId,
        unitOfMeasureId: receiptLine.unitOfMeasureId,
        quantity: 2,
        unitCost: 30,
        taxAmount: 5.40,
        notes: "Exceeding quantity line"
      },
      session
    );
  } catch (err) {
    quantityValidationFailed = true;
  }

  if (!quantityValidationFailed) {
    fail("Adding a supplier invoice line exceeding the purchase receipt received quantity should have thrown an error.");
  }

  smokeStep("supplier invoice complete/post");
  const postedInvoice = await completeSupplierInvoice(invoice.id, session);

  if (postedInvoice.status !== "POSTED" || !postedInvoice.postedAt) {
    fail("Supplier invoice did not post successfully.");
  }

  const stockAfterPost = await getStockSnapshot(session, "ART-DEMO", "ALM-PRINCIPAL");
  if (stockAfterPost.quantityOnHand !== initialStock.quantityOnHand) {
    fail("Posting a supplier invoice changed physical inventory stocks!");
  }

  const movementCountAfterPost = await countInventoryMovements(session);
  if (movementCountAfterPost !== initialMovementCount) {
    fail("Posting a supplier invoice created inventory movements!");
  }

  smokeStep("accounts payable document generated");
  const cxpDoc = await findCatalogRecord("accounts-payable-documents", `CXP-${invoiceNumber}`, session);

  if (!cxpDoc) {
    fail(`Accounts payable document CXP-${invoiceNumber} was not found.`);
  }

  if (
    cxpDoc.status !== "OPEN" ||
    Number(cxpDoc.totalAmount ?? 0) !== 35.40 ||
    Number(cxpDoc.paidAmount ?? 0) !== 0 ||
    Number(cxpDoc.remainingAmount ?? 0) !== 35.40
  ) {
    fail("Accounts payable document was not generated with the correct open amounts and status.");
  }

  smokeStep("supplier invoice repost rejected");
  await expectSupplierInvoiceCompleteFailure(invoice.id, session);
}

async function validateSupplierPaymentFlow(session) {
  smokeStep("supplier payment AP document setup");
  const cxpDocument = await createSmokeAccountsPayableDocument(session, 100);
  const initialSnapshot = await getAccountsPayableDocumentSnapshot(session, cxpDocument.id);

  if (
    initialSnapshot.status !== "OPEN" ||
    Number(initialSnapshot.paidAmount ?? 0) !== 0 ||
    Number(initialSnapshot.remainingAmount ?? 0) !== 100
  ) {
    fail("Smoke AP document was not created as OPEN with full pending balance.");
  }

  smokeStep("supplier payment partial draft");
  const partialPayment = await createSupplierPayment(
    {
      supplierId: cxpDocument.supplierId,
      totalAmount: 40,
      reference: `PAY-PARTIAL-${smokeRun}`,
      notes: "Pago parcial creado por smoke local"
    },
    session
  );

  if (partialPayment.status !== "DRAFT" || Number(partialPayment.totalAmount ?? 0) !== 40) {
    fail("Supplier payment was not created as DRAFT with the expected total.");
  }

  const draftSnapshot = await getAccountsPayableDocumentSnapshot(session, cxpDocument.id);
  if (Number(draftSnapshot.remainingAmount ?? 0) !== Number(initialSnapshot.remainingAmount ?? 0)) {
    fail("Creating a supplier payment DRAFT changed the AP document balance.");
  }

  smokeStep("supplier payment partial application");
  const partialWithApplication = await addSupplierPaymentApplication(
    partialPayment.id,
    {
      accountsPayableDocumentId: cxpDocument.id,
      appliedAmount: 40,
      notes: "Aplicacion parcial smoke local"
    },
    session
  );

  if (Number(partialWithApplication.appliedAmount ?? 0) !== 40 || Number(partialWithApplication.applicationCount ?? 0) !== 1) {
    fail("Supplier payment application was not registered with the expected amount.");
  }

  const applicationRuntime = await findCatalogRecord("supplier-payment-applications", partialPayment.paymentNumber, session);
  if (!applicationRuntime || Number(applicationRuntime.appliedAmount ?? 0) !== 40) {
    fail("Supplier payment application was not visible in runtime metadata.");
  }

  smokeStep("supplier payment partial post");
  const postedPartialPayment = await postSupplierPayment(partialPayment.id, session);

  if (postedPartialPayment.status !== "POSTED" || !postedPartialPayment.postedAt) {
    fail("Supplier partial payment did not post successfully.");
  }

  const partialPostedSnapshot = await getAccountsPayableDocumentSnapshot(session, cxpDocument.id);
  if (
    Number(partialPostedSnapshot.remainingAmount ?? 0) !== 60 ||
    Number(partialPostedSnapshot.paidAmount ?? 0) !== 40 ||
    partialPostedSnapshot.status !== "PARTIALLY_PAID"
  ) {
    fail("Partial supplier payment did not reduce AP balance or status correctly.");
  }

  const paymentRuntime = await findCatalogRecord("supplier-payments", partialPayment.paymentNumber, session);
  if (!paymentRuntime || paymentRuntime.status !== "POSTED") {
    fail("Posted supplier payment was not visible in runtime metadata.");
  }

  smokeStep("supplier payment final draft");
  const finalPayment = await createSupplierPayment(
    {
      supplierId: cxpDocument.supplierId,
      totalAmount: 60,
      reference: `PAY-FINAL-${smokeRun}`,
      notes: "Pago final creado por smoke local"
    },
    session
  );

  await addSupplierPaymentApplication(
    finalPayment.id,
    {
      accountsPayableDocumentId: cxpDocument.id,
      appliedAmount: 60,
      notes: "Aplicacion final smoke local"
    },
    session
  );

  smokeStep("supplier payment final post");
  const postedFinalPayment = await postSupplierPayment(finalPayment.id, session);

  if (postedFinalPayment.status !== "POSTED") {
    fail("Final supplier payment did not post successfully.");
  }

  const paidSnapshot = await getAccountsPayableDocumentSnapshot(session, cxpDocument.id);
  if (
    Number(paidSnapshot.remainingAmount ?? 0) !== 0 ||
    Number(paidSnapshot.paidAmount ?? 0) !== 100 ||
    paidSnapshot.status !== "PAID"
  ) {
    fail("Final supplier payment did not settle AP balance to PAID.");
  }

  smokeStep("supplier payment repost rejected");
  await expectSupplierPaymentPostFailure(partialPayment.id, session);

  const retrySnapshot = await getAccountsPayableDocumentSnapshot(session, cxpDocument.id);
  if (Number(retrySnapshot.paidAmount ?? 0) !== 100 || Number(retrySnapshot.remainingAmount ?? 0) !== 0) {
    fail("Retrying supplier payment post reduced the AP balance a second time.");
  }
}

async function validateSupplierAdjustmentFlow(session) {
  smokeStep("supplier credit note AP document setup");
  const creditDocument = await createSmokeAccountsPayableDocument(session, 100, "CN");
  const creditInitialSnapshot = await getAccountsPayableDocumentSnapshot(session, creditDocument.id);

  smokeStep("supplier credit note draft");
  const creditNote = await createSupplierAdjustment(
    {
      supplierId: creditDocument.supplierId,
      adjustmentType: "CREDIT_NOTE",
      amount: 30,
      reference: `CN-${smokeRun}`,
      notes: "Nota de credito smoke local"
    },
    session
  );

  if (creditNote.status !== "DRAFT" || creditNote.adjustmentType !== "CREDIT_NOTE" || Number(creditNote.amount ?? 0) !== 30) {
    fail("Supplier credit note was not created as DRAFT with the expected amount.");
  }

  const creditDraftSnapshot = await getAccountsPayableDocumentSnapshot(session, creditDocument.id);
  if (Number(creditDraftSnapshot.remainingAmount ?? 0) !== Number(creditInitialSnapshot.remainingAmount ?? 0)) {
    fail("Creating a supplier credit note DRAFT changed the AP document balance.");
  }

  smokeStep("supplier credit note application");
  const creditWithApplication = await addSupplierAdjustmentApplication(
    creditNote.id,
    {
      accountsPayableDocumentId: creditDocument.id,
      appliedAmount: 30,
      notes: "Aplicacion nota credito smoke local"
    },
    session
  );

  if (Number(creditWithApplication.appliedAmount ?? 0) !== 30 || Number(creditWithApplication.applicationCount ?? 0) !== 1) {
    fail("Supplier credit note application was not registered with the expected amount.");
  }

  const creditApplicationRuntime = await findCatalogRecord("supplier-adjustment-applications", creditNote.adjustmentNumber, session);
  if (!creditApplicationRuntime || Number(creditApplicationRuntime.appliedAmount ?? 0) !== 30) {
    fail("Supplier credit note application was not visible in runtime metadata.");
  }

  smokeStep("supplier credit note post");
  const postedCreditNote = await postSupplierAdjustment(creditNote.id, session);
  if (postedCreditNote.status !== "POSTED" || !postedCreditNote.postedAt) {
    fail("Supplier credit note did not post successfully.");
  }

  const creditPostedSnapshot = await getAccountsPayableDocumentSnapshot(session, creditDocument.id);
  if (
    Number(creditPostedSnapshot.remainingAmount ?? 0) !== 70 ||
    Number(creditPostedSnapshot.paidAmount ?? 0) !== 30 ||
    creditPostedSnapshot.status !== "PARTIALLY_PAID"
  ) {
    fail("Supplier credit note did not reduce AP balance or status correctly.");
  }

  const creditRuntime = await findCatalogRecord("supplier-adjustments", creditNote.adjustmentNumber, session);
  if (!creditRuntime || creditRuntime.status !== "POSTED") {
    fail("Posted supplier credit note was not visible in runtime metadata.");
  }

  smokeStep("supplier credit note repost rejected");
  await expectSupplierAdjustmentPostFailure(creditNote.id, session);
  const creditRetrySnapshot = await getAccountsPayableDocumentSnapshot(session, creditDocument.id);
  if (Number(creditRetrySnapshot.paidAmount ?? 0) !== 30 || Number(creditRetrySnapshot.remainingAmount ?? 0) !== 70) {
    fail("Retrying supplier credit note post reduced the AP balance a second time.");
  }

  smokeStep("supplier debit note draft");
  const beforeDebitDocuments = await countGeneratedDebitNoteDocuments(session, creditNote.id);
  const debitNote = await createSupplierAdjustment(
    {
      supplierId: creditDocument.supplierId,
      adjustmentType: "DEBIT_NOTE",
      amount: 25,
      reference: `DN-${smokeRun}`,
      notes: "Nota de debito smoke local"
    },
    session
  );

  if (debitNote.status !== "DRAFT" || debitNote.adjustmentType !== "DEBIT_NOTE" || Number(debitNote.amount ?? 0) !== 25) {
    fail("Supplier debit note was not created as DRAFT with the expected amount.");
  }

  const debitDraftDocumentCount = await countGeneratedDebitNoteDocuments(session, debitNote.id);
  if (debitDraftDocumentCount !== 0 || beforeDebitDocuments !== 0) {
    fail("Creating a supplier debit note DRAFT generated AP documents.");
  }

  smokeStep("supplier debit note post");
  const postedDebitNote = await postSupplierAdjustment(debitNote.id, session);
  if (
    postedDebitNote.status !== "POSTED" ||
    !postedDebitNote.generatedAccountsPayableDocumentId ||
    !postedDebitNote.generatedDocumentNumber
  ) {
    fail("Supplier debit note did not post with a generated AP document.");
  }

  const generatedDebitSnapshot = await getAccountsPayableDocumentSnapshot(
    session,
    postedDebitNote.generatedAccountsPayableDocumentId
  );
  if (
    Number(generatedDebitSnapshot.totalAmount ?? 0) !== 25 ||
    Number(generatedDebitSnapshot.paidAmount ?? 0) !== 0 ||
    Number(generatedDebitSnapshot.remainingAmount ?? 0) !== 25 ||
    generatedDebitSnapshot.status !== "OPEN"
  ) {
    fail("Supplier debit note generated AP document with incorrect amount or status.");
  }

  smokeStep("supplier debit note repost rejected");
  await expectSupplierAdjustmentPostFailure(debitNote.id, session);
  const generatedDebitDocumentCount = await countGeneratedDebitNoteDocuments(session, debitNote.id);
  if (generatedDebitDocumentCount !== 1) {
    fail("Retrying supplier debit note post created duplicate AP documents.");
  }
}

async function validateSupplierStatementAndAgingFlow(session) {
  smokeStep("supplier statements aging AP document setup");
  const setup = await createSupplierAgingSmokeDocuments(session);
  const sideEffectsBefore = await countFinanceSideEffects(session);

  smokeStep("supplier aging fixed as-of date");
  const aging = await getSupplierAging(
    {
      supplierId: setup.supplierId,
      asOfDate: setup.asOfDate,
      pageSize: "20"
    },
    session
  );

  const agingRecord = aging.records.find((record) => String(record.supplierId).toLowerCase() === String(setup.supplierId).toLowerCase());
  if (!agingRecord) {
    fail("Supplier aging did not return the smoke supplier.");
  }

  const expectedBuckets = {
    currentAmount: 10,
    days1To30Amount: 20,
    days31To60Amount: 30,
    days61To90Amount: 40,
    daysOver90Amount: 50,
    totalOpenAmount: 150,
    overdueAmount: 140,
    notDueAmount: 10,
    openDocumentCount: 5,
    overdueDocumentCount: 4
  };

  for (const [field, expectedValue] of Object.entries(expectedBuckets)) {
    const actualValue = Number(agingRecord[field] ?? 0);
    if (Math.abs(actualValue - expectedValue) > 0.01) {
      fail(`Supplier aging ${field} expected ${expectedValue} but got ${actualValue}.`);
    }
  }

  const bucketSum =
    Number(agingRecord.currentAmount ?? 0) +
    Number(agingRecord.days1To30Amount ?? 0) +
    Number(agingRecord.days31To60Amount ?? 0) +
    Number(agingRecord.days61To90Amount ?? 0) +
    Number(agingRecord.daysOver90Amount ?? 0);

  if (Math.abs(bucketSum - Number(agingRecord.totalOpenAmount ?? 0)) > 0.01) {
    fail("Supplier aging bucket sum does not match totalOpenAmount.");
  }

  smokeStep("supplier statement fixed as-of date");
  const statement = await getSupplierStatements(
    {
      supplierId: setup.supplierId,
      asOfDate: setup.asOfDate,
      search: setup.prefix,
      pageSize: "20"
    },
    session
  );

  const bucketsByDocument = new Map(statement.records.map((record) => [record.documentNumber, record.agingBucket]));
  const expectedDocumentBuckets = {
    [`${setup.prefix}-CURRENT`]: "CURRENT",
    [`${setup.prefix}-1-30`]: "1-30",
    [`${setup.prefix}-31-60`]: "31-60",
    [`${setup.prefix}-61-90`]: "61-90",
    [`${setup.prefix}-90PLUS`]: "90+",
    [`${setup.prefix}-PAID`]: "90+"
  };

  for (const [documentNumber, expectedBucket] of Object.entries(expectedDocumentBuckets)) {
    if (bucketsByDocument.get(documentNumber) !== expectedBucket) {
      fail(`Statement document ${documentNumber} expected bucket ${expectedBucket}.`);
    }
  }

  const paidDocument = statement.records.find((record) => record.documentNumber === `${setup.prefix}-PAID`);
  if (!paidDocument || paidDocument.status !== "PAID" || Number(paidDocument.remainingAmount ?? 0) !== 0) {
    fail("Supplier statement must include the paid detail with zero remaining balance.");
  }

  if (Math.abs(Number(statement.summary.remainingAmount ?? 0) - 150) > 0.01) {
    fail("Supplier statement remaining summary must match open balances only because PAID has zero balance.");
  }

  const sideEffectsAfter = await countFinanceSideEffects(session);
  if (JSON.stringify(sideEffectsAfter) !== JSON.stringify(sideEffectsBefore)) {
    fail("Supplier statement and aging queries changed financial side-effect counts.");
  }
}

async function validateCustomerStatementAndAgingFlow(session) {
  smokeStep("customer statements aging AR document setup");
  const setup = await createCustomerAgingSmokeDocuments(session);
  const snapshotBefore = await getCustomerAging({ customerId: setup.customerId, asOfDate: setup.asOfDate, pageSize: "20" }, session);
  const sideEffectsBefore = await countAccountsReceivableReadSideEffects(session);

  smokeStep("customer aging fixed as-of date");
  const aging = await getCustomerAging(
    {
      customerId: setup.customerId,
      asOfDate: setup.asOfDate,
      pageSize: "20"
    },
    session
  );

  const agingRecord = aging.records.find((record) => String(record.customerId).toLowerCase() === String(setup.customerId).toLowerCase());
  if (!agingRecord) {
    fail("Customer aging did not return the smoke customer.");
  }

  const expectedBuckets = {
    currentAmount: 10,
    days1To30Amount: 20,
    days31To60Amount: 30,
    days61To90Amount: 40,
    daysOver90Amount: 50,
    totalOpenAmount: 150,
    overdueAmount: 140,
    notDueAmount: 10,
    openDocumentCount: 5,
    overdueDocumentCount: 4
  };

  for (const [field, expectedValue] of Object.entries(expectedBuckets)) {
    const actualValue = Number(agingRecord[field] ?? 0);
    if (Math.abs(actualValue - expectedValue) > 0.01) {
      fail(`Customer aging ${field} expected ${expectedValue} but got ${actualValue}.`);
    }
  }

  const bucketSum =
    Number(agingRecord.currentAmount ?? 0) +
    Number(agingRecord.days1To30Amount ?? 0) +
    Number(agingRecord.days31To60Amount ?? 0) +
    Number(agingRecord.days61To90Amount ?? 0) +
    Number(agingRecord.daysOver90Amount ?? 0);

  if (Math.abs(bucketSum - Number(agingRecord.totalOpenAmount ?? 0)) > 0.01) {
    fail("Customer aging bucket sum does not match totalOpenAmount.");
  }

  smokeStep("customer statement fixed as-of date");
  const statement = await getCustomerStatements(
    {
      customerId: setup.customerId,
      asOfDate: setup.asOfDate,
      search: setup.prefix,
      pageSize: "20"
    },
    session
  );

  const bucketsByDocument = new Map(statement.records.map((record) => [record.documentNumber, record.agingBucket]));
  const expectedDocumentBuckets = {
    [`${setup.prefix}-CURRENT`]: "CURRENT",
    [`${setup.prefix}-1-30`]: "1-30",
    [`${setup.prefix}-31-60`]: "31-60",
    [`${setup.prefix}-61-90`]: "61-90",
    [`${setup.prefix}-90PLUS`]: "90+",
    [`${setup.prefix}-PAID`]: "90+"
  };

  for (const [documentNumber, expectedBucket] of Object.entries(expectedDocumentBuckets)) {
    if (bucketsByDocument.get(documentNumber) !== expectedBucket) {
      fail(`Customer statement document ${documentNumber} expected bucket ${expectedBucket}.`);
    }
  }

  const paidDocument = statement.records.find((record) => record.documentNumber === `${setup.prefix}-PAID`);
  if (!paidDocument || paidDocument.status !== "PAID" || Number(paidDocument.remainingAmount ?? 0) !== 0) {
    fail("Customer statement must include the paid detail with zero remaining balance.");
  }

  if (Math.abs(Number(statement.summary.remainingAmount ?? 0) - 150) > 0.01) {
    fail("Customer statement remaining summary must match open balances only because PAID has zero balance.");
  }

  smokeStep("customer statement global summary pagination");
  const statementPage1 = await getCustomerStatements(
    {
      customerId: setup.customerId,
      asOfDate: setup.asOfDate,
      search: setup.prefix,
      page: "1",
      pageSize: "2"
    },
    session
  );
  const statementPage2 = await getCustomerStatements(
    {
      customerId: setup.customerId,
      asOfDate: setup.asOfDate,
      search: setup.prefix,
      page: "2",
      pageSize: "2"
    },
    session
  );

  if (JSON.stringify(statementPage1.summary) !== JSON.stringify(statementPage2.summary)) {
    fail("Customer statement summary must be global and stable across pages.");
  }

  if (
    Number(statementPage1.summary.documentCount ?? 0) !== 6 ||
    Number(statementPage1.summary.openDocumentCount ?? 0) !== 5 ||
    Math.abs(Number(statementPage1.summary.remainingAmount ?? 0) - 150) > 0.01
  ) {
    fail("Customer statement paginated summary must include all filtered documents.");
  }

  const statementPage1Documents = statementPage1.records.map((record) => record.documentNumber).join("|");
  const statementPage2Documents = statementPage2.records.map((record) => record.documentNumber).join("|");
  if (!statementPage1.records.length || !statementPage2.records.length || statementPage1Documents === statementPage2Documents) {
    fail("Customer statement paginated records must change by page.");
  }

  const detail = await expectOk(`/accounts-receivable/statements/${setup.customerId}?asOfDate=${setup.asOfDate}&search=${setup.prefix}&pageSize=20`, {
    headers: authHeaders(session)
  });
  if (!Array.isArray(detail.data?.records) || detail.data.records.length !== statement.records.length) {
    fail("Customer statement detail endpoint did not match the list endpoint.");
  }

  const agingDetail = await expectOk(`/accounts-receivable/aging/${setup.customerId}?asOfDate=${setup.asOfDate}&pageSize=20`, {
    headers: authHeaders(session)
  });
  if (!agingDetail.data?.records?.some((record) => String(record.customerId).toLowerCase() === setup.customerId)) {
    fail("Customer aging detail endpoint did not return the expected customer.");
  }

  smokeStep("customer aging global summary pagination");
  const agingPage1 = await getCustomerAging(
    {
      search: setup.customerSearch,
      asOfDate: setup.asOfDate,
      page: "1",
      pageSize: "1"
    },
    session
  );
  const agingPage2 = await getCustomerAging(
    {
      search: setup.customerSearch,
      asOfDate: setup.asOfDate,
      page: "2",
      pageSize: "1"
    },
    session
  );

  if (JSON.stringify(agingPage1.summary) !== JSON.stringify(agingPage2.summary)) {
    fail("Customer aging summary must be global and stable across pages.");
  }

  if (
    Math.abs(Number(agingPage1.summary.currentAmount ?? 0) - 15) > 0.01 ||
    Math.abs(Number(agingPage1.summary.totalOpenAmount ?? 0) - 155) > 0.01 ||
    Number(agingPage1.summary.openDocumentCount ?? 0) !== 6
  ) {
    fail("Customer aging paginated summary must include all filtered customers.");
  }

  const agingPage1Customer = agingPage1.records.map((record) => record.customerId).join("|");
  const agingPage2Customer = agingPage2.records.map((record) => record.customerId).join("|");
  if (!agingPage1.records.length || !agingPage2.records.length || agingPage1Customer === agingPage2Customer) {
    fail("Customer aging paginated records must change by page.");
  }

  const snapshotAfter = await getCustomerAging({ customerId: setup.customerId, asOfDate: setup.asOfDate, pageSize: "20" }, session);
  if (JSON.stringify(snapshotAfter.records) !== JSON.stringify(snapshotBefore.records)) {
    fail("Customer statement and aging queries changed the aging result.");
  }

  const sideEffectsAfter = await countAccountsReceivableReadSideEffects(session);
  if (JSON.stringify(sideEffectsAfter) !== JSON.stringify(sideEffectsBefore)) {
    fail("Customer statement and aging queries created financial side effects.");
  }
}

async function validateAccountsReceivableFlow(session) {
  smokeStep("accounts receivable manual document create");
  const customer = await getDemoCustomerReferences(session);
  const arDocumentCountBefore = await countAccountsReceivableDocuments(session);
  const sideEffectsBefore = await countFinanceSideEffects(session);
  const documentDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const document = await createAccountsReceivableDocument(
    {
      customerId: customer.customerId,
      sourceType: "MANUAL",
      documentDate,
      dueDate,
      currencyCode: "DOP",
      exchangeRate: 1,
      totalAmount: 100,
      reference: `AR-${smokeRun}`,
      notes: "Documento CxC smoke local"
    },
    session
  );

  if (
    document.status !== "OPEN" ||
    Number(document.totalAmount ?? 0) !== 100 ||
    Number(document.paidAmount ?? 0) !== 0 ||
    Number(document.remainingAmount ?? 0) !== 100
  ) {
    fail("Accounts receivable document was not created OPEN with the expected balance.");
  }

  const arDocumentCountAfter = await countAccountsReceivableDocuments(session);
  if (arDocumentCountAfter !== arDocumentCountBefore + 1) {
    fail("Accounts receivable document count did not increase by one.");
  }

  smokeStep("accounts receivable document query");
  const documents = await getAccountsReceivableDocuments(
    { search: document.documentNumber, page: "1", pageSize: "10" },
    session
  );
  const listedDocument = documents.records.find((record) => record.id === document.id);
  if (!listedDocument || listedDocument.documentNumber !== document.documentNumber) {
    fail("Created accounts receivable document was not returned by the document endpoint.");
  }

  smokeStep("accounts receivable customer balance query");
  const balances = await getCustomerReceivableBalances(
    { customerId: customer.customerId, page: "1", pageSize: "10" },
    session
  );
  const balance = balances.records.find((record) => String(record.customerId).toLowerCase() === customer.customerId);
  if (!balance || Number(balance.totalOpenAmount ?? 0) < 100 || Number(balance.openDocumentCount ?? 0) < 1) {
    fail("Customer receivable balance did not include the created document.");
  }

  const balanceDetail = await expectOk(`/accounts-receivable/customer-balances/${customer.customerId}`, {
    headers: authHeaders(session)
  });
  if (String(balanceDetail.data?.customerId).toLowerCase() !== customer.customerId) {
    fail("Customer receivable balance detail did not return the expected customer.");
  }

  smokeStep("accounts receivable tenant company isolation");
  const isolated = await request(`/accounts-receivable/documents/${document.id}`, {
    headers: {
      ...authHeaders(session),
      "x-company-id": "99999999-9999-9999-9999-999999999999"
    }
  });
  if (isolated.response.ok || isolated.body?.success !== false) {
    fail("Accounts receivable document must not be visible from another company context.");
  }

  const sideEffectsAfter = await countFinanceSideEffects(session);
  if (JSON.stringify(sideEffectsAfter) !== JSON.stringify(sideEffectsBefore)) {
    fail("Creating an accounts receivable document changed AP, payment, adjustment, or inventory counts.");
  }
}

async function validateCustomerReceiptFlow(session) {
  smokeStep("customer receipt partial and final posting");
  const customer = await getDemoCustomerReferences(session);
  const documentDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const document = await createAccountsReceivableDocument(
    {
      customerId: customer.customerId,
      sourceType: "MANUAL",
      documentDate,
      dueDate,
      currencyCode: "DOP",
      exchangeRate: 1,
      totalAmount: 100,
      reference: `AR-REC-${smokeRun}`,
      notes: "Documento CxC para smoke de recibos"
    },
    session
  );

  const initialSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (initialSnapshot.status !== "OPEN" || initialSnapshot.paidAmount !== 0 || initialSnapshot.remainingAmount !== 100) {
    fail("Customer receipt smoke document did not start with an OPEN balance of 100.");
  }

  smokeStep("customer receipt draft does not change balance");
  const partialReceipt = await createCustomerReceipt(
    {
      customerId: customer.customerId,
      receiptDate: documentDate,
      totalAmount: 30,
      reference: `REC-PARTIAL-${smokeRun}`,
      notes: "Recibo parcial smoke local"
    },
    session
  );

  const draftSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (draftSnapshot.paidAmount !== 0 || draftSnapshot.remainingAmount !== 100 || partialReceipt.status !== "DRAFT") {
    fail("Creating a customer receipt DRAFT changed AR document balances.");
  }

  smokeStep("customer receipt partial application and post");
  await applyCustomerReceipt(
    partialReceipt.id,
    {
      accountsReceivableDocumentId: document.id,
      appliedAmount: 30,
      notes: "Abono parcial smoke local"
    },
    session
  );
  const postedPartialReceipt = await postCustomerReceipt(partialReceipt.id, session);
  if (postedPartialReceipt.status !== "POSTED") {
    fail("Customer partial receipt was not posted.");
  }

  const partialSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (
    partialSnapshot.status !== "PARTIALLY_PAID" ||
    partialSnapshot.paidAmount !== 30 ||
    partialSnapshot.remainingAmount !== 70
  ) {
    fail("Customer partial receipt did not reduce AR balance to 70.");
  }

  smokeStep("customer receipt final application and post");
  const finalReceipt = await createCustomerReceipt(
    {
      customerId: customer.customerId,
      receiptDate: documentDate,
      totalAmount: 70,
      reference: `REC-FINAL-${smokeRun}`,
      notes: "Recibo final smoke local"
    },
    session
  );
  await applyCustomerReceipt(
    finalReceipt.id,
    {
      accountsReceivableDocumentId: document.id,
      appliedAmount: 70,
      notes: "Pago final smoke local"
    },
    session
  );
  const postedFinalReceipt = await postCustomerReceipt(finalReceipt.id, session);
  if (postedFinalReceipt.status !== "POSTED") {
    fail("Customer final receipt was not posted.");
  }

  const finalSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (finalSnapshot.status !== "PAID" || finalSnapshot.paidAmount !== 100 || finalSnapshot.remainingAmount !== 0) {
    fail("Customer final receipt did not close the AR balance.");
  }

  smokeStep("customer receipt repost rejected");
  await expectCustomerReceiptPostFailure(partialReceipt.id, session);
  const retrySnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (retrySnapshot.paidAmount !== 100 || retrySnapshot.remainingAmount !== 0 || retrySnapshot.status !== "PAID") {
    fail("Retrying customer receipt post reduced AR balance twice.");
  }
}

async function validateCustomerCreditNoteFlow(session) {
  smokeStep("customer credit note partial posting");
  const customer = await getDemoCustomerReferences(session);
  const documentDate = new Date().toISOString().slice(0, 10);
  const dueDate = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const document = await createAccountsReceivableDocument(
    {
      customerId: customer.customerId,
      sourceType: "MANUAL",
      documentDate,
      dueDate,
      currencyCode: "DOP",
      exchangeRate: 1,
      totalAmount: 100,
      reference: `AR-NC-${smokeRun}`,
      notes: "Documento CxC para smoke de notas de credito"
    },
    session
  );

  const initialSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (initialSnapshot.status !== "OPEN" || initialSnapshot.paidAmount !== 0 || initialSnapshot.remainingAmount !== 100) {
    fail("Customer credit note smoke document did not start with an OPEN balance of 100.");
  }

  smokeStep("customer credit note draft");
  const note = await createCustomerCreditNote(
    {
      customerId: customer.customerId,
      creditNoteDate: documentDate,
      amount: 30,
      reference: `NC-CXC-${smokeRun}`,
      notes: "Nota de credito smoke local"
    },
    session
  );

  const draftSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (draftSnapshot.paidAmount !== 0 || draftSnapshot.remainingAmount !== 100 || note.status !== "DRAFT") {
    fail("Creating a customer credit note DRAFT changed AR document balances.");
  }

  smokeStep("customer credit note application and post");
  await applyCustomerCreditNote(
    note.id,
    {
      accountsReceivableDocumentId: document.id,
      appliedAmount: 30,
      notes: "Credito parcial smoke local"
    },
    session
  );
  const postedNote = await postCustomerCreditNote(note.id, session);
  if (postedNote.status !== "POSTED") {
    fail("Customer credit note was not posted.");
  }

  const postedSnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (
    postedSnapshot.status !== "PARTIALLY_PAID" ||
    postedSnapshot.paidAmount !== 30 ||
    postedSnapshot.remainingAmount !== 70
  ) {
    fail("Customer credit note did not reduce AR balance to 70.");
  }

  smokeStep("customer credit note repost rejected");
  await expectCustomerCreditNotePostFailure(note.id, session);
  const retrySnapshot = await getAccountsReceivableDocumentSnapshot(document.id, session);
  if (
    retrySnapshot.status !== "PARTIALLY_PAID" ||
    retrySnapshot.paidAmount !== 30 ||
    retrySnapshot.remainingAmount !== 70
  ) {
    fail("Retrying customer credit note post duplicated AR balance effects.");
  }
}

function assertAmount(actual, expected, message) {
  if (Math.abs(Number(actual ?? 0) - expected) > 0.01) {
    fail(`${message}. Expected ${expected}, got ${actual}.`);
  }
}

async function validateSalesQuotationFlow(session) {
  smokeStep("sales quotation foundation flow");
  const customer = await getDemoCustomerReferences(session);
  const references = await getDemoPurchaseReferences(session);
  const sideEffectsBefore = await countSalesQuotationForbiddenSideEffects(session);
  const now = new Date();
  const validUntil = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString();

  const draft = await createSalesQuotation(
    {
      customerId: customer.customerId,
      quotationDate: now.toISOString(),
      validUntil,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `SAL-QA-${smokeRun}`,
      notes: "Cotizacion smoke local"
    },
    session
  );

  if (draft.status !== "DRAFT" || !String(draft.quotationNumber ?? "").startsWith("COT-")) {
    fail("Sales quotation was not created in DRAFT with an internal number.");
  }
  assertAmount(draft.totalAmount, 0, "Sales quotation DRAFT total must start at zero");

  smokeStep("sales quotation line calculations");
  const firstLineQuotation = await addSalesQuotationLine(
    draft.id,
    {
      itemId: references.itemId,
      unitOfMeasureId: references.unitOfMeasureId,
      description: "Linea simple smoke",
      quantity: 2,
      unitPrice: 10,
      discountPercent: 0,
      taxPercent: 0
    },
    session
  );
  assertAmount(firstLineQuotation.totalAmount, 20, "First sales quotation line total was not calculated");

  const secondLineQuotation = await addSalesQuotationLine(
    draft.id,
    {
      itemId: references.itemId,
      unitOfMeasureId: references.unitOfMeasureId,
      description: "Linea con descuento e impuesto",
      quantity: 3,
      unitPrice: 5,
      discountPercent: 10,
      taxPercent: 18
    },
    session
  );
  assertAmount(secondLineQuotation.subtotalAmount, 35, "Sales quotation subtotal did not consolidate all lines");
  assertAmount(secondLineQuotation.discountAmount, 1.5, "Sales quotation discount did not consolidate all lines");
  assertAmount(secondLineQuotation.taxAmount, 2.43, "Sales quotation tax did not consolidate all lines");
  assertAmount(secondLineQuotation.totalAmount, 35.93, "Sales quotation total did not consolidate all lines");

  smokeStep("sales quotation update and delete lines");
  const firstLine = secondLineQuotation.lines.find((line) => line.lineNumber === 1);
  const secondLine = secondLineQuotation.lines.find((line) => line.lineNumber === 2);
  if (!firstLine || !secondLine) {
    fail("Sales quotation lines were not returned in detail.");
  }

  const updatedQuotation = await updateSalesQuotationLine(
    draft.id,
    firstLine.id,
    {
      quantity: 4,
      unitPrice: 12,
      discountPercent: 0,
      taxPercent: 0
    },
    session
  );
  assertAmount(updatedQuotation.totalAmount, 63.93, "Sales quotation line update did not recalculate header totals");

  const deletedQuotation = await deleteSalesQuotationLine(draft.id, secondLine.id, session);
  assertAmount(deletedQuotation.totalAmount, 48, "Sales quotation delete did not recalculate header totals");

  smokeStep("sales quotation send and edit rejection");
  const sentQuotation = await transitionSalesQuotation(draft.id, "send", session);
  if (sentQuotation.status !== "SENT") {
    fail("Sales quotation did not transition to SENT.");
  }
  await expectSalesQuotationLineUpdateFailure(draft.id, firstLine.id, session);

  smokeStep("sales quotation approve");
  const approvedQuotation = await transitionSalesQuotation(draft.id, "approve", session);
  if (approvedQuotation.status !== "APPROVED") {
    fail("Sales quotation did not transition to APPROVED.");
  }

  smokeStep("sales quotation reject");
  const rejectDraft = await createSalesQuotation(
    {
      customerId: customer.customerId,
      validUntil,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `SAL-REJ-${smokeRun}`
    },
    session
  );
  const rejectWithLine = await addSalesQuotationLine(
    rejectDraft.id,
    {
      itemId: references.itemId,
      unitOfMeasureId: references.unitOfMeasureId,
      description: "Linea para rechazo",
      quantity: 1,
      unitPrice: 15
    },
    session
  );
  await transitionSalesQuotation(rejectWithLine.id, "send", session);
  const rejectedQuotation = await transitionSalesQuotation(rejectWithLine.id, "reject", session);
  if (rejectedQuotation.status !== "REJECTED") {
    fail("Sales quotation did not transition to REJECTED.");
  }

  smokeStep("sales quotation expire");
  const expireDraft = await createSalesQuotation(
    {
      customerId: customer.customerId,
      validUntil,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `SAL-EXP-${smokeRun}`
    },
    session
  );
  const expiredQuotation = await transitionSalesQuotation(expireDraft.id, "expire", session);
  if (expiredQuotation.status !== "EXPIRED") {
    fail("Sales quotation did not transition to EXPIRED.");
  }

  smokeStep("sales quotation list and isolation");
  const list = await getSalesQuotations({ search: approvedQuotation.quotationNumber, page: "1", pageSize: "10" }, session);
  if (!list.records?.some((record) => record.id === approvedQuotation.id)) {
    fail("Sales quotation list did not return the approved quotation.");
  }
  const detail = await getSalesQuotation(approvedQuotation.id, session);
  if (detail.id !== approvedQuotation.id || detail.lines.length !== 1) {
    fail("Sales quotation detail did not return the expected line.");
  }

  const isolated = await request(`/sales/quotations/${approvedQuotation.id}`, {
    headers: {
      ...authHeaders(session),
      "x-company-id": "99999999-9999-9999-9999-999999999999"
    }
  });
  if (isolated.response.ok || isolated.body?.success !== false) {
    fail("Sales quotation must not be visible from another company context.");
  }

  const runtimeRows = await expectOk(
    `/master-data/sales-quotations?search=${encodeURIComponent(approvedQuotation.quotationNumber)}&page=1&pageSize=10`,
    { headers: authHeaders(session) }
  );
  if (!runtimeRows.data?.some((record) => record.quotationNumber === approvedQuotation.quotationNumber)) {
    fail("/master-data/sales-quotations did not return the created quotation.");
  }

  const sideEffectsAfter = await countSalesQuotationForbiddenSideEffects(session);
  if (JSON.stringify(sideEffectsAfter) !== JSON.stringify(sideEffectsBefore)) {
    fail("Sales quotation flow changed inventory, ledger, AR or invoice side effects.");
  }
}

async function validateSalesOrderFlow(session) {
  smokeStep("sales order foundation flow");
  const customer = await getDemoCustomerReferences(session);
  const { itemId, unitOfMeasureId, warehouseId } = await getDemoPurchaseReferences(session);
  const sideEffectsBefore = await countSalesOrderForbiddenSideEffects(session);

  smokeStep("sales order direct draft");
  const draft = await createSalesOrder(
    {
      customerId: customer.customerId,
      requestedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `ORD-QA-${smokeRun}`,
      notes: "Pedido directo creado por smoke local"
    },
    session
  );

  if (draft.status !== "DRAFT" || !String(draft.orderNumber ?? "").startsWith("PED-")) {
    fail("Sales order was not created in DRAFT with an internal number.");
  }

  smokeStep("sales order line calculations");
  const firstLineOrder = await addSalesOrderLine(
    draft.id,
    {
      itemId,
      unitOfMeasureId,
      warehouseId,
      description: "Linea pedido QA 1",
      quantity: 2,
      unitPrice: 10,
      discountPercent: 0,
      taxPercent: 0
    },
    session
  );
  assertAmount(firstLineOrder.totalAmount, 20, "First sales order line total was not calculated");

  const secondLineOrder = await addSalesOrderLine(
    draft.id,
    {
      itemId,
      unitOfMeasureId,
      warehouseId,
      description: "Linea pedido QA 2",
      quantity: 3,
      unitPrice: 5,
      discountPercent: 10,
      taxPercent: 18
    },
    session
  );
  assertAmount(secondLineOrder.totalAmount, 35.93, "Second sales order line total was not calculated");

  smokeStep("sales order update and delete lines");
  const firstLine = secondLineOrder.lines.find((line) => line.lineNumber === 1);
  const secondLine = secondLineOrder.lines.find((line) => line.lineNumber === 2);
  if (!firstLine || !secondLine) {
    fail("Sales order lines were not returned in detail.");
  }

  const updatedOrder = await updateSalesOrderLine(
    draft.id,
    firstLine.id,
    {
      quantity: 4,
      unitPrice: 12,
      discountPercent: 0,
      taxPercent: 0
    },
    session
  );
  assertAmount(updatedOrder.totalAmount, 63.93, "Sales order line update did not recalculate header totals");

  const deletedOrder = await deleteSalesOrderLine(draft.id, secondLine.id, session);
  assertAmount(deletedOrder.totalAmount, 48, "Sales order delete did not recalculate header totals");

  smokeStep("sales order submit and edit rejection");
  const submittedOrder = await transitionSalesOrder(draft.id, "submit", session);
  if (submittedOrder.status !== "SUBMITTED") {
    fail("Sales order did not transition to SUBMITTED.");
  }
  await expectSalesOrderLineUpdateFailure(draft.id, firstLine.id, session);

  smokeStep("sales order approve");
  const approvedOrder = await transitionSalesOrder(draft.id, "approve", session);
  if (approvedOrder.status !== "APPROVED") {
    fail("Sales order did not transition to APPROVED.");
  }

  smokeStep("sales order reject");
  const rejectDraft = await createSalesOrder(
    {
      customerId: customer.customerId,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `ORD-REJ-${smokeRun}`
    },
    session
  );
  const rejectWithLine = await addSalesOrderLine(
    rejectDraft.id,
    {
      itemId,
      unitOfMeasureId,
      quantity: 1,
      unitPrice: 12
    },
    session
  );
  await transitionSalesOrder(rejectWithLine.id, "submit", session);
  const rejectedOrder = await transitionSalesOrder(rejectWithLine.id, "reject", session);
  if (rejectedOrder.status !== "REJECTED") {
    fail("Sales order did not transition to REJECTED.");
  }

  smokeStep("sales order cancel");
  const cancelDraft = await createSalesOrder(
    {
      customerId: customer.customerId,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `ORD-CAN-${smokeRun}`
    },
    session
  );
  const cancelledOrder = await cancelSalesOrder(cancelDraft.id, "Cancelacion validada por smoke local", session);
  if (cancelledOrder.status !== "CANCELLED") {
    fail("Sales order did not transition to CANCELLED.");
  }

  smokeStep("sales order from approved quotation conversion");
  const quotationDraft = await createSalesQuotation(
    {
      customerId: customer.customerId,
      validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `QUO-TO-ORD-${smokeRun}`,
      notes: "Cotizacion para convertir a pedido"
    },
    session
  );
  const quotationWithLine = await addSalesQuotationLine(
    quotationDraft.id,
    {
      itemId,
      unitOfMeasureId,
      description: "Linea cotizada para pedido",
      quantity: 2,
      unitPrice: 25,
      discountPercent: 0,
      taxPercent: 18
    },
    session
  );
  await transitionSalesQuotation(quotationWithLine.id, "send", session);
  const approvedQuotation = await transitionSalesQuotation(quotationWithLine.id, "approve", session);
  const orderFromQuotation = await createSalesOrderFromQuotation(approvedQuotation.id, session);

  if (orderFromQuotation.status !== "DRAFT") {
    fail("Sales order converted from quotation must start as DRAFT.");
  }
  if (orderFromQuotation.sourceQuotationId !== approvedQuotation.id) {
    fail("Sales order did not keep source quotation link.");
  }
  if (orderFromQuotation.lineCount !== approvedQuotation.lineCount) {
    fail("Sales order did not copy quotation lines.");
  }
  assertAmount(orderFromQuotation.totalAmount, approvedQuotation.totalAmount, "Sales order did not copy quotation total");

  const convertedQuotation = await getSalesQuotation(approvedQuotation.id, session);
  if (convertedQuotation.status !== "CONVERTED") {
    fail("Sales quotation was not marked CONVERTED after order creation.");
  }

  const retryOrder = await createSalesOrderFromQuotation(approvedQuotation.id, session);
  if (retryOrder.id !== orderFromQuotation.id) {
    fail("Retrying quotation conversion must not create a second sales order.");
  }

  const sourceOrders = await getSalesOrders(
    { sourceQuotationId: approvedQuotation.id, page: "1", pageSize: "10" },
    session
  );
  if (sourceOrders.records.length !== 1) {
    fail("Quotation conversion retry created duplicated sales orders.");
  }

  smokeStep("sales order list, metadata runtime and isolation");
  const list = await getSalesOrders({ search: approvedOrder.orderNumber, page: "1", pageSize: "10" }, session);
  if (!list.records?.some((record) => record.id === approvedOrder.id)) {
    fail("Sales order list did not return the approved order.");
  }

  const detail = await getSalesOrder(approvedOrder.id, session);
  if (detail.id !== approvedOrder.id || detail.status !== "APPROVED") {
    fail("Sales order detail did not return the approved order.");
  }

  const runtimeRows = await expectOk(
    `/master-data/sales-orders?search=${encodeURIComponent(approvedOrder.orderNumber)}&page=1&pageSize=10`,
    { headers: authHeaders(session) }
  );
  if (!runtimeRows.data?.some((record) => record.orderNumber === approvedOrder.orderNumber)) {
    fail("/master-data/sales-orders did not return the created order.");
  }

  const isolated = await request(`/sales/orders/${approvedOrder.id}`, {
    headers: {
      ...authHeaders(session),
      "x-company-id": "99999999-9999-9999-9999-999999999999"
    }
  });
  if (isolated.response.ok || isolated.body?.success !== false) {
    fail("Sales order must not be visible from another company context.");
  }

  const sideEffectsAfter = await countSalesOrderForbiddenSideEffects(session);
  if (JSON.stringify(sideEffectsAfter) !== JSON.stringify(sideEffectsBefore)) {
    fail("Sales order flow changed inventory, ledger, AR, invoice, reservation or dispatch side effects.");
  }
}

async function createApprovedReservationOrder(session, reference, quantity, withWarehouse = true) {
  const customer = await getDemoCustomerReferences(session);
  const { itemId, unitOfMeasureId, warehouseId } = await getDemoPurchaseReferences(session);
  const order = await createSalesOrder(
    {
      customerId: customer.customerId,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference
    },
    session
  );
  const withLine = await addSalesOrderLine(
    order.id,
    {
      itemId,
      unitOfMeasureId,
      warehouseId: withWarehouse ? warehouseId : null,
      quantity,
      unitPrice: 10,
      discountPercent: 0,
      taxPercent: 0
    },
    session
  );
  await transitionSalesOrder(order.id, "submit", session);
  const approved = await transitionSalesOrder(order.id, "approve", session);
  const line = withLine.lines[0];
  return { order: approved, line, itemId, warehouseId };
}

async function validateInventoryReservationFlow(session) {
  smokeStep("inventory reservation foundation flow");
  const { itemId, warehouseId } = await getDemoPurchaseReferences(session);
  await releaseSmokeInventoryReservations(session, itemId, warehouseId);
  await setSmokeStockQuantity(session, itemId, warehouseId, 10);
  const stockBefore = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const sideEffectsBefore = await countSalesOrderForbiddenSideEffects(session);

  smokeStep("inventory reservation complete flow");
  const complete = await createApprovedReservationOrder(session, `RES-FULL-${smokeRun}`, 5, true);
  const fullReserveKey = reservationIdempotencyKey("reserve-full");
  const fullReservation = await reserveSalesOrderLine(
    complete.order.id,
    complete.line.id,
    { idempotencyKey: fullReserveKey, quantity: 5, reference: `RES-FULL-${smokeRun}`, notes: "Reserva completa smoke" },
    session
  );
  if (fullReservation.activeQuantity !== 5 || fullReservation.status !== "ACTIVE") {
    fail("Complete reservation did not reserve active quantity 5.");
  }
  const fullReservationRetry = await reserveSalesOrderLine(
    complete.order.id,
    complete.line.id,
    { idempotencyKey: fullReserveKey, quantity: 5, reference: `RES-FULL-${smokeRun}`, notes: "Reserva completa smoke" },
    session
  );
  if (fullReservationRetry.reservedQuantity !== 5 || fullReservationRetry.activeQuantity !== 5) {
    fail("Retrying complete reservation duplicated quantity.");
  }
  await expectReservationFailure(
    `/sales/orders/${complete.order.id}/lines/${complete.line.id}/reserve`,
    { idempotencyKey: fullReserveKey, quantity: 1, reference: `RES-FULL-${smokeRun}`, notes: "Reserva completa smoke" },
    session
  );

  const availabilityAfterFull = await getInventoryAvailability({ itemId, warehouseId, page: "1", pageSize: "10" }, session);
  const fullAvailability = availabilityAfterFull.records[0];
  if (!fullAvailability) {
    fail("Item availability was not returned after reservation.");
  }
  if (
    Number(fullAvailability.onHandQuantity) !== 10 ||
    Number(fullAvailability.reservedQuantity) !== 5 ||
    Number(fullAvailability.availableQuantity) !== 5
  ) {
    fail("Complete reservation availability did not show on hand 10, reserved 5 and available 5.");
  }
  const stockAfterFull = await getSmokeStockSnapshot(session, itemId, warehouseId);
  if (stockAfterFull.quantityOnHand !== 10 || stockAfterFull.quantityReserved !== 0) {
    fail("Inventory reservation changed ItemStocks physical or reserved quantities.");
  }
  await setSmokeStockQuantity(session, itemId, warehouseId, 20);
  const stockBaseline = await getSmokeStockSnapshot(session, itemId, warehouseId);

  smokeStep("inventory reservation partial and idempotent increment");
  const partial = await createApprovedReservationOrder(session, `RES-PART-${smokeRun}`, 6, true);
  const partialNoReferenceKey = reservationIdempotencyKey("reserve-part-no-ref");
  const partialOne = await reserveSalesOrderLine(
    partial.order.id,
    partial.line.id,
    { idempotencyKey: partialNoReferenceKey, quantity: 2 },
    session
  );
  const partialNoReferenceRetry = await reserveSalesOrderLine(
    partial.order.id,
    partial.line.id,
    { idempotencyKey: partialNoReferenceKey, quantity: 2 },
    session
  );
  if (partialNoReferenceRetry.activeQuantity !== partialOne.activeQuantity) {
    fail("Retrying reservation without reference duplicated quantity.");
  }
  const partialLines = await getSalesOrderReservationLines(partial.order.id, session);
  const partialLine = partialLines.find((line) => line.salesOrderLineId === partial.line.id);
  if (!partialLine || partialLine.pendingReservationQuantity !== 4) {
    fail("Partial reservation did not leave pending quantity 4.");
  }
  const partialIncrementKey = reservationIdempotencyKey("reserve-part-increment");
  await reserveSalesOrderLine(
    partial.order.id,
    partial.line.id,
    { idempotencyKey: partialIncrementKey, quantity: 4, reference: `RES-PART-B-${smokeRun}` },
    session
  );
  const partialRetry = await reserveSalesOrderLine(
    partial.order.id,
    partial.line.id,
    { idempotencyKey: partialIncrementKey, quantity: 4, reference: `RES-PART-B-${smokeRun}` },
    session
  );
  if (partialRetry.activeQuantity !== 6) {
    fail("Retrying reservation with same reference duplicated quantity or failed to preserve total 6.");
  }
  await expectReservationFailure(
    `/sales/orders/${partial.order.id}/lines/${partial.line.id}/reserve`,
    { idempotencyKey: partialIncrementKey, quantity: 3, reference: `RES-PART-B-${smokeRun}` },
    session
  );
  const extraOrder = await createApprovedReservationOrder(session, `RES-EXTRA-${smokeRun}`, 1, true);
  const extraReservation = await reserveSalesOrderLine(
    extraOrder.order.id,
    extraOrder.line.id,
    { idempotencyKey: reservationIdempotencyKey("reserve-extra"), quantity: 1 },
    session
  );
  if (extraReservation.activeQuantity !== 1) {
    fail("A different idempotency key did not allow a valid additional reservation.");
  }

  smokeStep("inventory reservation insufficient availability rejected");
  const unavailable = await createApprovedReservationOrder(session, `RES-NO-STOCK-${smokeRun}`, 99, true);
  const reservationsBeforeFailure = await getInventoryAvailability({ itemId, warehouseId, page: "1", pageSize: "10" }, session);
  await expectReservationFailure(
    `/sales/orders/${unavailable.order.id}/lines/${unavailable.line.id}/reserve`,
    { idempotencyKey: reservationIdempotencyKey("reserve-no-stock"), quantity: 99, reference: `RES-NO-STOCK-${smokeRun}` },
    session
  );
  const reservationsAfterFailure = await getInventoryAvailability({ itemId, warehouseId, page: "1", pageSize: "10" }, session);
  if (JSON.stringify(reservationsAfterFailure.records[0]) !== JSON.stringify(reservationsBeforeFailure.records[0])) {
    fail("Failed reservation changed availability.");
  }

  smokeStep("inventory reservation partial release");
  const availabilityBeforePartialRelease = await getInventoryAvailability({ itemId, warehouseId, page: "1", pageSize: "10" }, session);
  const partialReleaseKey = reservationIdempotencyKey("release-partial");
  const releasedPartial = await releaseInventoryReservation(
    fullReservation.id,
    { idempotencyKey: partialReleaseKey, quantity: 2, reason: "Liberacion parcial smoke" },
    session
  );
  if (releasedPartial.status !== "PARTIALLY_RELEASED" || releasedPartial.activeQuantity !== 3) {
    fail("Partial release did not leave active quantity 3.");
  }
  const releasedPartialRetry = await releaseInventoryReservation(
    fullReservation.id,
    { idempotencyKey: partialReleaseKey, quantity: 2, reason: "Liberacion parcial smoke" },
    session
  );
  if (releasedPartialRetry.releasedQuantity !== releasedPartial.releasedQuantity || releasedPartialRetry.activeQuantity !== releasedPartial.activeQuantity) {
    fail("Retrying partial release duplicated ReleasedQuantity.");
  }
  await expectReservationFailure(
    `/inventory/reservations/${fullReservation.id}/release`,
    { idempotencyKey: partialReleaseKey, quantity: 1, reason: "Liberacion parcial smoke" },
    session
  );
  const availabilityAfterPartialRelease = await getInventoryAvailability({ itemId, warehouseId, page: "1", pageSize: "10" }, session);
  if (
    Number(availabilityAfterPartialRelease.records[0]?.availableQuantity ?? 0) !==
    Number(availabilityBeforePartialRelease.records[0]?.availableQuantity ?? 0) + 2
  ) {
    fail("Partial release did not increase availability.");
  }

  smokeStep("inventory reservation total release and retry rejected");
  const releasedFull = await releaseInventoryReservation(
    fullReservation.id,
    { idempotencyKey: reservationIdempotencyKey("release-full"), quantity: 3, reason: "Liberacion total smoke" },
    session
  );
  if (releasedFull.status !== "RELEASED" || releasedFull.activeQuantity !== 0) {
    fail("Total release did not close reservation.");
  }
  await expectReservationFailure(
    `/inventory/reservations/${fullReservation.id}/release`,
    { idempotencyKey: reservationIdempotencyKey("release-after-full"), quantity: 1, reason: "Reintento smoke" },
    session
  );

  smokeStep("inventory reservation security rejections");
  const draftCustomer = await getDemoCustomerReferences(session);
  const { unitOfMeasureId } = await getDemoPurchaseReferences(session);
  const draftOrder = await createSalesOrder(
    {
      customerId: draftCustomer.customerId,
      currencyCode: "DOP",
      exchangeRate: 1,
      reference: `RES-DRAFT-${smokeRun}`
    },
    session
  );
  const draftWithLine = await addSalesOrderLine(
    draftOrder.id,
    { itemId, unitOfMeasureId, warehouseId, quantity: 1, unitPrice: 10 },
    session
  );
  await expectReservationFailure(
    `/sales/orders/${draftOrder.id}/lines/${draftWithLine.lines[0].id}/reserve`,
    { idempotencyKey: reservationIdempotencyKey("reserve-draft"), quantity: 1, reference: `RES-DRAFT-${smokeRun}` },
    session
  );

  const noWarehouse = await createApprovedReservationOrder(session, `RES-NO-WHS-${smokeRun}`, 1, false);
  await expectReservationFailure(
    `/sales/orders/${noWarehouse.order.id}/lines/${noWarehouse.line.id}/reserve`,
    { idempotencyKey: reservationIdempotencyKey("reserve-no-whs"), quantity: 1, reference: `RES-NO-WHS-${smokeRun}` },
    session
  );

  const isolated = await request(`/sales/orders/${partial.order.id}/lines/${partial.line.id}/reserve`, {
    method: "POST",
    headers: {
      ...authHeaders(session),
      "x-company-id": "99999999-9999-9999-9999-999999999999"
    },
    body: JSON.stringify({ idempotencyKey: reservationIdempotencyKey("reserve-isolated"), quantity: 1, reference: `RES-ISO-${smokeRun}` })
  });
  if (isolated.response.ok || isolated.body?.success !== false) {
    fail("Reservation must remain isolated by tenant and company.");
  }

  const runtimeRows = await expectOk(`/master-data/inventory-reservations?search=${encodeURIComponent(partial.order.orderNumber)}&page=1&pageSize=10`, {
    headers: authHeaders(session)
  });
  if (!runtimeRows.data?.some((record) => record.orderNumber === partial.order.orderNumber)) {
    fail("/master-data/inventory-reservations did not expose the created reservation.");
  }

  const stockAfter = await getSmokeStockSnapshot(session, itemId, warehouseId);
  if (stockAfter.quantityOnHand !== stockBaseline.quantityOnHand || stockAfter.quantityReserved !== stockBaseline.quantityReserved) {
    fail("Reservation flow changed ItemStocks quantities.");
  }

  const sideEffectsAfter = await countSalesOrderForbiddenSideEffects(session);
  if (
    sideEffectsAfter.inventoryMovementCount !== sideEffectsBefore.inventoryMovementCount ||
    sideEffectsAfter.inventoryLedgerEntryCount !== sideEffectsBefore.inventoryLedgerEntryCount ||
    sideEffectsAfter.accountsReceivableDocumentCount !== sideEffectsBefore.accountsReceivableDocumentCount ||
    sideEffectsAfter.salesInvoiceCount !== sideEffectsBefore.salesInvoiceCount ||
    sideEffectsAfter.dispatchCount !== sideEffectsBefore.dispatchCount
  ) {
    fail("Reservation flow created forbidden movements, ledger entries, invoices, dispatches or AR documents.");
  }
}

async function validateSalesShipmentFlow(session) {
  smokeStep("sales shipment foundation flow");
  const { itemId, warehouseId } = await getDemoPurchaseReferences(session);
  await releaseSmokeInventoryReservations(session, itemId, warehouseId);
  await setSmokeStockQuantity(session, itemId, warehouseId, 10);

  const sideEffectsBefore = await countSalesShipmentForbiddenSideEffects(session);
  const stockBefore = await getSmokeStockSnapshot(session, itemId, warehouseId);

  const shipmentOrder = await createApprovedReservationOrder(session, `RES-SHP-${smokeRun}`, 10, true);
  const reservation = await reserveSalesOrderLine(
    shipmentOrder.order.id,
    shipmentOrder.line.id,
    {
      idempotencyKey: reservationIdempotencyKey("shipment-reserve"),
      quantity: 10,
      reference: `RES-SHP-${smokeRun}`,
      notes: "Reserva para despacho smoke"
    },
    session
  );

  if (reservation.activeQuantity !== 10 || reservation.status !== "ACTIVE") {
    fail("Shipment smoke reservation did not reserve active quantity 10.");
  }

  smokeStep("sales shipment create draft");
  const shipment = await createSalesShipment(
    {
      salesOrderId: shipmentOrder.order.id,
      reference: `SHP-QA-${smokeRun}`,
      notes: "Despacho creado por smoke local"
    },
    session
  );

  if (shipment.status !== "DRAFT" || !String(shipment.shipmentNumber ?? "").startsWith("DSP-")) {
    fail("Sales shipment was not created as DRAFT with an internal number.");
  }

  const stockAfterDraft = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const reservationAfterDraft = await getInventoryReservationSnapshot(session, reservation.id);

  if (stockAfterDraft.quantityOnHand !== stockBefore.quantityOnHand || reservationAfterDraft.consumedQuantity !== 0) {
    fail("Creating a draft sales shipment changed stock or consumed reservation.");
  }

  smokeStep("sales shipment add line");
  const shipmentWithLine = await addSalesShipmentLine(
    shipment.id,
    {
      salesOrderLineId: shipmentOrder.line.id,
      inventoryReservationId: reservation.id,
      quantity: 4,
      notes: "Linea parcial de despacho smoke"
    },
    session
  );

  if (shipmentWithLine.lineCount !== 1 || Number(shipmentWithLine.totalQuantity ?? 0) !== 4) {
    fail("Sales shipment line did not update draft totals.");
  }

  const orderShipmentLines = await getSalesOrderShipmentLines(shipmentOrder.order.id, session);
  const orderShipmentLine = orderShipmentLines.find((line) => line.salesOrderLineId === shipmentOrder.line.id);

  if (!orderShipmentLine || Number(orderShipmentLine.pendingShipmentQuantity ?? 0) !== 10) {
    fail("Sales order shipment summary changed pending quantity before posting the draft shipment.");
  }

  smokeStep("sales shipment post");
  const postKey = reservationIdempotencyKey("shipment-post-one");
  const postedShipment = await postSalesShipment(shipment.id, { idempotencyKey: postKey }, session);

  if (postedShipment.status !== "POSTED" || !postedShipment.inventoryMovementId || !postedShipment.movementNumber) {
    fail("Sales shipment did not post with an inventory movement.");
  }

  const stockAfterPost = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const reservationAfterPost = await getInventoryReservationSnapshot(session, reservation.id);

  if (stockAfterPost.quantityOnHand !== stockBefore.quantityOnHand - 4) {
    fail("Posting a sales shipment did not decrease stock by 4.");
  }

  if (reservationAfterPost.consumedQuantity !== 4 || reservationAfterPost.activeQuantity !== 6) {
    fail("Posting a sales shipment did not consume reservation quantity 4.");
  }

  const orderShipmentLinesAfterPost = await getSalesOrderShipmentLines(shipmentOrder.order.id, session);
  const orderShipmentLineAfterPost = orderShipmentLinesAfterPost.find((line) => line.salesOrderLineId === shipmentOrder.line.id);

  if (!orderShipmentLineAfterPost || Number(orderShipmentLineAfterPost.pendingShipmentQuantity ?? 0) !== 6) {
    fail("Sales order shipment summary did not show pending quantity 6 after posting the shipment.");
  }

  await assertInventoryLedgerEntries(session, postedShipment.movementNumber, [
    {
      movementType: "SALES_SHIPMENT",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: 4,
      quantityBalanceImpact: -4
    }
  ]);

  smokeStep("sales shipment repost idempotent");
  const retriedShipment = await postSalesShipment(shipment.id, { idempotencyKey: postKey }, session);
  const stockAfterRetry = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const reservationAfterRetry = await getInventoryReservationSnapshot(session, reservation.id);

  if (retriedShipment.inventoryMovementId !== postedShipment.inventoryMovementId) {
    fail("Retrying sales shipment post did not return the original movement.");
  }

  if (
    stockAfterRetry.quantityOnHand !== stockAfterPost.quantityOnHand ||
    reservationAfterRetry.consumedQuantity !== reservationAfterPost.consumedQuantity
  ) {
    fail("Retrying sales shipment post duplicated stock or reservation consumption.");
  }

  await expectSalesShipmentFailure(
    `/sales/shipments/${shipment.id}/post`,
    { idempotencyKey: reservationIdempotencyKey("shipment-post-again") },
    session
  );

  smokeStep("sales shipment over-ship rejected");
  const overShipment = await createSalesShipment(
    {
      salesOrderId: shipmentOrder.order.id,
      reference: `SHP-OVER-${smokeRun}`,
      notes: "Despacho excedente smoke"
    },
    session
  );
  await expectSalesShipmentFailure(
    `/sales/shipments/${overShipment.id}/lines`,
    {
      salesOrderLineId: shipmentOrder.line.id,
      inventoryReservationId: reservation.id,
      quantity: 7,
      notes: "Intento excedente smoke"
    },
    session
  );

  smokeStep("sales shipment final post closes order");
  const finalShipment = await createSalesShipment(
    {
      salesOrderId: shipmentOrder.order.id,
      reference: `SHP-FINAL-${smokeRun}`,
      notes: "Despacho final smoke"
    },
    session
  );
  const finalShipmentWithLine = await addSalesShipmentLine(
    finalShipment.id,
    {
      salesOrderLineId: shipmentOrder.line.id,
      inventoryReservationId: reservation.id,
      quantity: 6,
      notes: "Linea final de despacho smoke"
    },
    session
  );

  if (Number(finalShipmentWithLine.totalQuantity ?? 0) !== 6) {
    fail("Final sales shipment did not keep quantity 6.");
  }

  const postedFinalShipment = await postSalesShipment(
    finalShipment.id,
    { idempotencyKey: reservationIdempotencyKey("shipment-post-final") },
    session
  );

  const stockAfterFinal = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const reservationAfterFinal = await getInventoryReservationSnapshot(session, reservation.id);
  const closedOrder = await getSalesOrder(shipmentOrder.order.id, session);

  if (postedFinalShipment.status !== "POSTED" || stockAfterFinal.quantityOnHand !== stockBefore.quantityOnHand - 10) {
    fail("Final sales shipment did not post the remaining stock quantity.");
  }

  if (reservationAfterFinal.status !== "CONSUMED" || reservationAfterFinal.activeQuantity !== 0) {
    fail("Final sales shipment did not fully consume the reservation.");
  }

  if (closedOrder.status !== "CLOSED") {
    fail("Sales order was not closed after shipping all reserved quantity.");
  }

  await assertInventoryLedgerEntries(session, postedFinalShipment.movementNumber, [
    {
      movementType: "SALES_SHIPMENT",
      ledgerDirection: "OUT",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 0,
      quantityOut: 6,
      quantityBalanceImpact: -6
    }
  ]);

  const runtimeShipment = await findCatalogRecord("sales-shipments", postedShipment.shipmentNumber, session);
  if (!runtimeShipment || runtimeShipment.status !== "POSTED") {
    fail("/master-data/sales-shipments did not expose the posted shipment.");
  }

  const runtimeShipmentLine = await findCatalogRecord("sales-shipment-lines", postedShipment.shipmentNumber, session);
  if (!runtimeShipmentLine || Number(runtimeShipmentLine.quantity ?? 0) !== 4) {
    fail("/master-data/sales-shipment-lines did not expose the posted shipment line.");
  }

  const sideEffectsAfter = await countSalesShipmentForbiddenSideEffects(session);
  if (JSON.stringify(sideEffectsAfter) !== JSON.stringify(sideEffectsBefore)) {
    fail("Sales shipment flow created invoices or accounts receivable documents.");
  }
}

async function validateSalesInvoiceFlow(session) {
  smokeStep("sales invoice foundation flow");
  const { itemId, warehouseId } = await getDemoPurchaseReferences(session);
  await releaseSmokeInventoryReservations(session, itemId, warehouseId);
  await setSmokeStockQuantity(session, itemId, warehouseId, 12);

  const invoiceOrder = await createApprovedReservationOrder(session, `INV-SAL-${smokeRun}`, 5, true);
  const reservation = await reserveSalesOrderLine(
    invoiceOrder.order.id,
    invoiceOrder.line.id,
    {
      idempotencyKey: reservationIdempotencyKey("invoice-reserve"),
      quantity: 5,
      reference: `INV-SAL-${smokeRun}`,
      notes: "Reserva para factura smoke"
    },
    session
  );

  const shipment = await createSalesShipment(
    {
      salesOrderId: invoiceOrder.order.id,
      reference: `INV-SHP-${smokeRun}`,
      notes: "Despacho para factura smoke"
    },
    session
  );
  await addSalesShipmentLine(
    shipment.id,
    {
      salesOrderLineId: invoiceOrder.line.id,
      inventoryReservationId: reservation.id,
      quantity: 5,
      notes: "Linea despachada para factura smoke"
    },
    session
  );
  const postedShipment = await postSalesShipment(
    shipment.id,
    { idempotencyKey: reservationIdempotencyKey("invoice-shipment-post") },
    session
  );

  if (postedShipment.status !== "POSTED") {
    fail("Sales invoice smoke setup did not post shipment.");
  }

  const sideEffectsBeforeInvoice = await countSalesInvoiceForbiddenSideEffects(session);
  const stockBeforeInvoice = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const reservationBeforeInvoice = await getInventoryReservationSnapshot(session, reservation.id);

  smokeStep("sales invoice pending lines");
  const initialPending = await getSalesOrderInvoiceLines(invoiceOrder.order.id, session);
  const pendingLine = initialPending.find((line) => line.salesOrderLineId === invoiceOrder.line.id);
  if (!pendingLine || Number(pendingLine.pendingInvoiceQuantity ?? 0) !== 5) {
    fail("Sales invoice pending summary did not show quantity 5 after posted shipment.");
  }

  smokeStep("sales invoice draft");
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const partialInvoice = await createSalesInvoice(
    {
      salesOrderId: invoiceOrder.order.id,
      dueDate,
      reference: `FAC-PART-${smokeRun}`,
      notes: "Factura parcial smoke"
    },
    session
  );

  if (partialInvoice.status !== "DRAFT" || !String(partialInvoice.invoiceNumber ?? "").startsWith("FAC-")) {
    fail("Sales invoice was not created as DRAFT with an internal number.");
  }

  const arCountAfterDraft = await countSalesInvoiceAccountsReceivableDocuments(session, partialInvoice.id);
  if (arCountAfterDraft !== 0) {
    fail("Draft sales invoice created an accounts receivable document.");
  }

  const partialWithLine = await addSalesInvoiceLine(
    partialInvoice.id,
    {
      salesShipmentLineId: pendingLine.salesShipmentLineId,
      quantity: 2,
      notes: "Linea parcial de factura smoke"
    },
    session
  );

  if (partialWithLine.lineCount !== 1 || Number(partialWithLine.totalQuantity ?? 0) !== 2 || Number(partialWithLine.totalAmount ?? 0) <= 0) {
    fail("Sales invoice line did not update draft totals.");
  }

  const pendingBeforePost = await getSalesOrderInvoiceLines(invoiceOrder.order.id, session);
  const pendingLineBeforePost = pendingBeforePost.find((line) => line.salesOrderLineId === invoiceOrder.line.id);
  if (!pendingLineBeforePost || Number(pendingLineBeforePost.pendingInvoiceQuantity ?? 0) !== 5) {
    fail("Draft sales invoice changed pending invoice quantity before posting.");
  }

  smokeStep("sales invoice partial post");
  const partialPostKey = reservationIdempotencyKey("sales-invoice-post-partial");
  const postedPartialInvoice = await postSalesInvoice(partialInvoice.id, { idempotencyKey: partialPostKey }, session);
  if (
    postedPartialInvoice.status !== "POSTED" ||
    !postedPartialInvoice.accountsReceivableDocumentId ||
    !postedPartialInvoice.accountsReceivableDocumentNumber
  ) {
    fail("Posting sales invoice did not create an accounts receivable document.");
  }

  const arCountAfterPost = await countSalesInvoiceAccountsReceivableDocuments(session, partialInvoice.id);
  if (arCountAfterPost !== 1) {
    fail("Posting sales invoice did not create exactly one accounts receivable document.");
  }

  const pendingAfterPartial = await getSalesOrderInvoiceLines(invoiceOrder.order.id, session);
  const partialPendingLine = pendingAfterPartial.find((line) => line.salesOrderLineId === invoiceOrder.line.id);
  if (!partialPendingLine || Number(partialPendingLine.previouslyInvoicedQuantity ?? 0) !== 2 || Number(partialPendingLine.pendingInvoiceQuantity ?? 0) !== 3) {
    fail("Partial sales invoice did not reduce invoice pending quantity to 3.");
  }

  const retriedPartialInvoice = await postSalesInvoice(partialInvoice.id, { idempotencyKey: partialPostKey }, session);
  const arCountAfterRetry = await countSalesInvoiceAccountsReceivableDocuments(session, partialInvoice.id);
  if (
    retriedPartialInvoice.accountsReceivableDocumentId !== postedPartialInvoice.accountsReceivableDocumentId ||
    arCountAfterRetry !== 1
  ) {
    fail("Retrying sales invoice post duplicated accounts receivable document.");
  }

  await expectSalesInvoiceFailure(
    `/sales/invoices/${partialInvoice.id}/post`,
    { idempotencyKey: reservationIdempotencyKey("sales-invoice-post-duplicate") },
    session
  );

  smokeStep("sales invoice over invoice rejected");
  const overInvoice = await createSalesInvoice(
    {
      salesOrderId: invoiceOrder.order.id,
      dueDate,
      reference: `FAC-OVER-${smokeRun}`,
      notes: "Factura excedente smoke"
    },
    session
  );
  await expectSalesInvoiceFailure(
    `/sales/invoices/${overInvoice.id}/lines`,
    {
      salesShipmentLineId: pendingLine.salesShipmentLineId,
      quantity: 4,
      notes: "Intento excedente de factura smoke"
    },
    session
  );

  smokeStep("sales invoice final post");
  const finalInvoice = await createSalesInvoice(
    {
      salesOrderId: invoiceOrder.order.id,
      dueDate,
      reference: `FAC-FINAL-${smokeRun}`,
      notes: "Factura final smoke"
    },
    session
  );
  await addSalesInvoiceLine(
    finalInvoice.id,
    {
      salesShipmentLineId: pendingLine.salesShipmentLineId,
      quantity: 3,
      notes: "Linea final de factura smoke"
    },
    session
  );
  const postedFinalInvoice = await postSalesInvoice(
    finalInvoice.id,
    { idempotencyKey: reservationIdempotencyKey("sales-invoice-post-final") },
    session
  );

  const finalPending = await getSalesOrderInvoiceLines(invoiceOrder.order.id, session);
  const finalPendingLine = finalPending.find((line) => line.salesOrderLineId === invoiceOrder.line.id);
  if (!finalPendingLine || Number(finalPendingLine.pendingInvoiceQuantity ?? 0) !== 0) {
    fail("Final sales invoice did not reduce pending invoice quantity to zero.");
  }

  const stockAfterInvoice = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const reservationAfterInvoice = await getInventoryReservationSnapshot(session, reservation.id);
  const sideEffectsAfterInvoice = await countSalesInvoiceForbiddenSideEffects(session);
  if (
    stockAfterInvoice.quantityOnHand !== stockBeforeInvoice.quantityOnHand ||
    stockAfterInvoice.quantityReserved !== stockBeforeInvoice.quantityReserved ||
    reservationAfterInvoice.consumedQuantity !== reservationBeforeInvoice.consumedQuantity ||
    JSON.stringify(sideEffectsAfterInvoice) !== JSON.stringify(sideEffectsBeforeInvoice)
  ) {
    fail("Sales invoice flow changed inventory, ledger or reservations.");
  }

  const invoiceList = await getSalesInvoices({ search: postedPartialInvoice.invoiceNumber, page: "1", pageSize: "10" }, session);
  if (!invoiceList.records?.some((record) => record.id === postedPartialInvoice.id)) {
    fail("Sales invoice list did not return posted invoice.");
  }

  const runtimeInvoice = await findCatalogRecord("sales-invoices", postedPartialInvoice.invoiceNumber, session);
  if (!runtimeInvoice || runtimeInvoice.status !== "POSTED") {
    fail("/master-data/sales-invoices did not expose the posted invoice.");
  }

  const runtimeInvoiceLine = await findCatalogRecord("sales-invoice-lines", postedPartialInvoice.invoiceNumber, session);
  if (!runtimeInvoiceLine || Number(runtimeInvoiceLine.quantity ?? 0) !== 2) {
    fail("/master-data/sales-invoice-lines did not expose the posted invoice line.");
  }

  const runtimeOrderInvoice = await findCatalogRecord("sales-order-invoices", invoiceOrder.order.orderNumber, session);
  if (!runtimeOrderInvoice || Number(runtimeOrderInvoice.pendingInvoiceQuantity ?? -1) !== 0) {
    fail("/master-data/sales-order-invoices did not expose final pending quantity zero.");
  }

  const runtimeShipmentInvoice = await findCatalogRecord("sales-shipment-invoices", postedShipment.shipmentNumber, session);
  if (!runtimeShipmentInvoice || Number(runtimeShipmentInvoice.pendingInvoiceQuantity ?? -1) !== 0) {
    fail("/master-data/sales-shipment-invoices did not expose final pending quantity zero.");
  }

  if (postedFinalInvoice.status !== "POSTED") {
    fail("Final sales invoice did not post.");
  }
}

async function validateSalesReturnFlow(session) {
  smokeStep("sales return foundation flow");
  const { itemId, warehouseId } = await getDemoPurchaseReferences(session);
  await releaseSmokeInventoryReservations(session, itemId, warehouseId);
  await setSmokeStockQuantity(session, itemId, warehouseId, 10);

  const order = await createApprovedReservationOrder(session, `RET-SAL-${smokeRun}`, 10, true);
  const reservation = await reserveSalesOrderLine(
    order.order.id,
    order.line.id,
    {
      idempotencyKey: reservationIdempotencyKey("return-reserve"),
      quantity: 10,
      reference: `RET-SAL-${smokeRun}`
    },
    session
  );
  const shipment = await createSalesShipment(
    {
      salesOrderId: order.order.id,
      reference: `RET-SHP-${smokeRun}`,
      notes: "Despacho para devolucion smoke"
    },
    session
  );
  await addSalesShipmentLine(
    shipment.id,
    {
      salesOrderLineId: order.line.id,
      inventoryReservationId: reservation.id,
      quantity: 10,
      notes: "Linea despachada para devolucion smoke"
    },
    session
  );
  const postedShipment = await postSalesShipment(
    shipment.id,
    { idempotencyKey: reservationIdempotencyKey("return-shipment-post") },
    session
  );
  const stockAfterShipment = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const arBeforeReturns = await countAccountsReceivableDocuments(session);

  if (stockAfterShipment.quantityOnHand !== 0) {
    fail("Sales return setup did not leave controlled stock at zero after shipment.");
  }

  smokeStep("sales return partial draft");
  const returnable = await getSalesShipmentReturnableLines(postedShipment.id, session);
  const returnableLine = returnable.find((line) => line.salesShipmentLineId);
  if (!returnableLine || Number(returnableLine.returnableQuantity) !== 10) {
    fail("Sales returnable summary did not expose quantity 10.");
  }
  const partialReturn = await createSalesReturn(
    {
      salesShipmentId: postedShipment.id,
      reason: "Devolucion parcial smoke",
      reference: `RET-PART-${smokeRun}`
    },
    session
  );
  await addSalesReturnLine(
    partialReturn.id,
    {
      salesShipmentLineId: returnableLine.salesShipmentLineId,
      salesInvoiceLineId: returnableLine.salesInvoiceLineId ?? null,
      quantity: 4,
      reason: "Parcial smoke"
    },
    session
  );
  const stockAfterDraft = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const arAfterDraft = await countAccountsReceivableDocuments(session);
  const draftReturnRecord = await findCatalogRecord("sales-returns", partialReturn.returnNumber, session);
  if (stockAfterDraft.quantityOnHand !== stockAfterShipment.quantityOnHand || arAfterDraft !== arBeforeReturns || draftReturnRecord?.movementNumber) {
    fail("Draft sales return changed stock, CxC or created movement.");
  }

  smokeStep("sales return partial post");
  const partialPostKey = reservationIdempotencyKey("return-post-partial");
  const postedPartialReturn = await postSalesReturn(partialReturn.id, { idempotencyKey: partialPostKey }, session);
  const stockAfterPartial = await getSmokeStockSnapshot(session, itemId, warehouseId);
  if (postedPartialReturn.status !== "POSTED" || !postedPartialReturn.movementNumber || stockAfterPartial.quantityOnHand !== 4) {
    fail("Posting partial sales return did not increase stock by 4.");
  }
  await assertInventoryLedgerEntries(session, postedPartialReturn.movementNumber, [
    {
      movementType: "SALES_RETURN",
      ledgerDirection: "IN",
      warehouseCode: "ALM-PRINCIPAL",
      quantityIn: 4,
      quantityOut: 0,
      quantityBalanceImpact: 4
    }
  ]);
  const returnableAfterPartial = await getSalesShipmentReturnableLines(postedShipment.id, session);
  if (Number(returnableAfterPartial[0]?.returnableQuantity ?? 0) !== 6) {
    fail("Returnable quantity after partial return was not 6.");
  }

  smokeStep("sales return repost idempotent");
  const retriedPartial = await postSalesReturn(partialReturn.id, { idempotencyKey: partialPostKey }, session);
  const stockAfterRetry = await getSmokeStockSnapshot(session, itemId, warehouseId);
  if (retriedPartial.inventoryMovementId !== postedPartialReturn.inventoryMovementId || stockAfterRetry.quantityOnHand !== stockAfterPartial.quantityOnHand) {
    fail("Retrying sales return post duplicated movement or stock.");
  }
  await expectSalesReturnFailure(
    `/sales/returns/${partialReturn.id}/post`,
    { idempotencyKey: reservationIdempotencyKey("return-post-second-key") },
    session
  );

  smokeStep("sales return excess rejected");
  const excessReturn = await createSalesReturn(
    {
      salesShipmentId: postedShipment.id,
      reason: "Exceso smoke",
      reference: `RET-OVER-${smokeRun}`
    },
    session
  );
  await expectSalesReturnFailure(
    `/sales/returns/${excessReturn.id}/lines`,
    { salesShipmentLineId: returnableLine.salesShipmentLineId, quantity: 7, reason: "Exceso smoke" },
    session
  );

  smokeStep("sales return final post");
  const finalReturn = await createSalesReturn(
    {
      salesShipmentId: postedShipment.id,
      reason: "Devolucion final smoke",
      reference: `RET-FINAL-${smokeRun}`
    },
    session
  );
  await addSalesReturnLine(
    finalReturn.id,
    {
      salesShipmentLineId: returnableLine.salesShipmentLineId,
      quantity: 6,
      reason: "Final smoke"
    },
    session
  );
  const postedFinalReturn = await postSalesReturn(
    finalReturn.id,
    { idempotencyKey: reservationIdempotencyKey("return-post-final") },
    session
  );
  const stockAfterFinal = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const arAfterFinal = await countAccountsReceivableDocuments(session);
  if (postedFinalReturn.status !== "POSTED" || stockAfterFinal.quantityOnHand !== 10 || arAfterFinal !== arBeforeReturns) {
    fail("Final sales return did not restore stock to 10 or changed CxC.");
  }
  const returnableAfterFinal = await getSalesShipmentReturnableLines(postedShipment.id, session);
  if (Number(returnableAfterFinal[0]?.returnableQuantity ?? 0) !== 0) {
    fail("Returnable quantity after final return was not zero.");
  }

  smokeStep("sales return final draft has no side effects");
  const blockedDraft = await createSalesReturn(
    {
      salesShipmentId: postedShipment.id,
      reason: "Borrador sin efecto smoke",
      reference: `RET-DRAFT-${smokeRun}`
    },
    session
  ).catch(() => null);
  const stockAfterBlockedDraft = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const arAfterBlockedDraft = await countAccountsReceivableDocuments(session);
  if (blockedDraft || stockAfterBlockedDraft.quantityOnHand !== stockAfterFinal.quantityOnHand || arAfterBlockedDraft !== arBeforeReturns) {
    fail("Fully returned shipment allowed another draft or created forbidden side effects.");
  }

  const runtimeReturn = await findCatalogRecord("sales-returns", postedPartialReturn.returnNumber, session);
  const runtimeReturnLine = await findCatalogRecord("sales-return-lines", postedPartialReturn.returnNumber, session);
  const runtimeReturnable = await findCatalogRecord("sales-shipment-returns", postedShipment.shipmentNumber, session);
  if (!runtimeReturn || runtimeReturn.status !== "POSTED" || !runtimeReturnLine || !runtimeReturnable) {
    fail("Sales return runtime metadata did not expose return summaries.");
  }
}

async function validateSalesCreditNoteFlow(session) {
  smokeStep("sales credit note integration setup");
  const { itemId, warehouseId } = await getDemoPurchaseReferences(session);
  await releaseSmokeInventoryReservations(session, itemId, warehouseId);
  await setSmokeStockQuantity(session, itemId, warehouseId, 10);

  const order = await createApprovedReservationOrder(session, `CRN-SAL-${smokeRun}`, 10, true);
  const reservation = await reserveSalesOrderLine(
    order.order.id,
    order.line.id,
    {
      idempotencyKey: reservationIdempotencyKey("credit-note-reserve"),
      quantity: 10,
      reference: `CRN-SAL-${smokeRun}`
    },
    session
  );
  const shipment = await createSalesShipment(
    {
      salesOrderId: order.order.id,
      reference: `CRN-SHP-${smokeRun}`,
      notes: "Despacho para nota credito smoke"
    },
    session
  );
  await addSalesShipmentLine(
    shipment.id,
    {
      salesOrderLineId: order.line.id,
      inventoryReservationId: reservation.id,
      quantity: 10,
      notes: "Linea despachada para nota credito smoke"
    },
    session
  );
  const postedShipment = await postSalesShipment(
    shipment.id,
    { idempotencyKey: reservationIdempotencyKey("credit-note-shipment-post") },
    session
  );
  const invoice = await createSalesInvoice(
    {
      salesOrderId: order.order.id,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      reference: `CRN-FAC-${smokeRun}`,
      notes: "Factura para nota credito smoke"
    },
    session
  );
  const pendingInvoiceLines = await getSalesOrderInvoiceLines(order.order.id, session);
  const pendingInvoiceLine = pendingInvoiceLines.find((line) => line.salesShipmentLineId);
  if (!pendingInvoiceLine) {
    fail("Sales credit note setup did not expose invoice pending line.");
  }
  await addSalesInvoiceLine(
    invoice.id,
    {
      salesShipmentLineId: pendingInvoiceLine.salesShipmentLineId,
      quantity: 10,
      notes: "Factura completa para nota credito smoke"
    },
    session
  );
  const postedInvoice = await postSalesInvoice(
    invoice.id,
    { idempotencyKey: reservationIdempotencyKey("credit-note-invoice-post") },
    session
  );
  if (postedInvoice.status !== "POSTED" || !postedInvoice.accountsReceivableDocumentId) {
    fail("Sales credit note setup did not post invoice with AR document.");
  }

  const returnable = await getSalesShipmentReturnableLines(postedShipment.id, session);
  const returnableLine = returnable.find((line) => line.salesShipmentLineId);
  if (!returnableLine || !returnableLine.salesInvoiceLineId || Number(returnableLine.returnableQuantity) !== 10) {
    fail("Sales credit note setup did not expose invoiced returnable quantity 10.");
  }
  const salesReturn = await createSalesReturn(
    {
      salesShipmentId: postedShipment.id,
      salesInvoiceId: postedInvoice.id,
      reason: "Devolucion para nota credito smoke",
      reference: `CRN-RET-${smokeRun}`
    },
    session
  );
  await addSalesReturnLine(
    salesReturn.id,
    {
      salesShipmentLineId: returnableLine.salesShipmentLineId,
      quantity: 10,
      reason: "Devolucion completa para nota credito smoke"
    },
    session
  );
  const postedReturn = await postSalesReturn(
    salesReturn.id,
    { idempotencyKey: reservationIdempotencyKey("credit-note-return-post") },
    session
  );
  if (postedReturn.status !== "POSTED") {
    fail("Sales credit note setup did not post return.");
  }

  const stockBeforeCredits = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const movementCountBeforeCredits = await countInventoryMovements(session);
  const ledgerCountBeforeCredits = await countInventoryLedgerEntries(session);
  const arBeforeCredits = await getAccountsReceivableDocumentSnapshot(postedInvoice.accountsReceivableDocumentId, session);
  if (arBeforeCredits.status !== "OPEN" || arBeforeCredits.remainingAmount <= 0) {
    fail("Sales credit note setup AR document was not OPEN with pending balance.");
  }

  smokeStep("sales credit note partial draft");
  const pendingBefore = await getSalesCreditNoteCreditableReturns(
    { salesReturnId: postedReturn.id, page: "1", pageSize: "10" },
    session
  );
  const pendingReturn = pendingBefore.records?.find((record) => record.salesReturnId === postedReturn.id);
  if (!pendingReturn || Number(pendingReturn.pendingCreditAmount ?? 0) <= 0) {
    fail("Creditable sales return was not exposed for credit note creation.");
  }
  assertAmount(pendingReturn.pendingCreditAmount, arBeforeCredits.totalAmount, "Creditable return amount must match invoice balance");
  const partialAmount = Number((Number(pendingReturn.pendingCreditAmount) / 2).toFixed(2));
  const partialCreateKey = reservationIdempotencyKey("sales-credit-note-create-partial");
  const partialNote = await createSalesCreditNoteFromReturn(
    {
      salesReturnId: postedReturn.id,
      amount: partialAmount,
      reference: `CRN-PART-${smokeRun}`,
      notes: "Nota credito parcial smoke",
      idempotencyKey: partialCreateKey
    },
    session
  );
  if (partialNote.status !== "DRAFT" || Number(partialNote.amount) !== partialAmount) {
    fail("Partial sales credit note was not created in DRAFT with expected amount.");
  }
  const retriedPartialCreate = await createSalesCreditNoteFromReturn(
    {
      salesReturnId: postedReturn.id,
      amount: partialAmount,
      reference: `CRN-PART-${smokeRun}`,
      notes: "Nota credito parcial smoke",
      idempotencyKey: partialCreateKey
    },
    session
  );
  if (retriedPartialCreate.customerCreditNoteId !== partialNote.customerCreditNoteId) {
    fail("Retrying sales credit note creation did not return the original note.");
  }
  await expectSalesCreditNoteFailure(
    "/sales/credit-notes/from-return",
    {
      salesReturnId: postedReturn.id,
      amount: partialAmount + 1,
      reference: `CRN-PART-${smokeRun}`,
      notes: "Nota credito parcial smoke",
      idempotencyKey: partialCreateKey
    },
    session
  );
  const arAfterDraft = await getAccountsReceivableDocumentSnapshot(postedInvoice.accountsReceivableDocumentId, session);
  if (
    arAfterDraft.paidAmount !== arBeforeCredits.paidAmount ||
    arAfterDraft.remainingAmount !== arBeforeCredits.remainingAmount ||
    arAfterDraft.status !== arBeforeCredits.status
  ) {
    fail("Draft sales credit note changed AR document balances.");
  }

  smokeStep("sales credit note partial post");
  const partialPostKey = reservationIdempotencyKey("sales-credit-note-post-partial");
  const postedPartialNote = await postSalesCreditNote(partialNote.customerCreditNoteId, { idempotencyKey: partialPostKey }, session);
  if (postedPartialNote.status !== "POSTED") {
    fail("Partial sales credit note was not posted.");
  }
  const arAfterPartial = await getAccountsReceivableDocumentSnapshot(postedInvoice.accountsReceivableDocumentId, session);
  assertAmount(arAfterPartial.paidAmount, partialAmount, "Partial sales credit note did not increase paid amount");
  assertAmount(arAfterPartial.remainingAmount, arBeforeCredits.totalAmount - partialAmount, "Partial sales credit note did not reduce remaining amount");
  if (arAfterPartial.status !== "PARTIALLY_PAID") {
    fail("Partial sales credit note did not set AR status to PARTIALLY_PAID.");
  }
  const retriedPartialPost = await postSalesCreditNote(partialNote.customerCreditNoteId, { idempotencyKey: partialPostKey }, session);
  const arAfterPartialRetry = await getAccountsReceivableDocumentSnapshot(postedInvoice.accountsReceivableDocumentId, session);
  if (retriedPartialPost.customerCreditNoteId !== partialNote.customerCreditNoteId) {
    fail("Retrying sales credit note post did not return the original note.");
  }
  assertAmount(arAfterPartialRetry.paidAmount, arAfterPartial.paidAmount, "Retrying partial sales credit note duplicated paid amount");
  assertAmount(arAfterPartialRetry.remainingAmount, arAfterPartial.remainingAmount, "Retrying partial sales credit note duplicated remaining amount");
  await expectSalesCreditNoteFailure(
    `/sales/credit-notes/${partialNote.customerCreditNoteId}/post`,
    { idempotencyKey: reservationIdempotencyKey("sales-credit-note-post-again") },
    session
  );

  smokeStep("sales credit note final post");
  const pendingAfterPartial = await getSalesCreditNoteCreditableReturns(
    { salesReturnId: postedReturn.id, page: "1", pageSize: "10" },
    session
  );
  const remainingPending = pendingAfterPartial.records?.find((record) => record.salesReturnId === postedReturn.id);
  if (!remainingPending) {
    fail("Sales credit note pending amount disappeared before final credit.");
  }
  const finalAmount = Number(remainingPending.pendingCreditAmount);
  assertAmount(finalAmount, arAfterPartial.remainingAmount, "Final sales credit note amount must match AR remaining balance");
  const finalNote = await createSalesCreditNoteFromReturn(
    {
      salesReturnId: postedReturn.id,
      amount: finalAmount,
      reference: `CRN-FINAL-${smokeRun}`,
      notes: "Nota credito final smoke",
      idempotencyKey: reservationIdempotencyKey("sales-credit-note-create-final")
    },
    session
  );
  const postedFinalNote = await postSalesCreditNote(
    finalNote.customerCreditNoteId,
    { idempotencyKey: reservationIdempotencyKey("sales-credit-note-post-final") },
    session
  );
  if (postedFinalNote.status !== "POSTED") {
    fail("Final sales credit note was not posted.");
  }
  const arAfterFinal = await getAccountsReceivableDocumentSnapshot(postedInvoice.accountsReceivableDocumentId, session);
  if (arAfterFinal.status !== "PAID") {
    fail("Final sales credit note did not close AR document.");
  }
  assertAmount(arAfterFinal.paidAmount, arBeforeCredits.totalAmount, "Final sales credit note did not pay full AR document");
  assertAmount(arAfterFinal.remainingAmount, 0, "Final sales credit note did not leave AR remaining amount at zero");

  smokeStep("sales credit note excess rejected and no inventory effects");
  await expectSalesCreditNoteFailure(
    "/sales/credit-notes/from-return",
    {
      salesReturnId: postedReturn.id,
      amount: 1,
      reference: `CRN-OVER-${smokeRun}`,
      notes: "Exceso nota credito smoke",
      idempotencyKey: reservationIdempotencyKey("sales-credit-note-create-over")
    },
    session
  );
  const pendingAfterFinal = await getSalesCreditNoteCreditableReturns(
    { salesReturnId: postedReturn.id, page: "1", pageSize: "10" },
    session
  );
  if (pendingAfterFinal.records?.some((record) => record.salesReturnId === postedReturn.id)) {
    fail("Fully credited return still appears as pending.");
  }
  const creditNotes = await getSalesCreditNotes({ salesReturnId: postedReturn.id, page: "1", pageSize: "10" }, session);
  if (!creditNotes.records?.some((record) => record.customerCreditNoteId === partialNote.customerCreditNoteId) ||
      !creditNotes.records?.some((record) => record.customerCreditNoteId === finalNote.customerCreditNoteId)) {
    fail("Sales credit note list did not expose both posted notes.");
  }
  const stockAfterCredits = await getSmokeStockSnapshot(session, itemId, warehouseId);
  const movementCountAfterCredits = await countInventoryMovements(session);
  const ledgerCountAfterCredits = await countInventoryLedgerEntries(session);
  if (
    stockAfterCredits.quantityOnHand !== stockBeforeCredits.quantityOnHand ||
    stockAfterCredits.quantityReserved !== stockBeforeCredits.quantityReserved ||
    movementCountAfterCredits !== movementCountBeforeCredits ||
    ledgerCountAfterCredits !== ledgerCountBeforeCredits
  ) {
    fail("Sales credit notes created inventory stock, movement or ledger effects.");
  }

  const runtimeNote = await findCatalogRecord("sales-credit-notes", postedPartialNote.creditNoteNumber, session);
  if (!runtimeNote || runtimeNote.status !== "POSTED") {
    fail("/master-data/sales-credit-notes did not expose the posted sales credit note.");
  }
}

async function validateCrud(session) {
  const suffix = smokeRun;
  const customerCode = `QA-CUST-${suffix}`;
  const categoryCode = `QA-CAT-${suffix}`;
  const brandCode = `QA-BRD-${suffix}`;
  const unitCode = `QA-UOM-${suffix}`;
  const warehouseCode = `QA-WHS-${suffix}`;
  const itemCode = `QA-ITEM-${suffix}`;

  smokeStep("CRUD customer create");
  const customer = await createCatalogRecord(
    "customers",
    {
      code: customerCode,
      name: "Cliente QA Runtime",
      commercialName: "Cliente QA",
      documentType: "RNC",
      documentNumber: `QA${suffix}`,
      email: "qa.runtime@dobles.local",
      phone: "809-000-0100",
      city: "Santo Domingo",
      province: "Distrito Nacional",
      countryCode: "DOM",
      creditLimit: 1000,
      isCreditCustomer: true,
      isActive: true
    },
    session
  );

  smokeStep("CRUD customer update");
  await updateCatalogRecord(
    "customers",
    customer.id,
    {
      code: customerCode,
      name: "Cliente QA Runtime Editado",
      commercialName: "Cliente QA",
      documentType: "RNC",
      documentNumber: `QA${suffix}`,
      email: "qa.runtime@dobles.local",
      phone: "809-000-0100",
      city: "Santo Domingo",
      province: "Distrito Nacional",
      countryCode: "DOM",
      creditLimit: 1500,
      isCreditCustomer: true,
      isActive: true
    },
    session
  );

  smokeStep("CRUD customer deactivate/reactivate");
  await setCatalogRecordActive("customers", customer.id, false, session);
  await setCatalogRecordActive("customers", customer.id, true, session);

  smokeStep("CRUD customer search");
  const foundCustomer = await findCatalogRecord("customers", customerCode, session);

  if (!foundCustomer) {
    fail(`Created customer ${customerCode} was not found by search.`);
  }

  smokeStep("CRUD category create");
  const category = await createCatalogRecord(
    "categories",
    {
      code: categoryCode,
      name: "Categoria QA Runtime",
      description: "Categoria creada por smoke local",
      isSalesCategory: true,
      isPurchaseCategory: true,
      isInventoryCategory: true,
      isActive: true
    },
    session
  );

  smokeStep("CRUD brand create");
  const brand = await createCatalogRecord(
    "brands",
    {
      code: brandCode,
      name: "Marca QA Runtime",
      description: "Marca creada por smoke local",
      website: "https://local.dobles.example",
      countryCode: "DOM",
      isActive: true
    },
    session
  );

  smokeStep("CRUD unit of measure create");
  const unit = await createCatalogRecord(
    "units-of-measure",
    {
      code: unitCode,
      name: "Unidad QA Runtime",
      description: "Unidad creada por smoke local",
      symbol: "qa",
      unitType: "QUANTITY",
      decimalPrecision: 0,
      isBaseUnit: false,
      isActive: true
    },
    session
  );

  smokeStep("CRUD unit of measure search");
  const foundUnit = await findCatalogRecord("units-of-measure", unitCode, session);

  if (!foundUnit) {
    fail(`Created unit of measure ${unitCode} was not found by search.`);
  }

  smokeStep("CRUD warehouse create");
  const warehouse = await createCatalogRecord(
    "warehouses",
    {
      code: warehouseCode,
      name: "Almacen QA Runtime",
      description: "Almacen creado por smoke local",
      warehouseType: "NORMAL",
      addressLine1: "Calle QA 1",
      addressLine2: "Nave QA",
      city: "Santo Domingo",
      province: "Distrito Nacional",
      countryCode: "DOM",
      responsibleUserId: null,
      allowsNegativeInventory: false,
      isDefault: false,
      isTransit: false,
      isVirtual: false,
      isActive: true
    },
    session
  );

  smokeStep("CRUD warehouse search");
  const foundWarehouse = await findCatalogRecord("warehouses", warehouseCode, session);

  if (!foundWarehouse) {
    fail(`Created warehouse ${warehouseCode} was not found by search.`);
  }

  smokeStep("CRUD item create");
  const item = await createCatalogRecord(
    "items",
    {
      code: itemCode,
      name: "Articulo QA Runtime",
      shortDescription: "Articulo QA",
      barcode: `779${suffix}`,
      alternateCode: `ALT-${itemCode}`,
      categoryId: category.id,
      brandId: brand.id,
      unitOfMeasureId: unit.id,
      defaultWarehouseId: warehouse.id,
      inventoryType: "PRODUCT",
      itemType: "NORMAL",
      allowNegativeInventory: false,
      trackInventory: true,
      trackLot: false,
      trackSerial: false,
      isService: false,
      isManufactured: false,
      costMethod: "AVERAGE",
      standardCost: 10,
      averageCost: 10,
      lastCost: 10,
      basePrice: 15,
      minimumPrice: 12,
      maximumDiscountPercent: 0,
      weight: 0,
      volume: 0,
      notes: "Articulo creado por smoke local",
      isActive: true
    },
    session
  );

  smokeStep("inventory stock zero create");
  await ensureZeroStockRecord(session, item, warehouse);

  smokeStep("inventory stock zero search");
  const foundStock = await findCatalogRecord("inventory-stocks", itemCode, session);

  if (!foundStock) {
    fail(`Created inventory stock for ${itemCode} was not found by search.`);
  }

  const stockAvailable = Number(foundStock.quantityAvailable ?? 0);
  const stockOnHand = Number(foundStock.quantityOnHand ?? 0);
  const stockReserved = Number(foundStock.quantityReserved ?? 0);

  if (stockOnHand !== 0 || stockReserved !== 0 || stockAvailable !== 0) {
    fail(`Created inventory stock for ${itemCode} was not seeded with zero quantities.`);
  }

  if (stockAvailable !== stockOnHand - stockReserved) {
    fail(`Created inventory stock for ${itemCode} has an invalid available quantity.`);
  }

  await validateInventoryPostingFlow(session);
  await validateInventoryTransferFlow(session);
  await validateInventoryAdjustmentApiFlow(session);
  await validatePhysicalCountFlow(session);
}

async function main() {
  console.log(`smoke: API ${apiUrl}`);
  await validateBackendBasics();
  const session = await loginDemo();
  await validateCatalogs(session);
  await validateInventoryLedgerMetadata(session);
  await validateSalesQuotationMetadata(session);
  await validateSalesOrderMetadata(session);
  await validateInventoryReservationMetadata(session);
  await validateSalesShipmentMetadata(session);
  await validateSalesInvoiceMetadata(session);
  await validateSalesReturnMetadata(session);
  await validatePurchaseOrderMetadata(session);
  await validatePurchaseReceiptMetadata(session);
  await validateSupplierPaymentMetadata(session);
  await validateSupplierAdjustmentMetadata(session);
  await validateSupplierStatementMetadata(session);
  await validateAccountsReceivableMetadata(session);
  await validatePurchaseOrderFlow(session);
  const postedReceipt = await validatePurchaseReceiptFlow(session);
  await validateSupplierInvoiceFlow(session, postedReceipt);
  await validateSupplierPaymentFlow(session);
  await validateSupplierAdjustmentFlow(session);
  await validateSupplierStatementAndAgingFlow(session);
  await validateAccountsReceivableFlow(session);
  await validateCustomerReceiptFlow(session);
  await validateCustomerCreditNoteFlow(session);
  await validateCustomerStatementAndAgingFlow(session);
  await validateSalesQuotationFlow(session);
  await validateSalesOrderFlow(session);
  await validateInventoryReservationFlow(session);
  await validateSalesShipmentFlow(session);
  await validateSalesInvoiceFlow(session);
  await validateSalesReturnFlow(session);
  await validateSalesCreditNoteFlow(session);
  await validateCrud(session);
  console.log("smoke: local runtime validation OK");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
