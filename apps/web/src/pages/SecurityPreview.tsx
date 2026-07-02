import { Alert, Badge, Card, EmptyState, ErrorState, LoadingState, PageHeader, Table } from "../components/ui/index.js";

export function SecurityPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        description="Vista placeholder de seguridad empresarial para validar navegación y layout."
        eyebrow="Seguridad"
        title="Seguridad"
      />
      <Alert tone="warning">No se implementa login nuevo ni administración final de roles en esta fase.</Alert>
      <Card>
        <h2>Áreas previstas</h2>
        <Table
          columns={["Área", "Estado"]}
          rows={[
            ["Usuarios", <Badge tone="blue">Backend base</Badge>],
            ["Roles", <Badge tone="blue">Backend base</Badge>],
            ["Permisos", <Badge tone="blue">Backend base</Badge>]
          ]}
        />
      </Card>
      <EmptyState title="Administración pendiente" description="La UI funcional de seguridad se implementará en una fase dedicada." />
      <Card>
        <h2>Estados de UX</h2>
        <div className="state-demo">
          <LoadingState label="Validando permisos..." />
          <ErrorState title="Acceso no disponible" message="La pantalla conserva el layout ante errores de permisos." />
          <EmptyState title="Sin usuarios visibles" description="No se listan usuarios reales en UX-001." />
        </div>
      </Card>
    </div>
  );
}
