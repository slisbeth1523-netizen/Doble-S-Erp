import { useEffect, useState } from "react";

import { Alert, Badge, Card, LoadingState, PageHeader } from "../components/ui/index.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { loadAccountsPayableSnapshots } from "../services/supplierInvoicesClient.js";

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
    case "PENDING":
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
        title="Consulta de Documentos de CxP"
        description="Monitorea balances pendientes, montos pagados y vencimientos de facturas de proveedores registradas."
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
            <strong>${formatNumber(totalBalance)}</strong>
            <small style={{ color: "var(--muted)" }}>Suma de saldos por pagar</small>
          </Card>
          <Card className="metric-card">
            <span>Documentos pendientes</span>
            <strong>{documents.filter((d) => d.status === "PENDING").length}</strong>
            <small style={{ color: "var(--muted)" }}>CxP sin abonos</small>
          </Card>
        </div>
      )}

      <div className="ui-card">
        <h2>Documentos Cuentas por Pagar (CxP)</h2>
        {documents.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", margin: "40px 0" }}>
            No hay documentos pendientes de Cuentas por Pagar. Registra y aprueba facturas de proveedores para generar su saldo aquí.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Documento CxP</th>
                  <th>Proveedor</th>
                  <th>Factura Origen</th>
                  <th>Fecha Doc.</th>
                  <th>Vencimiento</th>
                  <th>Monto Total</th>
                  <th>Pagado</th>
                  <th>Balance</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={String(doc.id)}>
                    <td><strong>{String(doc.code)}</strong></td>
                    <td>{String(doc.name)}</td>
                    <td>{String(doc.sourceDocumentNumber)}</td>
                    <td>{doc.documentDate ? new Date(doc.documentDate as string).toLocaleDateString() : ""}</td>
                    <td>{doc.dueDate ? new Date(doc.dueDate as string).toLocaleDateString() : ""}</td>
                    <td>${formatNumber(doc.totalAmount)}</td>
                    <td>${formatNumber(doc.paidAmount)}</td>
                    <td><strong>${formatNumber(doc.remainingAmount)}</strong></td>
                    <td>
                      <Badge tone={statusTone(doc.status as string)}>{String(doc.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
