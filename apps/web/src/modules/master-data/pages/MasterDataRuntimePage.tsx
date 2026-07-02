import { useMemo, useState } from "react";

import { Alert, Badge, ErrorState, LoadingState, PageHeader } from "../../../components/ui/index.js";
import { DynamicForm } from "../../runtime-ui/components/DynamicForm.js";
import { DynamicGrid } from "../../runtime-ui/components/DynamicGrid.js";
import { RuntimeActions } from "../../runtime-ui/components/RuntimeActions.js";
import { useCatalogMetadata } from "../../runtime-ui/hooks/useCatalogMetadata.js";
import type { RuntimeFormValues } from "../../runtime-ui/utils/validationRuntime.js";

type MasterDataRuntimePageProps = {
  catalog?: string;
};

function catalogFromLocation() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const masterDataIndex = segments.indexOf("master-data");
  return masterDataIndex >= 0 ? segments[masterDataIndex + 1] : undefined;
}

export function MasterDataRuntimePage({ catalog }: MasterDataRuntimePageProps) {
  const resolvedCatalog = catalog ?? catalogFromLocation() ?? "currencies";
  const metadata = useCatalogMetadata(resolvedCatalog);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const title = useMemo(
    () => metadata.data?.catalog.displayName ?? resolvedCatalog,
    [metadata.data, resolvedCatalog]
  );

  return (
    <div className="master-data-runtime-page">
      <PageHeader
        actions={
          metadata.data ? (
            <RuntimeActions
              actions={metadata.data.actions}
              onAction={(action) => setLastAction(`${action} preparado por metadata.`)}
            />
          ) : (
            <Badge tone="amber">Requiere API</Badge>
          )
        }
        description="Pantalla generica por metadata para catalogos tecnicos. Si la API requiere autenticacion, la vista muestra el estado controlado."
        eyebrow="Master Data Runtime"
        title={title}
      />

      <Alert title="Catalogo tecnico">
        Esta pagina usa el motor runtime existente y no implementa pantallas especificas por catalogo.
      </Alert>

      {metadata.loading ? <LoadingState label="Cargando metadata del catalogo..." /> : null}
      {metadata.error ? <ErrorState message={metadata.error} title="No se pudo cargar metadata" /> : null}
      {lastAction ? <Alert tone="success">{lastAction}</Alert> : null}

      <section className="runtime-layout runtime-layout-two">
        <div className="runtime-panel">
          <div className="panel-heading">
            <div>
              <h2>Registros</h2>
              <p>Grid dinamico preparado para busqueda, filtros y paginacion.</p>
            </div>
          </div>
          <DynamicGrid catalog={resolvedCatalog} />
        </div>
        <aside className="runtime-panel">
          <div className="panel-heading">
            <div>
              <h2>Formulario</h2>
              <p>Campos renderizados desde metadata, sin reglas por catalogo.</p>
            </div>
          </div>
          <DynamicForm
            catalog={resolvedCatalog}
            onSubmit={(values: RuntimeFormValues) =>
              setLastAction(`Formulario valido con ${Object.keys(values).length} campos.`)
            }
          />
        </aside>
      </section>
    </div>
  );
}
