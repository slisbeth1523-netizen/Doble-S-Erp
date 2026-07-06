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

const actionLabels: Record<string, string> = {
  create: "crear",
  update: "actualizar",
  activate: "activar",
  deactivate: "desactivar",
  lookup: "consultar",
  export: "exportar",
  import: "importar"
};

export function MasterDataRuntimePage({ catalog }: MasterDataRuntimePageProps) {
  const resolvedCatalog = catalog ?? catalogFromLocation() ?? "currencies";
  const metadata = useCatalogMetadata(resolvedCatalog);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const title = useMemo(
    () => metadata.data?.catalog.displayName ?? getCatalogLabel(resolvedCatalog),
    [metadata.data, resolvedCatalog]
  );
  const readOnly = metadata.data?.catalog.readOnly ?? false;
  const apiBadge = useMemo(() => {
    if (metadata.errorKind === "unauthorized" || metadata.errorKind === "forbidden") {
      return <Badge tone="amber">Requiere sesion</Badge>;
    }

    if (metadata.errorKind === "network") {
      return <Badge tone="red">API no disponible</Badge>;
    }

    if (metadata.data && !metadata.usingFallback) {
      return <Badge tone="green">API conectada</Badge>;
    }

    return <Badge tone="amber">Vista local</Badge>;
  }, [metadata.data, metadata.errorKind, metadata.usingFallback]);

  return (
    <div className="master-data-runtime-page">
      <PageHeader
        actions={
          <div className="runtime-page-actions">
            {apiBadge}
            {metadata.usingFallback ? <Badge tone="blue">Vista local</Badge> : null}
            {metadata.data ? (
              <RuntimeActions
                actions={metadata.data.actions}
                onAction={(action) =>
                  setLastAction(`Accion ${actionLabels[action] ?? action} preparada por metadata.`)
                }
              />
            ) : null}
          </div>
        }
        description="Pantalla generica por metadata para catalogos tecnicos. Si la API no esta disponible, la vista local permite probar el formulario."
        eyebrow="Datos Maestros"
        title={title}
      />

      <Alert title="Catalogo tecnico">
        Esta pagina usa el motor runtime existente y no implementa pantallas especificas por catalogo.
      </Alert>
      {readOnly ? (
        <Alert tone="info" title="Solo consulta">
          Esta vista muestra existencias actuales y no permite ajustes manuales de inventario.
        </Alert>
      ) : null}

      {metadata.loading ? <LoadingState label="Cargando metadata del catalogo..." /> : null}
      {metadata.usingFallback ? (
        <Alert tone="warning" title="Vista local activa">
          La API no esta disponible o requiere sesion. Puedes revisar y probar el formulario con metadata local;
          conecta el backend para consultar y guardar registros reales.
        </Alert>
      ) : null}
      {metadata.error && !metadata.usingFallback ? (
        <ErrorState message={metadata.error} title="No se pudo cargar metadata" />
      ) : null}
      {lastAction ? <Alert tone="success">{lastAction}</Alert> : null}

      <section className={readOnly ? "runtime-layout" : "runtime-layout runtime-layout-two"}>
        <div className="runtime-panel">
          <div className="panel-heading">
            <div>
              <h2>Registros</h2>
              <p>Grid dinamico preparado para busqueda, filtros y paginacion.</p>
            </div>
          </div>
          <DynamicGrid catalog={resolvedCatalog} />
        </div>
        {!readOnly ? (
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
        ) : null}
      </section>
    </div>
  );
}
