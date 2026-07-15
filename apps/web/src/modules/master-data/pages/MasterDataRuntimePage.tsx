import { useMemo, useState } from "react";

import { Alert, Badge, ErrorState, LoadingState, PageHeader, Button } from "../../../components/ui/index.js";
import { DynamicForm } from "../../runtime-ui/components/DynamicForm.js";
import { DynamicGrid } from "../../runtime-ui/components/DynamicGrid.js";
import { RuntimeActions } from "../../runtime-ui/components/RuntimeActions.js";
import { useCatalogMetadata } from "../../runtime-ui/hooks/useCatalogMetadata.js";
import type { RuntimeFormValues } from "../../runtime-ui/utils/validationRuntime.js";
import type { CatalogRecord } from "../../runtime-ui/types/runtime-ui.types.js";
import { getCatalogLabel } from "../utils/catalogLabels.js";
import { saveCatalogItem } from "../../runtime-ui/services/metadataClient.js";

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
  const [selectedRecord, setSelectedRecord] = useState<CatalogRecord | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const title = useMemo(
    () => metadata.data?.catalog.displayName ?? getCatalogLabel(resolvedCatalog),
    [metadata.data, resolvedCatalog]
  );
  const readOnly = metadata.data?.catalog.readOnly ?? false;

  const isModernizedCatalog = [
    "suppliers",
    "customers",
    "categories",
    "brands",
    "warehouses",
    "currencies",
    "units-of-measure",
    "payment-terms",
    "tax-categories",
    "inventory-stocks",
    "inventory-movements",
    "inventory-ledger",
    "item-availability",
    "inventory-reservations"
  ].includes(resolvedCatalog);

  const CATALOG_PRESENTATIONS: Record<string, {
    title: string;
    description: string;
    eyebrow: string;
    gridTitle: string;
    gridDesc: string;
    formTitleNew: string;
    formTitleEdit: string;
    formDesc: string;
  }> = {
    suppliers: {
      title: "Catálogo de Proveedores",
      description: "Gestione el maestro de proveedores, contactos, condiciones de pago y configuración fiscal.",
      eyebrow: "Proveedores",
      gridTitle: "Lista de Proveedores",
      gridDesc: "Consulta, búsqueda y exportación de proveedores registrados. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha del Proveedor (Nuevo)",
      formTitleEdit: "Ficha del Proveedor (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de datos fiscales, comerciales y de contacto."
    },
    customers: {
      title: "Catálogo de Clientes",
      description: "Gestione la cartera de clientes, límites de crédito, plazos de pago y configuraciones comerciales.",
      eyebrow: "Clientes",
      gridTitle: "Lista de Clientes",
      gridDesc: "Consulta, búsqueda y exportación de clientes registrados. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha del Cliente (Nuevo)",
      formTitleEdit: "Ficha del Cliente (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de datos de crédito, facturación y contacto."
    },
    categories: {
      title: "Catálogo de Categorías",
      description: "Organiza tus artículos mediante categorías para facilitar su clasificación y consulta.",
      eyebrow: "Categorías",
      gridTitle: "Lista de Categorías",
      gridDesc: "Consulta, búsqueda y exportación de categorías registradas. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha de la Categoría (Nuevo)",
      formTitleEdit: "Ficha de la Categoría (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de categorías de artículos."
    },
    brands: {
      title: "Catálogo de Marcas",
      description: "Administra las marcas utilizadas para identificar y clasificar tus productos.",
      eyebrow: "Marcas",
      gridTitle: "Lista de Marcas",
      gridDesc: "Consulta, búsqueda y exportación de marcas registradas. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha de la Marca (Nuevo)",
      formTitleEdit: "Ficha de la Marca (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de marcas de productos."
    },
    warehouses: {
      title: "Catálogo de Almacenes",
      description: "Administra los almacenes y ubicaciones utilizadas para controlar las existencias.",
      eyebrow: "Almacenes",
      gridTitle: "Lista de Almacenes",
      gridDesc: "Consulta, búsqueda y exportación de almacenes registrados. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha del Almacén (Nuevo)",
      formTitleEdit: "Ficha del Almacén (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de almacenes, ubicaciones y configuración operativa."
    },
    currencies: {
      title: "Catálogo de Monedas",
      description: "Administra las monedas disponibles para las operaciones comerciales y financieras.",
      eyebrow: "Monedas",
      gridTitle: "Lista de Monedas",
      gridDesc: "Consulta, búsqueda y exportación de monedas registradas. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha de la Moneda (Nuevo)",
      formTitleEdit: "Ficha de la Moneda (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de monedas activas."
    },
    "units-of-measure": {
      title: "Unidades de medida",
      description: "Administra las unidades utilizadas para expresar cantidades, existencias y movimientos de artículos.",
      eyebrow: "Unidades de medida",
      gridTitle: "Lista de unidades de medida",
      gridDesc: "Consulta, búsqueda y exportación de unidades registradas. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha de la unidad de medida (Nuevo)",
      formTitleEdit: "Ficha de la unidad de medida (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de unidades de medida."
    },
    "payment-terms": {
      title: "Condiciones de pago",
      description: "Administra los plazos y condiciones utilizados en operaciones con clientes y proveedores.",
      eyebrow: "Condiciones de pago",
      gridTitle: "Lista de condiciones de pago",
      gridDesc: "Consulta, búsqueda y exportación de condiciones de pago registradas. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha de la condición de pago (Nuevo)",
      formTitleEdit: "Ficha de la condición de pago (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de condiciones comerciales."
    },
    "tax-categories": {
      title: "Categorías fiscales",
      description: "Administra las clasificaciones tributarias utilizadas en artículos, clientes y proveedores.",
      eyebrow: "Categorías fiscales",
      gridTitle: "Lista de categorías fiscales",
      gridDesc: "Consulta, búsqueda y exportación de categorías fiscales registradas. Haga clic en una fila para editarla.",
      formTitleNew: "Ficha de la categoría fiscal (Nuevo)",
      formTitleEdit: "Ficha de la categoría fiscal (Editar)",
      formDesc: "Formulario estructurado para alta, edición y revisión de tasas y categorías fiscales."
    },
    "inventory-stocks": {
      title: "Existencias por almacén",
      description: "Consulta las cantidades físicas y disponibles de cada artículo por almacén.",
      eyebrow: "Existencias",
      gridTitle: "Detalle de existencias",
      gridDesc: "Consulta de las existencias actuales de artículos por almacén. Esta vista es de solo lectura.",
      formTitleNew: "",
      formTitleEdit: "",
      formDesc: ""
    },
    "inventory-movements": {
      title: "Movimientos de inventario",
      description: "Consulta las entradas, salidas y ajustes registrados en el inventario.",
      eyebrow: "Movimientos",
      gridTitle: "Historial de movimientos",
      gridDesc: "Consulta histórica de los movimientos y transacciones de inventario registradas en el sistema.",
      formTitleNew: "",
      formTitleEdit: "",
      formDesc: ""
    },
    "inventory-ledger": {
      title: "Kardex de inventario",
      description: "Consulta cronológicamente las entradas, salidas y balances de cada artículo.",
      eyebrow: "Kardex",
      gridTitle: "Movimientos del kardex",
      gridDesc: "Visualización cronológica de las transacciones y saldo acumulado por artículo y almacén.",
      formTitleNew: "",
      formTitleEdit: "",
      formDesc: ""
    },
    "item-availability": {
      title: "Disponibilidad de artículos",
      description: "Consulta la existencia física, las reservas y la cantidad disponible de cada artículo.",
      eyebrow: "Disponibilidad",
      gridTitle: "Detalle de disponibilidad",
      gridDesc: "Análisis en tiempo real de existencias físicas, reservas y cantidades disponibles para transacciones.",
      formTitleNew: "",
      formTitleEdit: "",
      formDesc: ""
    },
    "inventory-reservations": {
      title: "Reservas de inventario",
      description: "Consulta las cantidades reservadas de artículos asociadas a documentos y operaciones pendientes.",
      eyebrow: "Reservas",
      gridTitle: "Detalle de reservas",
      gridDesc: "Consulta y seguimiento de reservas activas asociadas a pedidos de clientes u órdenes en proceso.",
      formTitleNew: "",
      formTitleEdit: "",
      formDesc: ""
    }
  };

  const customizedHeader = useMemo(() => {
    const config = CATALOG_PRESENTATIONS[resolvedCatalog];
    if (config) {
      return config;
    }
    return {
      title: title,
      description: "Pantalla generica por metadata para catalogos tecnicos. Si la API no esta disponible, la vista local permite probar el formulario.",
      eyebrow: "Datos Maestros",
      gridTitle: "Registros",
      gridDesc: "Grid dinamico preparado para busqueda, filtros y paginacion. Haga clic en una fila para editarla.",
      formTitleNew: "Nuevo Registro",
      formTitleEdit: "Editar Registro",
      formDesc: "Ingrese los detalles a continuación."
    };
  }, [resolvedCatalog, title]);

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

  if (!metadata.loading && !metadata.data && !metadata.usingFallback) {
    return (
      <div className="master-data-runtime-page" style={{ padding: "40px 24px" }}>
        <div style={{ maxWidth: "600px", margin: "80px auto", display: "flex", flexDirection: "column", gap: "24px" }}>
          <ErrorState 
            title="Catálogo no disponible" 
            message="La configuración y metadatos del catálogo solicitado no están registrados en el sistema." 
          />
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button
              type="button"
              onClick={() => {
                window.history.pushState({}, "", "/dashboard");
                window.dispatchEvent(new PopStateEvent("popstate"));
              }}
            >
              Volver al Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
        description={customizedHeader.description}
        eyebrow={customizedHeader.eyebrow}
        title={customizedHeader.title}
      />

      {!isModernizedCatalog && (
        <Alert title="Catalogo tecnico">
          Esta pagina usa el motor runtime existente y no implementa pantallas especificas por catalogo.
        </Alert>
      )}
      {readOnly ? (
        <Alert tone="info" title="Solo consulta">
          Esta vista muestra existencias actuales y no permite ajustes manuales de inventario.
        </Alert>
      ) : null}

      {metadata.loading ? <LoadingState label="Cargando metadata del catalogo..." /> : null}
      {metadata.usingFallback ? (
        <Alert tone="warning" title="Vista local activa">
          {isModernizedCatalog
            ? "El backend no está conectado o requiere inicio de sesión. Los cambios se guardarán temporalmente de forma local."
            : "La API no esta disponible o requiere sesion. Puedes revisar y probar el formulario con metadata local; conecta el backend para consultar y guardar registros reales."}
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
              <h2>{customizedHeader.gridTitle}</h2>
              <p>{customizedHeader.gridDesc}</p>
            </div>
          </div>
          <DynamicGrid 
            catalog={resolvedCatalog} 
            refreshTrigger={refreshTrigger}
            onRowClick={(record) => {
              if (!readOnly) {
                setSelectedRecord(record);
                setLastAction(null);
              }
            }}
            selectedRecordId={selectedRecord?.id}
          />
        </div>
        {!readOnly ? (
          <aside className="runtime-panel">
            <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2>{selectedRecord ? customizedHeader.formTitleEdit : customizedHeader.formTitleNew}</h2>
                <p>{customizedHeader.formDesc}</p>
              </div>
              {selectedRecord && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setSelectedRecord(null);
                    setLastAction(null);
                  }}
                >
                  Limpiar / Nuevo
                </Button>
              )}
            </div>
            <DynamicForm
              key={`${resolvedCatalog}-${selectedRecord?.id || "new"}`}
              catalog={resolvedCatalog}
              initialValues={selectedRecord || undefined}
              onSubmit={async (values: RuntimeFormValues) => {
                try {
                  const recordToSave = { ...selectedRecord, ...values };
                  await saveCatalogItem(resolvedCatalog, recordToSave);
                  setLastAction(selectedRecord ? "Registro actualizado con éxito localmente." : "Nuevo registro creado con éxito localmente.");
                  setSelectedRecord(null);
                  setRefreshTrigger(prev => prev + 1);
                } catch (err: unknown) {
                  setLastAction(`Error al guardar: ${err instanceof Error ? err.message : String(err)}`);
                }
              }}
            />
          </aside>
        ) : null}
      </section>
    </div>
  );
}
