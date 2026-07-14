import { useMemo, useState } from "react";

import { type CatalogGridQuery, useCatalogData } from "../hooks/useCatalogData.js";
import { useCatalogMetadata } from "../hooks/useCatalogMetadata.js";
import type { CatalogRecord, RuntimeGridColumn } from "../types/runtime-ui.types.js";
import { FilterBuilder } from "./FilterBuilder.js";

const EMPTY_STATE_MESSAGES: Record<string, string> = {
  categories: "No hay categorías registradas.",
  brands: "No hay marcas registradas.",
  warehouses: "No hay almacenes registrados.",
  currencies: "No hay monedas registradas.",
  "units-of-measure": "No hay unidades de medida registradas.",
  "payment-terms": "No hay condiciones de pago registradas.",
  "tax-categories": "No hay categorías fiscales registradas.",
  "inventory-stocks": "No existen registros de existencias para mostrar.",
  "inventory-movements": "No hay movimientos de inventario para mostrar.",
  "inventory-ledger": "No existen movimientos de kardex para los filtros seleccionados.",
  "item-availability": "No existe información de disponibilidad para mostrar.",
  "inventory-reservations": "No hay reservas de inventario para mostrar."
};

type DynamicGridProps = {
  catalog: string;
  refreshTrigger?: number;
  onRowClick?: (record: CatalogRecord) => void;
  selectedRecordId?: string | number | boolean | null;
};

const defaultQuery: CatalogGridQuery = {
  search: "",
  isActive: "active",
  createdFrom: "",
  createdTo: "",
  page: 1,
  pageSize: 10,
  sortDirection: "asc"
};

function getColumnCategory(column: RuntimeGridColumn) {
  const fieldLower = column.field.toLowerCase();
  
  // 1. Check explicit formats / types in metadata
  const isExplicitCurrency = 
    column.format === "currency" || 
    (column as any).dataType === "currency" || 
    (column as any).semanticType === "currency" ||
    (column as any).displayFormat === "currency" ||
    (column as any).semanticType === "money";

  if (isExplicitCurrency) {
    return "currency";
  }

  // 2. Check for numeric identifiers (always formatted as raw text, left-aligned)
  const isIdentifier =
    fieldLower === "id" ||
    fieldLower.endsWith("id") ||
    fieldLower.startsWith("id") ||
    fieldLower === "code" ||
    fieldLower.endsWith("code") ||
    fieldLower.startsWith("code") ||
    fieldLower === "codigo" ||
    fieldLower.endsWith("codigo") ||
    fieldLower.startsWith("codigo") ||
    fieldLower === "phone" ||
    fieldLower.endsWith("phone") ||
    fieldLower.startsWith("phone") ||
    fieldLower === "telefono" ||
    fieldLower.endsWith("telefono") ||
    fieldLower.startsWith("telefono") ||
    fieldLower === "rnc" ||
    fieldLower.endsWith("rnc") ||
    fieldLower.startsWith("rnc") ||
    fieldLower === "ncf" ||
    fieldLower.endsWith("ncf") ||
    fieldLower.startsWith("ncf") ||
    fieldLower === "barcode" ||
    fieldLower.endsWith("barcode") ||
    fieldLower.startsWith("barcode") ||
    fieldLower === "sequence" ||
    fieldLower.endsWith("sequence") ||
    fieldLower.startsWith("sequence") ||
    fieldLower === "secuencia" ||
    fieldLower.endsWith("secuencia") ||
    fieldLower.startsWith("secuencia") ||
    fieldLower === "year" ||
    fieldLower.endsWith("year") ||
    fieldLower.startsWith("year") ||
    fieldLower === "año" ||
    fieldLower.endsWith("año") ||
    fieldLower.startsWith("año") ||
    fieldLower === "number" ||
    fieldLower.endsWith("number") ||
    fieldLower.startsWith("number") ||
    fieldLower === "numero" ||
    fieldLower.endsWith("numero") ||
    fieldLower.startsWith("numero");

  if (isIdentifier) {
    return "identifier";
  }

  // 3. Check for currency by name patterns (using complete words, suffix, or prefix, avoiding priceListName or costCenter)
  const isCurrencyName =
    fieldLower === "price" ||
    fieldLower.endsWith("price") ||
    fieldLower === "cost" ||
    fieldLower.endsWith("cost") ||
    fieldLower === "amount" ||
    fieldLower.endsWith("amount") ||
    fieldLower === "total" ||
    fieldLower.endsWith("total") ||
    fieldLower === "balance" ||
    fieldLower.endsWith("balance") ||
    fieldLower === "saldo" ||
    fieldLower.endsWith("saldo") ||
    fieldLower === "precio" ||
    fieldLower.endsWith("precio") ||
    fieldLower === "costo" ||
    fieldLower.endsWith("costo") ||
    fieldLower === "monto" ||
    fieldLower.endsWith("monto") ||
    fieldLower === "impuesto" ||
    fieldLower.endsWith("impuesto") ||
    fieldLower === "tax" ||
    fieldLower.endsWith("tax") ||
    fieldLower === "creditlimit" ||
    fieldLower.endsWith("creditlimit");

  if (isCurrencyName) {
    return "currency";
  }

  // 4. Check for quantity by name patterns
  const isQuantityName =
    fieldLower === "quantity" ||
    fieldLower.endsWith("quantity") ||
    fieldLower.startsWith("quantity") ||
    fieldLower.includes("quantity") ||
    fieldLower === "qty" ||
    fieldLower.endsWith("qty") ||
    fieldLower.startsWith("qty") ||
    fieldLower.includes("qty") ||
    fieldLower === "count" ||
    fieldLower.endsWith("count") ||
    fieldLower.startsWith("count") ||
    fieldLower === "stock" ||
    fieldLower.endsWith("stock") ||
    fieldLower.startsWith("stock") ||
    fieldLower.includes("stock") ||
    fieldLower === "existencia" ||
    fieldLower.endsWith("existencia") ||
    fieldLower.startsWith("existencia") ||
    fieldLower.includes("existencia") ||
    fieldLower === "cantidad" ||
    fieldLower.endsWith("cantidad") ||
    fieldLower.startsWith("cantidad") ||
    fieldLower.includes("cantidad");

  if (isQuantityName) {
    return "quantity";
  }

  // Fallback check on column type
  if (column.type === "number") {
    return "number";
  }

  return "text";
}

