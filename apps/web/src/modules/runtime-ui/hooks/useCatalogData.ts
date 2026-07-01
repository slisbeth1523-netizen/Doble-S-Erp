import { useEffect, useMemo, useState } from "react";

import { fetchCatalogItems } from "../services/metadataClient.js";
import type { CatalogListResult, RuntimeResourceState } from "../types/runtime-ui.types.js";

export type CatalogGridQuery = {
  search: string;
  isActive: "all" | "active" | "inactive";
  createdFrom: string;
  createdTo: string;
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection: "asc" | "desc";
};

export function useCatalogData(catalog: string, query: CatalogGridQuery): RuntimeResourceState<CatalogListResult> {
  const [state, setState] = useState<RuntimeResourceState<CatalogListResult>>({
    data: null,
    loading: true,
    error: null,
    empty: false
  });
  const serializedQuery = useMemo(() => JSON.stringify(query), [query]);

  useEffect(() => {
    let cancelled = false;
    const activeFilter =
      query.isActive === "all" ? undefined : query.isActive === "active";

    setState((current) => ({ ...current, loading: true, error: null }));

    fetchCatalogItems(catalog, {
      search: query.search,
      isActive: activeFilter,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      page: query.page,
      pageSize: query.pageSize,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection
    })
      .then((result) => {
        if (!cancelled) {
          setState({ data: result, loading: false, error: null, empty: result.items.length === 0 });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load catalog data.",
            empty: false
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalog, query, serializedQuery]);

  return state;
}
