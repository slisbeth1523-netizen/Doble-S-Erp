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
  "accounts-payable-documents": "Documentos de cuentas por pagar"
};

export function getCatalogLabel(catalog: string) {
  return catalogLabels[catalog] ?? catalog;
}
