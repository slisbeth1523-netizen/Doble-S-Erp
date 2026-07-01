import type { CatalogGridQuery } from "../hooks/useCatalogData.js";
import type { CatalogMetadata } from "../types/runtime-ui.types.js";

type FilterBuilderProps = {
  metadata: CatalogMetadata;
  value: CatalogGridQuery;
  onChange: (value: CatalogGridQuery) => void;
};

export function FilterBuilder({ metadata, value, onChange }: FilterBuilderProps) {
  const searchableFields = metadata.fields
    .filter((field) => field.searchable)
    .sort((left, right) => left.displayOrder - right.displayOrder);

  return (
    <section className="runtime-filters" aria-label="Catalog filters">
      <label>
        <span>Search</span>
        <input
          onChange={(event) => onChange({ ...value, page: 1, search: event.target.value })}
          placeholder={
            searchableFields.length > 0
              ? `Search ${searchableFields.map((field) => field.label).join(", ")}`
              : "Search"
          }
          type="search"
          value={value.search}
        />
      </label>
      <label>
        <span>Status</span>
        <select
          onChange={(event) =>
            onChange({
              ...value,
              page: 1,
              isActive: event.target.value as CatalogGridQuery["isActive"]
            })
          }
          value={value.isActive}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </label>
      <label>
        <span>Created from</span>
        <input
          onChange={(event) => onChange({ ...value, page: 1, createdFrom: event.target.value })}
          type="date"
          value={value.createdFrom}
        />
      </label>
      <label>
        <span>Created to</span>
        <input
          onChange={(event) => onChange({ ...value, page: 1, createdTo: event.target.value })}
          type="date"
          value={value.createdTo}
        />
      </label>
    </section>
  );
}
