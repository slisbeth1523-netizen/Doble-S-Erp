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
    <section className="runtime-filters" aria-label="Filtros del catálogo">
      <label>
        <span>Buscar</span>
        <input
          onChange={(event) => onChange({ ...value, page: 1, search: event.target.value })}
          placeholder={
            searchableFields.length > 0
              ? `Buscar por ${searchableFields.map((field) => field.label).join(", ")}`
              : "Buscar"
          }
          type="search"
          value={value.search}
        />
      </label>
      <label>
        <span>Estado</span>
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
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="all">Todos</option>
        </select>
      </label>
      <label>
        <span>Creado desde</span>
        <input
          onChange={(event) => onChange({ ...value, page: 1, createdFrom: event.target.value })}
          type="date"
          value={value.createdFrom}
        />
      </label>
      <label>
        <span>Creado hasta</span>
        <input
          onChange={(event) => onChange({ ...value, page: 1, createdTo: event.target.value })}
          type="date"
          value={value.createdTo}
        />
      </label>
    </section>
  );
}
