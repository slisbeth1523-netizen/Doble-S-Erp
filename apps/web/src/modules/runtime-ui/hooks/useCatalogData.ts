import { useEffect, useMemo, useState } from "react";

import { normalizeApiError } from "../../../services/apiErrors.js";
import { fetchCatalogItems } from "../services/metadataClient.js";
import { queryLocalCatalog } from "../services/localStorageDb.js";
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

export function useCatalogData(
  catalog: string,
  query: CatalogGridQuery,
  refreshTrigger?: number
): RuntimeResourceState<CatalogListResult> {
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
        const friendlyError = normalizeApiError(error);
        const localResult = queryLocalCatalog(catalog, {
          search: query.search,
          isActive: activeFilter,
          page: query.page,
          pageSize: query.pageSize,
          sortBy: query.sortBy,
          sortDirection: query.sortDirection
        });

        if (!cancelled) {
          setState({
            data: localResult,
            loading: false,
            error: null,
            errorKind: friendlyError.kind,
            usingFallback: true,
            empty: localResult.items.length === 0
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalog, serializedQuery, refreshTrigger]);

  return state;
}
