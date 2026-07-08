import { Alert, Badge, Card, EmptyState, PageHeader, Table } from "../components/ui/index.js";

export function InventoryPhysicalCountsPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        description="Entrada runtime para la fase INV-006. La creacion, conteo, cierre y generacion de ajuste se valida por API sin posteo automatico."
        eyebrow="Inventario"
        title="Conteos fisicos"
      />
      <Alert tone="warning" title="Fase API">
        El ajuste generado queda en borrador. El posteo se mantiene separado y usa el motor existente de movimientos.
      </Alert>
      <Card>
        <h2>Flujo habilitado</h2>
        <Table
          columns={["Operacion", "Estado", "Ruta"]}
          rows={[
            ["Crear conteo", <Badge tone="green">API</Badge>, "POST /api/inventory/physical-counts"],
            ["Registrar linea", <Badge tone="green">API</Badge>, "POST /api/inventory/physical-counts/:id/lines"],
            ["Completar conteo", <Badge tone="green">API</Badge>, "POST /api/inventory/physical-counts/:id/complete"],
            [
              "Generar ajuste",
              <Badge tone="green">API</Badge>,
              "POST /api/inventory/physical-counts/:id/create-adjustment"
            ],
            ["Consultar movimientos", <Badge tone="blue">Runtime</Badge>, "/master-data/inventory-movements"]
          ]}
        />
      </Card>
      <EmptyState
        title="Pantalla manual pendiente"
        description="La captura transaccional completa llegara en una fase posterior; esta entrada deja visible el flujo sin editar existencias directamente."
      />
    </div>
  );
}
