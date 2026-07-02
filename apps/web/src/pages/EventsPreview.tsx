import { Alert, Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, Table } from "../components/ui/index.js";

export function EventsPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        description="Vista inicial del Domain Event Engine. El backend ya registra y procesa eventos de forma controlada."
        eyebrow="Domain Events"
        title="Eventos"
      />
      <Alert tone="warning" title="Preview">
        No se ejecutan listeners reales, webhooks, jobs ni integraciones externas desde esta pantalla.
      </Alert>
      <Card>
        <h2>Flujo disponible</h2>
        <Table
          columns={["Paso", "Estado", "Descripcion"]}
          rows={[
            ["Publish", <Badge tone="blue">Disponible</Badge>, "Registra eventos internos como PENDING."],
            ["Processor", <Badge tone="green">Disponible</Badge>, "Bloquea y procesa batches pendientes."],
            ["Dispatcher", <Badge tone="amber">Simulado</Badge>, "Solo registra que subscriber habria recibido el evento."]
          ]}
        />
      </Card>
      <EmptyState title="Sin consola funcional" description="La administracion completa de eventos llegara en una fase posterior." />
      <Card>
        <h2>Estados de UX</h2>
        <div className="state-demo">
          <LoadingState label="Consultando eventos..." />
          <ErrorState title="Permisos requeridos" message="La vista muestra errores de autenticacion de forma controlada." />
          <EmptyState title="Sin eventos visibles" description="No hay eventos reales conectados en esta preview." />
        </div>
      </Card>
    </div>
  );
}