function formatCell(record: CatalogRecord, column: RuntimeGridColumn) {
  const value = record[column.field];

  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (column.type === "boolean") {
    return value ? "Sí" : "No";
  }

  if (column.type === "date" || column.type === "datetime") {
    return String(value).slice(0, column.type === "date" ? 10 : 16);
  }

  const lowerField = column.field.toLowerCase();

  if (column.type === "number" || typeof value === "number") {
    const num = Number(value);
    
    // Get explicit precision from metadata if available
    const metadataPrecision = 
      (column as any).decimalPrecision ?? 
      (column as any).precision ?? 
      (column as any).scale ?? 
      (column as any).decimals;

    const hasMetadataPrecision = metadataPrecision !== undefined && metadataPrecision !== null;

    // Check if the field is a percentage (e.g., ends with percent, porcentaje, or rate, or format is percentage)
    const isPercentage = 
      lowerField.includes("percent") || 
      lowerField.includes("porcentaje") || 
      column.format === "percentage" || 
      (column as any).dataType === "percentage";

    if (isPercentage) {
      const prec = hasMetadataPrecision ? Number(metadataPrecision) : 2;
      return num.toLocaleString("es-DO", {
        minimumFractionDigits: prec,
        maximumFractionDigits: prec
      }) + "%";
    }

    const category = getColumnCategory(column);

    if (category === "currency") {
      // Prioritize explicit currency formatting
      let currencyCode = String(
        (column as any).currencyCode ?? 
        (column as any).currency ?? 
        record.currencyCode ?? 
        record.currency ?? 
        record.currencyId ?? 
        ""
      ).trim().toUpperCase();
      
      const isValidCurrency = currencyCode.length === 3 && /^[A-Z]{3}$/.test(currencyCode);
      
      const minDec = hasMetadataPrecision ? Number(metadataPrecision) : 2;
      const isCost = lowerField.endsWith("cost") || lowerField.endsWith("costo");
      const maxDec = hasMetadataPrecision ? Number(metadataPrecision) : (isCost ? 4 : 2);

      if (isValidCurrency) {
        try {
          return new Intl.NumberFormat("es-DO", {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: minDec,
            maximumFractionDigits: maxDec
          }).format(num);
        } catch (e) {
          // Fallback if Intl fails
        }
      }
      
      // Neutral currency layout (no prefix RD$ or similar if currency is not resolved)
      return num.toLocaleString("es-DO", {
        minimumFractionDigits: minDec,
        maximumFractionDigits: maxDec
      });
    }

    if (category === "quantity") {
      let quantityPrecision = 2;
      if (hasMetadataPrecision) {
        quantityPrecision = Number(metadataPrecision);
      } else if (record.decimalPrecision !== undefined && record.decimalPrecision !== null) {
        quantityPrecision = Number(record.decimalPrecision);
      } else {
        const hasFraction = !Number.isInteger(num);
        return num.toLocaleString("es-DO", {
          minimumFractionDigits: 0,
          maximumFractionDigits: hasFraction ? 4 : 0
        });
      }

      return num.toLocaleString("es-DO", {
        minimumFractionDigits: quantityPrecision,
        maximumFractionDigits: quantityPrecision
      });
    }

    if (category === "identifier") {
      // Keep initial zeros intact, no thousands separators
      return String(value);
    }

    // Default neutral number format
    const defaultDec = hasMetadataPrecision ? Number(metadataPrecision) : 2;
    return num.toLocaleString("es-DO", {
      minimumFractionDigits: defaultDec,
      maximumFractionDigits: Math.max(defaultDec, 4)
    });
  }

  return String(value);
}

