export const catalogLabels: Record<string, string> = {
  customers: "Clientes",
  suppliers: "Proveedores",
  "purchase-orders": "Ordenes de compra",
  "purchase-order-lines": "Lineas de ordenes de compra",
  "purchase-receipts": "Recepciones de compra",
  "purchase-receipt-lines": "Lineas de recepciones de compra",
  items: "Artículos",
  categories: "Categorías",
  brands: "Marcas",
  warehouses: "Almacenes",
  "inventory-stocks": "Existencias",
  "inventory-movements": "Movimientos de inventario",
  "inventory-movement-lines": "Lineas de movimientos",
  "inventory-ledger": "Kardex",
  currencies: "Monedas",
  "units-of-measure": "Unidades de medida",
  "payment-terms": "Condiciones de pago",
  "tax-categories": "Categorías fiscales",
  "supplier-invoices": "Facturas de proveedores",
  "supplier-invoice-lines": "Líneas de facturas",
  "accounts-payable-documents": "Documentos de cuentas por pagar",
  "supplier-statements": "Estado de cuenta proveedores",
  "supplier-aging": "Antiguedad de proveedores",
  "supplier-payments": "Pagos a proveedores",
  "supplier-payment-applications": "Aplicaciones de pagos",
  "supplier-adjustments": "Notas de proveedor",
  "supplier-adjustment-applications": "Aplicaciones de notas",
  "accounts-receivable-documents": "Documentos de cuentas por cobrar",
  "customer-receivable-balances": "Saldos por cliente"
};

export function getCatalogLabel(catalog: string) {
  return catalogLabels[catalog] ?? catalog;
}
