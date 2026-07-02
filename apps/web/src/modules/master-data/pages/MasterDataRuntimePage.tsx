import { useMemo, useState } from "react";

import { Alert, Badge, ErrorState, LoadingState, PageHeader } from "../../../components/ui/index.js";
import { DynamicForm } from "../../runtime-ui/components/DynamicForm.js";
import { DynamicGrid } from "../../runtime-ui/components/DynamicGrid.js";
import { RuntimeActions } from "../../runtime-ui/components/RuntimeActions.js";
import { useCatalogMetadata } from "../../runtime-ui/hooks/useCatalogMetadata.js";
import type { RuntimeFormValues } from "../../runtime-ui/utils/validationRuntime.js";
import { getCatalogLabel } from "../utils/catalogLabels.js";

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
    () => metadata.data?.catalog.displayName ?? getCatalogLabel(resolvedCatalog),
    [metadata.data, resolvedCatalog]
  );
  const apiBadge = useMemo(() => {
    if (metadata.data) {
      return <Badge tone="green">API conectada</Badge>;
    }

    if (metadata.errorKind === "unauthorized" || metadata.errorKind === "forbidden") {
      return <Badge tone="amber">Requiere sesión</Badge>;
    }

    if (metadata.errorKind === "network") {
      return <Badge tone="red">API no disponible</Badge>;
    }

    if (metadata.error) {
      return <Badge tone="blue">Vista local</Badge>;
    }

    return <Badge tone="amber">Vista local</Badge>;
  }, [metadata.data, metadata.error, metadata.errorKind]);

  return (
    <div className="master-data-runtime-page">
      <PageHeader
        actions={
          <div className="runtime-page-actions">
            {apiBadge}
            {metadata.error ? <Badge tone="blue">Vista local</Badge> : null}
            {metadata.data ? (
            <RuntimeActions
              actions={metadata.data.actions}
              onAction={(action) => setLastAction(`${action} preparado por metadata.`)}
            />
            ) : null}
          </div>
        }
        description="Pantalla genérica por metadata para catálogos técnicos. Si la API requiere autenticación, la vista muestra el estado controlado."
        eyebrow="Datos Maestros"
        title={title}
      />

      <Alert title="Catálogo técnico">
        Esta página usa el motor runtime existente y no implementa pantallas específicas por catálogo.
      </Alert>

      {metadata.loading ? <LoadingState label="Cargando metadata del catálogo..." /> : null}
      {metadata.error ? <ErrorState message={metadata.error} title="No se pudo cargar metadata" /> : null}
      {lastAction ? <Alert tone="success">{lastAction}</Alert> : null}

      <section className="runtime-layout runtime-layout-two">
        <div className="runtime-panel">
          <div className="panel-heading">
            <div>
              <h2>Registros</h2>
              <p>Grid dinámico preparado para búsqueda, filtros y paginación.</p>
            </div>
          </div>
          <DynamicGrid catalog={resolvedCatalog} />
        </div>
        <aside className="runtime-panel">
          <div className="panel-heading">
            <div>
              <h2>Formulario</h2>
              <p>Campos renderizados desde metadata, sin reglas por catálogo.</p>
            </div>
          </div>
          <DynamicForm
            catalog={resolvedCatalog}
            onSubmit={(values: RuntimeFormValues) =>
              setLastAction(`Formulario válido con ${Object.keys(values).length} campos.`)
            }
          />
        </aside>
      </section>
    </div>
  );
}
