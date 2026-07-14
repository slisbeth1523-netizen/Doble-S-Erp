const labels: Record<string, string> = {
  APPROVED: "Aprobado",
  CANCELLED: "Cancelado",
  CLOSED: "Cerrado",
  CREDIT_NOTE: "Nota de credito",
  CURRENT: "Corriente",
  ADJUSTMENT_CREATED: "Ajuste generado",
  ACCEPTED: "Aceptado",
  COMPLETED: "Completado",
  CUSTOMER_DEBIT_NOTE: "Nota de debito cliente",
  DEBIT_NOTE: "Nota de debito",
  DRAFT: "Borrador",
  GENERATED: "Generado",
  MANUAL: "Manual",
  OPEN: "Abierto",
  OPENING: "Apertura",
  OPENING_BALANCE: "Saldo inicial",
  PAID: "Pagado",
  PARTIALLY_PAID: "Parcialmente pagado",
  PENDING: "Pendiente",
  POSTED: "Posteado",
  RUNNING: "En ejecucion",
  REJECTED: "Rechazado",
  SENT: "Enviado",
  SIGNED: "Firmado",
  ACCEPTED_CONDITIONAL: "Aceptado condicional",
  PASSED: "Aprobado",
  FAILED: "Fallido",
  NOT_STARTED: "No iniciado",
  READY_TO_APPLY: "Listo para postular",
  SUBMITTED: "Enviado",
  ON_HOLD: "En espera",
  REQUESTED: "Solicitado",
  AUTHORIZED: "Autorizado",
  PURCHASE_RECEIPT: "Recepcion de compra",
  SALES_INVOICE: "Factura de venta",
  SALES_RETURN: "Devolucion de venta",
  SUPPLIER_CREDIT_NOTE: "Nota de credito proveedor",
  SUPPLIER_DEBIT_NOTE: "Nota de debito proveedor",
  SUPPLIER_INVOICE: "Factura proveedor",
  TRANSFER: "Transferencia",
  VOIDED: "Anulado"
};

export function displayLabel(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const text = String(value);
  return labels[text] ?? text;
}

export function statusLabel(value: unknown) {
  return displayLabel(value);
}

export function sourceTypeLabel(value: unknown) {
  return displayLabel(value);
}
