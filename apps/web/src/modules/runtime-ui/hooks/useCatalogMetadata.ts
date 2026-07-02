import { useEffect, useState } from "react";

import { normalizeApiError } from "../../../services/apiErrors.js";
import { fetchCatalogMetadata } from "../services/metadataClient.js";
import type { CatalogMetadata, RuntimeResourceState } from "../types/runtime-ui.types.js";

export function useCatalogMetadata(catalog: string): RuntimeResourceState<CatalogMetadata> {
  const [state, setState] = useState<RuntimeResourceState<CatalogMetadata>>({
    data: null,
    loading: true,
    error: null,
    empty: false
  });

  useEffect(() => {
    let cancelled = false;

    setState({ data: null, loading: true, error: null, empty: false });

    fetchCatalogMetadata(catalog)
      .then((metadata) => {
        if (!cancelled) {
          setState({ data: metadata, loading: false, error: null, empty: metadata.fields.length === 0 });
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
  }, [catalog]);

  return state;
}
