import { useMemo, useState } from "react";

import { type CatalogGridQuery, useCatalogData } from "../hooks/useCatalogData.js";
import { useCatalogMetadata } from "../hooks/useCatalogMetadata.js";
import type { CatalogRecord, RuntimeGridColumn } from "../types/runtime-ui.types.js";
import { FilterBuilder } from "./FilterBuilder.js";

type DynamicGridProps = {
  catalog: string;
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

function formatCell(record: CatalogRecord, column: RuntimeGridColumn) {
  const value = record[column.field];

  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (column.type === "boolean") {
    return value ? "Yes" : "No";
  }

  if (column.type === "date" || column.type === "datetime") {
    return String(value).slice(0, column.type === "date" ? 10 : 16);
  }

  return String(value);
}

export function DynamicGrid({ catalog }: DynamicGridProps) {
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
  });

  if (metadata.loading) {
    return <div className="runtime-state">Loading grid...</div>;
  }

  if (metadata.error) {
    return <div className="runtime-state runtime-error">{metadata.error}</div>;
  }

  if (!metadata.data || columns.length === 0) {
    return <div className="runtime-state">No columns available.</div>;
  }

  return (
    <section className="runtime-grid">
      <FilterBuilder metadata={metadata.data} value={query} onChange={setQuery} />
      {data.error ? <div className="runtime-state runtime-error">{data.error}</div> : null}
      <div className="runtime-table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.field}
                  style={{ textAlign: column.align ?? "left", width: column.width }}
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
                <td colSpan={columns.length}>Loading data...</td>
              </tr>
            ) : null}
            {data.empty ? (
              <tr>
                <td colSpan={columns.length}>No data found.</td>
              </tr>
            ) : null}
            {data.data?.items.map((record, index) => (
              <tr key={String(record.id ?? index)}>
                {columns.map((column) => (
                  <td key={column.field} style={{ textAlign: column.align ?? "left" }}>
                    {formatCell(record, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="runtime-pagination">
        <button
          disabled={query.page <= 1 || data.loading}
          onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
          type="button"
        >
          Previous
        </button>
        <span>
          Page {query.page}
          {data.data ? ` - ${data.data.totalItems} items` : ""}
        </span>
        <button
          disabled={data.loading || (data.data?.items.length ?? 0) < query.pageSize}
          onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
          type="button"
        >
          Next
        </button>
      </footer>
    </section>
  );
}
