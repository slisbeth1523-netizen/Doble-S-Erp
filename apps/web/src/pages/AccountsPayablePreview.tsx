import { useEffect, useState } from "react";

import { Alert, Badge, Card, LoadingState, PageHeader } from "../components/ui/index.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { loadAccountsPayableSnapshots } from "../services/supplierInvoicesClient.js";
import { statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

function statusTone(status?: string) {
  switch (status) {
    case "PAID":
      return "green";
    case "PARTIALLY_PAID":
      return "blue";
    case "OPEN":
      return "amber";
    case "VOIDED":
      return "red";
    default:
      return "neutral";
  }
}

export function AccountsPayablePreview() {
  const [documents, setDocuments] = useState<CatalogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData() {
    try {
      const list = await loadAccountsPayableSnapshots();
      setDocuments(list);
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al cargar cuentas por pagar."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalBalance = documents.reduce((sum, doc) => sum + Number(doc.remainingAmount ?? 0), 0);

  if (loading) {
    return <LoadingState label="Cargando documentos de cuentas por pagar..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por pagar"
        title="Documentos de cuentas por pagar"
        description="Consulta las facturas, notas y documentos pendientes asociados a tus proveedores."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      {documents.length > 0 && (
        <div className="metric-grid">
          <Card className="metric-card">
            <span>Balance total pendiente</span>
            <strong>{formatNumber(totalBalance)}</strong>
            <small style={{ color: "var(--muted)" }}>Suma de saldos por pagar</small>
          </Card>
          <Card className="metric-card">
            <span>Documentos pendientes</span>
            <strong>{documents.filter((d) => d.status === "OPEN").length}</strong>
            <small style={{ color: "var(--muted)" }}>CxP sin abonos</small>
          </Card>
        </div>
      )}

      <Card>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Documentos de cuentas por pagar</h2>
        {documents.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ color: "var(--muted)", margin: 0 }}>
              No hay documentos de cuentas por pagar para mostrar.
            </p>
          </div>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Documento CxP</th>
                  <th style={{ textAlign: "left" }}>Proveedor</th>
                  <th style={{ textAlign: "left" }}>Factura Origen</th>
                  <th style={{ textAlign: "center" }}>Fecha Doc.</th>
                  <th style={{ textAlign: "center" }}>Vencimiento</th>
                  <th style={{ textAlign: "right" }}>Monto Total</th>
                  <th style={{ textAlign: "right" }}>Pagado</th>
                  <th style={{ textAlign: "right" }}>Balance</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={String(doc.id)}>
                    <td style={{ textAlign: "left" }}><strong>{String(doc.code)}</strong></td>
                    <td style={{ textAlign: "left" }}>{String(doc.name)}</td>
                    <td style={{ textAlign: "left" }}>{String(doc.sourceDocumentNumber)}</td>
                    <td style={{ textAlign: "center" }}>{doc.documentDate ? new Date(doc.documentDate as string).toLocaleDateString("es-DO") : ""}</td>
                    <td style={{ textAlign: "center" }}>{doc.dueDate ? new Date(doc.dueDate as string).toLocaleDateString("es-DO") : ""}</td>
                    <td style={{ textAlign: "right" }}>{formatNumber(doc.totalAmount)}</td>
                    <td style={{ textAlign: "right" }}>{formatNumber(doc.paidAmount)}</td>
                    <td style={{ textAlign: "right" }}><strong>{formatNumber(doc.remainingAmount)}</strong></td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", justifyContent: "center", width: "100%" }}>
                        <Badge tone={statusTone(doc.status as string)}>{statusLabel(doc.status)}</Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
