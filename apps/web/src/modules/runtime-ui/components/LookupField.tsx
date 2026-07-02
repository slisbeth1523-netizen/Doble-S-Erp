import { useState } from "react";

import { getCatalogLabel } from "../../master-data/utils/catalogLabels.js";
import { useCatalogLookup } from "../hooks/useCatalogLookup.js";

type LookupFieldProps = {
  catalog: string;
  value?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (value: string | null) => void;
};

export function LookupField({ catalog, value, disabled, placeholder, onChange }: LookupFieldProps) {
  const [search, setSearch] = useState("");
  const lookup = useCatalogLookup(catalog, search);

  return (
    <div className="runtime-lookup">
      <input
        aria-label={`Buscar ${getCatalogLabel(catalog)}`}
        disabled={disabled}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder ?? "Buscar"}
        type="search"
        value={search}
      />
      <select
        disabled={disabled || lookup.loading}
        onChange={(event) => onChange?.(event.target.value || null)}
        value={value ?? ""}
      >
        <option value="">Seleccione una opción</option>
        {lookup.data?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.code ? `${option.code} - ${option.label}` : option.label}
          </option>
        ))}
      </select>
      {lookup.loading ? <span className="runtime-hint">Cargando opciones...</span> : null}
      {lookup.error ? <span className="runtime-error">{lookup.error}</span> : null}
      {lookup.empty ? <span className="runtime-hint">No se encontraron opciones.</span> : null}
      {value ? (
        <button disabled={disabled} onClick={() => onChange?.(null)} type="button">
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
