import { useState } from "react";

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
        aria-label={`Search ${catalog}`}
        disabled={disabled}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={placeholder ?? "Search"}
        type="search"
        value={search}
      />
      <select
        disabled={disabled || lookup.loading}
        onChange={(event) => onChange?.(event.target.value || null)}
        value={value ?? ""}
      >
        <option value="">Select an option</option>
        {lookup.data?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.code ? `${option.code} - ${option.label}` : option.label}
          </option>
        ))}
      </select>
      {lookup.loading ? <span className="runtime-hint">Loading options...</span> : null}
      {lookup.error ? <span className="runtime-error">{lookup.error}</span> : null}
      {lookup.empty ? <span className="runtime-hint">No options found.</span> : null}
      {value ? (
        <button disabled={disabled} onClick={() => onChange?.(null)} type="button">
          Clear
        </button>
      ) : null}
    </div>
  );
}
