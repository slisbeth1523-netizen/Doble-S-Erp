export const catalogLabels: Record<string, string> = {
  customers: "Clientes",
  suppliers: "Proveedores",
  items: "Artículos",
  categories: "Categorías",
  currencies: "Monedas",
  "units-of-measure": "Unidades de medida",
  "payment-terms": "Condiciones de pago",
  "tax-categories": "Categorías fiscales"
};

export function getCatalogLabel(catalog: string) {
  return catalogLabels[catalog] ?? catalog;
}

