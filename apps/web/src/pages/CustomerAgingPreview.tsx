import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Table, FormField, FilterBar } from "../components/ui/index.js";
import { loadCustomerAging, type CustomerAgingResponse, type CustomerAgingSummary } from "../services/customerStatementsClient.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CustomerAgingPreview() {
  const [asOfDate, setAsOfDate] = useState(today());
  const [search, setSearch] = useState("");
  const [snapshot, setSnapshot] = useState<CustomerAgingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await loadCustomerAging({ asOfDate, search, pageSize: 100 });
      setSnapshot(data);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "API no disponible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void load();
  }

  const rows = (snapshot?.records ?? []).map((record: CustomerAgingSummary) => [
    <strong style={{ textAlign: "left", display: "block" }}>{record.customerCode}</strong>,
    <div style={{ textAlign: "left" }}>{record.customerName}</div>,
    <div style={{ textAlign: "right" }}>{money(record.currentAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.days1To30Amount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.days31To60Amount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.days61To90Amount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.daysOver90Amount)}</div>,
    <div style={{ textAlign: "right", fontWeight: "600" }}>{money(record.totalOpenAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.overdueAmount)}</div>,
    <div style={{ textAlign: "right" }}>{record.openDocumentCount}</div>,
    <div style={{ display: "flex", justifyContent: "center" }}>
      <a className="ui-button ui-button-ghost" href={`/accounts-receivable/statements?customerId=${record.customerId}`} key={record.customerId} style={{ padding: "4px 8px", fontSize: "0.85rem" }}>
        Ver detalle
      </a>
    </div>
  ]);

  const bucketTotal = snapshot
    ? snapshot.summary.currentAmount +
      snapshot.summary.days1To30Amount +
      snapshot.summary.days31To60Amount +
      snapshot.summary.days61To90Amount +
      snapshot.summary.daysOver90Amount
    : 0;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Antigüedad de saldos de clientes"
        description="Analiza los balances pendientes según su fecha de vencimiento."
        actions={
          <div className="runtime-page-actions">
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/statements">Estado de cuenta</a>
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/receipts">Recibos</a>
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/customer-credit-notes">Notas de crédito</a>
          </div>
        }
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <FilterBar>
            <FormField label="Fecha de corte" style={{ flex: "1 1 200px" }}>
              <Input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </FormField>
            <FormField label="Buscar cliente" style={{ flex: "1 1 300px" }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código o nombre..." />
            </FormField>
          </FilterBar>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
            <Button disabled={loading} type="submit" variant="primary">
              {loading ? "Consultando..." : "Consultar antigüedad"}
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorState title="API no disponible" message={error} />}
      {loading && <LoadingState label="Cargando antigüedad de saldos..." />}

      {!loading && !error && snapshot && (
        <>
          <div className="metric-grid" style={{ marginBottom: "24px" }}>
            <Card className="metric-card">
              <span>Total abierto</span>
              <strong>{money(snapshot.summary.totalOpenAmount)}</strong>
              <small style={{ color: "var(--muted)" }}>Saldo pendiente total</small>
            </Card>
            <Card className="metric-card">
              <span>Total vencido</span>
              <strong style={{ color: "var(--red)" }}>{money(snapshot.summary.overdueAmount)}</strong>
              <small style={{ color: "var(--muted)" }}>Cartera fuera de fecha</small>
            </Card>
            <Card className="metric-card">
              <span>Por vencer</span>
              <strong style={{ color: "var(--green)" }}>{money(snapshot.summary.notDueAmount)}</strong>
              <small style={{ color: "var(--muted)" }}>Saldos al corriente</small>
            </Card>
            <Card className="metric-card">
              <span>Docs abiertos</span>
              <strong>{snapshot.summary.openDocumentCount}</strong>
              <small style={{ color: "var(--muted)" }}>Documentos pendientes</small>
            </Card>
          </div>

          <Alert tone={Math.abs(bucketTotal - snapshot.summary.totalOpenAmount) < 0.01 ? "success" : "warning"}>
            Buckets: {money(bucketTotal)} / Total abierto: {money(snapshot.summary.totalOpenAmount)}.
          </Alert>

          <Card style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Resumen de Antigüedad por Cliente</h3>
            {rows.length ? (
              <Table
                columns={["Código", "Cliente", "Corriente", "1 a 30", "31 a 60", "61 a 90", "Más de 90", "Total", "Vencido", "Docs", "Acciones"]}
                rows={rows}
              />
            ) : (
              <EmptyState title="Sin saldos abiertos" description="No existen balances pendientes para la fecha de corte seleccionada." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
