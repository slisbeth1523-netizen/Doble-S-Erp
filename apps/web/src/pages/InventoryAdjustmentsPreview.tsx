import { Alert, Badge, Card, EmptyState, PageHeader, Table } from "../components/ui/index.js";

export function InventoryAdjustmentsPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        description="Entrada runtime para la fase INV-005. La creacion y posteo de ajustes se valida por API mientras se mantiene la consulta de movimientos en el runtime de master-data."
        eyebrow="Inventario"
        title="Ajustes"
      />
      <Alert tone="warning" title="Fase API">
        Crear ajustes se valida por API en esta fase. La consulta de movimientos sigue disponible en movimientos de inventario.
      </Alert>
      <Card>
        <h2>Flujo habilitado</h2>
        <Table
          columns={["Operacion", "Estado", "Ruta"]}
          rows={[
            ["Crear ajuste", <Badge tone="green">API</Badge>, "POST /api/inventory/adjustments"],
            ["Postear ajuste", <Badge tone="green">API</Badge>, "POST /api/inventory/movements/:id/post"],
            ["Consultar movimientos", <Badge tone="blue">Runtime</Badge>, "/master-data/inventory-movements"]
          ]}
        />
      </Card>
      <EmptyState
        title="Formulario manual pendiente"
        description="La pantalla transaccional completa llegara en una fase posterior; esta entrada deja visible el flujo sin habilitar edicion manual de existencias."
      />
    </div>
  );
}
