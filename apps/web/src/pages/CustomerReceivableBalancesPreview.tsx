import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Table, FormField, FilterBar } from "../components/ui/index.js";
import {
  loadCustomerReceivableBalances,
  type BalancesResponse,
  type CustomerReceivableBalance
} from "../services/accountsReceivableClient.js";

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("es-DO") : "";
}

export function CustomerReceivableBalancesPreview() {
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<BalancesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");

    try {
      setSnapshot(await loadCustomerReceivableBalances({ search, pageSize: 100 }));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "API no disponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void refresh();
  }

  const rows = (snapshot?.records ?? []).map((record: CustomerReceivableBalance) => [
    <strong style={{ textAlign: "left", display: "block" }}>{record.customerCode}</strong>,
    <div style={{ textAlign: "left" }}>{record.customerName}</div>,
    <div style={{ textAlign: "right" }}>{money(record.totalDocumentAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.totalPaidAmount)}</div>,
    <div style={{ textAlign: "right", fontWeight: "600" }}>{money(record.totalOpenAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.overdueAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.notDueAmount)}</div>,
    <div style={{ textAlign: "right" }}>{record.openDocumentCount}</div>,
    <div style={{ textAlign: "right" }}>{record.overdueDocumentCount}</div>,
    <div style={{ textAlign: "center" }}>{shortDate(record.lastDocumentDate)}</div>,
    <div style={{ display: "flex", justifyContent: "center" }}>
      <a className="ui-button ui-button-ghost" href={`/accounts-receivable/documents?customerId=${record.customerId}`} key={record.customerId} style={{ padding: "4px 8px", fontSize: "0.85rem" }}>
        Detalle
      </a>
    </div>
  ]);

  if (loading && !snapshot) {
    return <LoadingState label="Cargando saldos por cliente..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Saldos por cobrar"
        description="Consulta los balances pendientes de tus clientes y documentos por cobrar."
        actions={
          <div className="runtime-page-actions">
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/documents">Documentos CxC</a>
          </div>
        }
      />

      {error && <ErrorState title="API no disponible" message={error} />}
      {!error && <Alert tone="success">Consulta conectada a la API y calculada desde documentos CxC.</Alert>}

      <Card>
        <form onSubmit={handleSubmit}>
          <FilterBar>
            <FormField label="Buscar cliente" style={{ flex: "1 1 300px" }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código o nombre del cliente..." />
            </FormField>
          </FilterBar>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <Button disabled={loading} type="submit" variant="primary">
              {loading ? "Consultando..." : "Consultar saldos"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="metric-grid" style={{ marginBottom: "24px" }}>
        <Card className="metric-card">
          <span>Total abierto</span>
          <strong>{money(snapshot?.summary.totalOpenAmount)}</strong>
          <small style={{ color: "var(--muted)" }}>Pendiente de cobro</small>
        </Card>
        <Card className="metric-card">
          <span>Total vencido</span>
          <strong style={{ color: "var(--red)" }}>{money(snapshot?.summary.overdueAmount)}</strong>
          <small style={{ color: "var(--muted)" }}>Cartera fuera de plazo</small>
        </Card>
        <Card className="metric-card">
          <span>Docs abiertos</span>
          <strong>{snapshot?.summary.openDocumentCount ?? 0}</strong>
          <small style={{ color: "var(--muted)" }}>Facturas pendientes</small>
        </Card>
        <Card className="metric-card">
          <span>Docs vencidos</span>
          <strong style={{ color: "var(--amber)" }}>{snapshot?.summary.overdueDocumentCount ?? 0}</strong>
          <small style={{ color: "var(--muted)" }}>Facturas vencidas</small>
        </Card>
      </div>

      <Card>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Consolidado de Saldos</h3>
        {rows.length ? (
          <Table
            columns={["Código", "Cliente", "Total", "Cobrado", "Abierto", "Vencido", "Por vencer", "Docs", "Vencidos", "Último", "Acciones"]}
            rows={rows}
          />
        ) : (
          <EmptyState title="Sin saldos CxC" description="No existen saldos pendientes para mostrar." />
        )}
      </Card>
    </div>
  );
}
