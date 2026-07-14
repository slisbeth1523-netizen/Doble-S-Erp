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
  { label: "Empresas", value: "Vista Previa", tone: "blue" as const },
  { label: "Usuarios", value: "Vista Previa", tone: "green" as const },
  { label: "Workflows", value: "Backend Listo", tone: "amber" as const },
  { label: "Eventos Pendientes", value: "Motor Base", tone: "blue" as const },
  { label: "Catálogos Técnicos", value: "Runtime", tone: "green" as const }
];

export function DashboardPreview({ onNavigate }: { onNavigate: (path: string) => void }) {
  const currentHour = new Date().getHours();
  let greetingMsg = "¡Hola de nuevo! 👋";
  if (currentHour < 12) {
    greetingMsg = "¡Buenos días! 👋";
  } else if (currentHour < 18) {
    greetingMsg = "¡Buenas tardes! 👋";
  } else {
    greetingMsg = "¡Buenas noches! 👋";
  }

  return (
    <div className="page-stack">
      <PageHeader
        actions={<Button type="button" onClick={() => onNavigate("/settings")}>Configuración</Button>}
        description="Panel navegable para validar layout, componentes y motores base sin activar módulos comerciales."
        eyebrow="Vista de desarrollo"
        title="Dashboard"
      />

      <div className="dashboard-greeting" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "24px", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "8px" }}>
        <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 800 }}>{greetingMsg}</h2>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>Aquí tienes un resumen del estado de Doble S ERP para hoy.</p>
        <div style={{ display: "flex", gap: "12px", marginTop: "4px", fontSize: "0.85rem", color: "var(--muted)" }}>
          <span><strong>Fecha:</strong> {new Date().toLocaleDateString("es-DO", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="dashboard-actions" style={{ marginBottom: "16px", marginTop: "8px" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "12px" }}>Accesos Rápidos Directos</h3>
        <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <button onClick={() => onNavigate("/purchasing/supplier-invoices")} className="quick-action-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", textAlign: "left", color: "var(--text)", transition: "var(--transition)" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
              📄
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.9rem" }}>Nueva Factura de Proveedor</strong>
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Registrar factura de compra CxP</small>
            </div>
          </button>
          <button onClick={() => onNavigate("/accounts-payable/payments")} className="quick-action-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", textAlign: "left", color: "var(--text)", transition: "var(--transition)" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
              💳
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.9rem" }}>Registrar Pago a Proveedor</strong>
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Egresos a proveedores</small>
            </div>
          </button>
          <button onClick={() => onNavigate("/inventory/adjustments")} className="quick-action-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", textAlign: "left", color: "var(--text)", transition: "var(--transition)" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
              📦
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.9rem" }}>Ajustar Inventario</strong>
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Entradas/salidas stock</small>
            </div>
          </button>
          <button onClick={() => onNavigate("/dgii/electronic-invoices")} className="quick-action-card" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", textAlign: "left", color: "var(--text)", transition: "var(--transition)" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>
              ⚡
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "0.9rem" }}>Comprobantes e-CF</strong>
              <small style={{ color: "var(--muted)", fontSize: "0.75rem" }}>Facturación electrónica</small>
            </div>
          </button>
        </div>
      </div>

      <Alert tone="info" title="Datos de demostración">Las tarjetas y métricas corresponden a un entorno de demostración técnica para desarrollo.</Alert>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <Card className="metric-card" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
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
