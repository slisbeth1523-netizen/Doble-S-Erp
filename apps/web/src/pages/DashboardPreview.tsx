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
import { apiConfigurationMessage, apiUrl } from "../services/apiClient.js";

const metrics = [
  { label: "Empresas", value: "Vista previa", tone: "blue" as const },
  { label: "Usuarios", value: "Vista previa", tone: "green" as const },
  { label: "Workflows", value: "Backend listo", tone: "amber" as const },
  { label: "Eventos pendientes", value: "Motor base", tone: "blue" as const },
  { label: "Catálogos técnicos", value: "Runtime", tone: "green" as const }
];

export function DashboardPreview() {
  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button type="button">Vista local</Button>}
        description="Panel navegable para validar layout, componentes y motores base sin activar módulos comerciales."
        eyebrow="Vista de desarrollo"
        title="Dashboard"
      />

      <Alert title="Datos de vista previa">Las tarjetas muestran estado visual; no son métricas reales.</Alert>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <Card className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <Badge tone={metric.tone}>Vista previa</Badge>
          </Card>
        ))}
      </section>

      <section className="content-grid">
        <Card>
          <h2>Estado de la plataforma</h2>
          <Table
            columns={["Área", "Estado", "Nota"]}
            rows={[
              ["API", <Badge tone="green">Compila</Badge>, apiUrl],
              ["Configuración API", <Badge tone="blue">Local</Badge>, apiConfigurationMessage],
              ["Runtime UI", <Badge tone="blue">Preparado</Badge>, "Catálogos por metadata"],
              ["Eventos", <Badge tone="amber">Base</Badge>, "Processor simulado"],
              ["Workflows", <Badge tone="amber">Base</Badge>, "Definición y ejecución inicial"]
            ]}
          />
        </Card>
        <Card>
          <h2>Estados reutilizables</h2>
          <div className="state-demo">
            <LoadingState label="Preparando vista..." />
            <EmptyState title="Sin tareas reales" description="Los módulos comerciales siguen fuera de alcance." />
            <ErrorState title="Error controlado" message="Los errores de datos se muestran sin romper la pantalla." />
            <Toast tone="success">Design system cargado para vista previa.</Toast>
          </div>
        </Card>
      </section>
    </div>
  );
}
