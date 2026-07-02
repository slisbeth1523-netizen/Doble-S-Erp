import { useEffect, useState } from "react";

import { normalizeApiError } from "../../../services/apiErrors.js";
import { fetchCatalogLookup } from "../services/metadataClient.js";
import type { LookupOption, RuntimeResourceState } from "../types/runtime-ui.types.js";

export function useCatalogLookup(
  catalog: string,
  search: string,
  pageSize = 20
): RuntimeResourceState<LookupOption[]> {
  const [state, setState] = useState<RuntimeResourceState<LookupOption[]>>({
    data: null,
    loading: true,
    error: null,
    empty: false
  });

  useEffect(() => {
    let cancelled = false;

    setState((current) => ({ ...current, loading: true, error: null }));

    fetchCatalogLookup(catalog, { search, page: 1, pageSize })
      .then((options) => {
        if (!cancelled) {
          setState({ data: options, loading: false, error: null, empty: options.length === 0 });
        }
      })
      .catch((error: unknown) => {
        const friendlyError = normalizeApiError(error);

        if (!cancelled) {
          setState({
            data: null,
            loading: false,
            error: friendlyError.message,
            errorKind: friendlyError.kind,
            empty: false
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [catalog, pageSize, search]);

  return state;
}
