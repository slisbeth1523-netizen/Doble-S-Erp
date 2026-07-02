import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Table,
  Toast
} from "../components/ui/index.js";
import { apiUrl } from "../services/apiClient.js";

const metrics = [
  { label: "Empresas", value: "Preview", tone: "blue" as const },
  { label: "Usuarios", value: "Preview", tone: "green" as const },
  { label: "Workflows", value: "Backend listo", tone: "amber" as const },
  { label: "Eventos pendientes", value: "Motor base", tone: "blue" as const },
  { label: "Catalogos tecnicos", value: "Runtime", tone: "green" as const }
];

export function DashboardPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button type="button">Vista local</Button>}
        description="Panel navegable para validar layout, componentes y motores base sin activar modulos comerciales."
        eyebrow="Developer Preview"
        title="Dashboard"
      />

      <Alert title="Datos de preview">Las tarjetas muestran estado visual; no son metricas reales.</Alert>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <Card className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <Badge tone={metric.tone}>Preview</Badge>
          </Card>
        ))}
      </section>

      <section className="content-grid">
        <Card>
          <h2>Estado de la plataforma</h2>
          <Table
            columns={["Area", "Estado", "Nota"]}
            rows={[
              ["API", <Badge tone="green">Compila</Badge>, apiUrl],
              ["Runtime UI", <Badge tone="blue">Preparado</Badge>, "Catalogos por metadata"],
              ["Eventos", <Badge tone="amber">Base</Badge>, "Processor simulado"],
              ["Workflows", <Badge tone="amber">Base</Badge>, "Definicion y ejecucion inicial"]
            ]}
          />
        </Card>
        <Card>
          <h2>Estados reutilizables</h2>
          <div className="state-demo">
            <LoadingState label="Preparando vista..." />
            <EmptyState title="Sin tareas reales" description="Los modulos comerciales siguen fuera de alcance." />
            <ErrorState title="Error controlado" message="Los errores de datos se muestran sin romper la pantalla." />
            <Toast tone="success">Design system cargado para preview.</Toast>
          </div>
        </Card>
      </section>
    </div>
  );
}
