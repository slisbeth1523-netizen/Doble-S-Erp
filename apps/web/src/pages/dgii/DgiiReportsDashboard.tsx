import { PageHeader, Card, Button, Badge } from "../../components/ui/index.js";
 
export function DgiiReportsDashboard() {
  return (
    <div className="page-stack" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <PageHeader
        title="Reportes Fiscales DGII"
        description="Generación de formatos 606, 607, 608 y 609 para el envío a la Dirección General de Impuestos Internos"
        actions={<Button variant="primary">Generar Nuevo Reporte</Button>}
      />
 
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
        
        {/* 606 Card */}
        <Card style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary-700)" }}>Formato 606</h3>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>Compras de Bienes y Servicios</p>
            </div>
            <Badge tone="blue">Mensual</Badge>
          </div>
          <div style={{ padding: "16px", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Último periodo:</span>
              <span style={{ fontWeight: 600 }}>2026-06</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Total ITBIS Retenido:</span>
              <span style={{ fontWeight: 600, color: "var(--color-red-600)" }}>RD$ 45,300.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Estado:</span>
              <Badge tone="green">Presentado</Badge>
            </div>
          </div>
          <Button variant="secondary" style={{ width: "100%", justifyContent: "center" }}>Exportar TXT a DGII</Button>
        </Card>
 
        {/* 607 Card */}
        <Card style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary-700)" }}>Formato 607</h3>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>Ventas y Operaciones</p>
            </div>
            <Badge tone="blue">Mensual</Badge>
          </div>
          <div style={{ padding: "16px", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Último periodo:</span>
              <span style={{ fontWeight: 600 }}>2026-06</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Total ITBIS Facturado:</span>
              <span style={{ fontWeight: 600, color: "var(--color-green-600)" }}>RD$ 125,890.00</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Estado:</span>
              <Badge tone="green">Presentado</Badge>
            </div>
          </div>
          <Button variant="secondary" style={{ width: "100%", justifyContent: "center" }}>Exportar TXT a DGII</Button>
        </Card>
 
        {/* 608 Card */}
        <Card style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-primary-700)" }}>Formato 608</h3>
              <p style={{ margin: "4px 0 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>Comprobantes Anulados</p>
            </div>
            <Badge tone="blue">Ocasional</Badge>
          </div>
          <div style={{ padding: "16px", background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Comprobantes Anulados:</span>
              <span style={{ fontWeight: 600 }}>12</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>Estado:</span>
              <Badge tone="amber">Pendiente</Badge>
            </div>
          </div>
          <div style={{ flex: 1 }}></div>
          <Button variant="secondary" style={{ width: "100%", justifyContent: "center" }}>Exportar TXT a DGII</Button>
        </Card>
 
      </div>
      
      {/* Historico de reportes */}
      <Card>
        <h3 style={{ margin: "0 0 16px 0", fontSize: "1.20rem", fontWeight: 700 }}>Historial de Envíos DGII</h3>
        
        <div className="ui-table-wrap">
          <table className="ui-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Reporte</th>
                <th>Fecha Generación</th>
                <th>Cant. Registros</th>
                <th>Total ITBIS</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 500 }}>2026-06</td>
                <td><Badge tone="blue">606</Badge></td>
                <td>05 Jul 2026</td>
                <td>450</td>
                <td>RD$ 45,300.00</td>
                <td><Badge tone="green">Presentado</Badge></td>
              </tr>
              <tr>
                <td style={{ fontWeight: 500 }}>2026-06</td>
                <td><Badge tone="blue">607</Badge></td>
                <td>05 Jul 2026</td>
                <td>1,200</td>
                <td>RD$ 125,890.00</td>
                <td><Badge tone="green">Presentado</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
