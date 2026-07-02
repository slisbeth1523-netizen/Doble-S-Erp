import { Alert, Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, Table } from "../components/ui/index.js";

export function WorkflowsPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        description="Vista previa del Workflow Engine: definiciones, estados, transiciones, historial, guards, conditions y actions base."
        eyebrow="Workflow Engine"
        title="Workflows"
      />
      <Alert title="Backend preparado">
        Esta vista no administra workflows completos; solo expone la estructura visual inicial.
      </Alert>
      <Card>
        <h2>Capacidades base</h2>
        <Table
          columns={["Componente", "Estado", "Alcance"]}
          rows={[
            ["Definitions", <Badge tone="green">Listo</Badge>, "Flujos principales"],
            ["Execution", <Badge tone="green">Listo</Badge>, "Transiciones válidas sobre entidades genéricas"],
            ["History", <Badge tone="green">Listo</Badge>, "Registro propio por entidad"],
            ["Actions", <Badge tone="amber">Preparado</Badge>, "Acciones placeholder controladas"]
          ]}
        />
      </Card>
      <EmptyState title="Sin diseñador visual" description="El diseñador de workflows queda fuera de UX-002." />
      <Card>
        <h2>Estados de UX</h2>
        <div className="state-demo">
          <LoadingState label="Cargando workflows..." />
          <ErrorState title="Workflow no disponible" message="Los fallos se presentan como estado visual controlado." />
          <EmptyState title="Sin definiciones visibles" description="No se administran definiciones reales desde esta vista previa." />
        </div>
      </Card>
    </div>
  );
}
