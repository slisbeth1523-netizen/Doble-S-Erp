import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Table } from "../components/ui/index.js";
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
    record.customerCode,
    record.customerName,
    money(record.currentAmount),
    money(record.days1To30Amount),
    money(record.days31To60Amount),
    money(record.days61To90Amount),
    money(record.daysOver90Amount),
    money(record.totalOpenAmount),
    money(record.overdueAmount),
    record.openDocumentCount,
    <a className="ui-button ui-button-ghost" href={`/accounts-receivable/statements?customerId=${record.customerId}`} key={record.customerId}>
      Ver detalle
    </a>
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
        title="Antiguedad"
        description="Resumen read-only de saldos abiertos por cliente y bucket de vencimiento."
        actions={
          <>
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/statements">Estado de cuenta</a>
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/receipts">Recibos</a>
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/customer-credit-notes">Notas de credito</a>
          </>
        }
      />

      <Card>
        <form className="settings-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label>
              Fecha de corte
              <Input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </label>
            <label>
              Buscar cliente
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo o nombre" />
            </label>
          </div>
          <Button disabled={loading} type="submit">
            Consultar
          </Button>
        </form>
      </Card>

      {error && <ErrorState title="API no disponible" message={error} />}
      {loading && <LoadingState label="Cargando antiguedad..." />}

      {!loading && !error && snapshot && (
        <>
          <div className="metric-grid">
            <Card><strong>{money(snapshot.summary.totalOpenAmount)}</strong><span>Total abierto</span></Card>
            <Card><strong>{money(snapshot.summary.overdueAmount)}</strong><span>Total vencido</span></Card>
            <Card><strong>{money(snapshot.summary.notDueAmount)}</strong><span>Por vencer</span></Card>
            <Card><strong>{snapshot.summary.openDocumentCount}</strong><span>Docs abiertos</span></Card>
          </div>

          <Alert tone={Math.abs(bucketTotal - snapshot.summary.totalOpenAmount) < 0.01 ? "success" : "warning"}>
            Buckets: {money(bucketTotal)} / Total abierto: {money(snapshot.summary.totalOpenAmount)}.
          </Alert>

          {rows.length ? (
            <Table
              columns={["Codigo", "Cliente", "CURRENT", "1-30", "31-60", "61-90", "90+", "Total", "Vencido", "Docs", "Detalle"]}
              rows={rows}
            />
          ) : (
            <EmptyState title="Sin saldos abiertos" description="No hay clientes con saldo abierto para la fecha de corte." />
          )}
        </>
      )}
    </div>
  );
}