function getColumnAlignment(column: RuntimeGridColumn): "left" | "center" | "right" {
  // 1. Explicit configuration from metadata
  if (column.align) {
    return column.align;
  }

  const category = getColumnCategory(column);

  if (category === "currency" || category === "quantity" || category === "number") {
    return "right";
  }

  if (column.type === "boolean" || column.type === "date" || column.type === "datetime") {
    return "center";
  }

  // Fallback check based on field name for states/status
  const fieldLower = column.field.toLowerCase();
  if (
    fieldLower === "status" ||
    fieldLower === "state" ||
    fieldLower === "active" ||
    fieldLower === "estado" ||
    fieldLower === "activo" ||
    fieldLower === "isactive" ||
    fieldLower === "isdefault" ||
    fieldLower === "istransit" ||
    fieldLower === "isvirtual"
  ) {
    return "center";
  }

  return "left";
}

export function DynamicGrid({ catalog, refreshTrigger, onRowClick, selectedRecordId }: DynamicGridProps) {
  const metadata = useCatalogMetadata(catalog);
  const [query, setQuery] = useState<CatalogGridQuery>(defaultQuery);
  const columns = useMemo(
    () =>
      metadata.data?.grid.columns
        .slice()
        .sort((left, right) => left.order - right.order) ?? [],
    [metadata.data]
  );
  const data = useCatalogData(catalog, {
    ...query,
    sortBy: query.sortBy ?? columns.find((column) => column.sortable)?.field
  }, refreshTrigger);

  if (metadata.loading) {
    return <div className="runtime-state">Cargando grid...</div>;
  }

  if (metadata.error && !metadata.data) {
    return (
      <div className="runtime-state runtime-error">
        No fue posible cargar los registros. Verifique la conexión con la API.
      </div>
    );
  }

  if (!metadata.data || columns.length === 0) {
    return <div className="runtime-state">No hay columnas disponibles.</div>;
  }

  return (
    <section className="runtime-grid">
      <FilterBuilder metadata={metadata.data} value={query} onChange={setQuery} />
      {data.error ? (
        <div className="runtime-state runtime-error">
          No fue posible cargar los registros. Verifique la conexión con la API.
        </div>
      ) : null}
      <div className="runtime-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.field}
                  style={{ textAlign: getColumnAlignment(column), width: column.width }}
                >
                  {column.sortable ? (
                    <button
                      onClick={() =>
                        setQuery((current) => ({
                          ...current,
                          page: 1,
                          sortBy: column.field,
                          sortDirection:
                            current.sortBy === column.field && current.sortDirection === "asc"
                              ? "desc"
                              : "asc"
                        }))
                      }
                      type="button"
                    >
                      {column.label}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.loading ? (
              <tr>
                <td colSpan={columns.length}>Cargando registros...</td>
              </tr>
            ) : null}
            {data.empty ? (
              <tr>
                <td colSpan={columns.length}>
                  {EMPTY_STATE_MESSAGES[catalog] ?? (data.usingFallback
                    ? "Vista local activa. Conecte la API para consultar registros reales."
                    : "No se encontraron registros.")}
                </td>
              </tr>
            ) : null}
            {data.data?.items.map((record, index) => {
              const isSelected = selectedRecordId !== undefined && record.id === selectedRecordId;
              return (
                <tr 
                  key={String(record.id ?? index)}
                  onClick={() => onRowClick?.(record)}
                  className={isSelected ? "runtime-table-row-selected" : ""}
                  style={{ 
                    cursor: onRowClick ? "pointer" : "default",
                    background: isSelected ? "rgba(99, 102, 241, 0.1)" : undefined
                  }}
                >
                  {columns.map((column) => (
                    <td key={column.field} style={{ textAlign: getColumnAlignment(column) }}>
                      {formatCell(record, column)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="runtime-pagination">
        <button
          disabled={query.page <= 1 || data.loading}
          onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
          type="button"
        >
          Anterior
        </button>
        <span>
          Página {query.page}
          {data.data ? ` - ${data.data.totalItems} registros` : ""}
        </span>
        <button
          disabled={data.loading || (data.data?.items.length ?? 0) < query.pageSize}
          onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
          type="button"
        >
          Siguiente
        </button>
      </footer>
    </section>
  );
}
