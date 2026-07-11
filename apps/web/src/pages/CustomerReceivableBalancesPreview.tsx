import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Table } from "../components/ui/index.js";
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
    record.customerCode,
    record.customerName,
    money(record.totalDocumentAmount),
    money(record.totalPaidAmount),
    money(record.totalOpenAmount),
    money(record.overdueAmount),
    money(record.notDueAmount),
    record.openDocumentCount,
    record.overdueDocumentCount,
    shortDate(record.lastDocumentDate),
    <a className="ui-button ui-button-ghost" href={`/accounts-receivable/documents?customerId=${record.customerId}`} key={record.customerId}>Detalle</a>
  ]);

  if (loading && !snapshot) {
    return <LoadingState label="Cargando saldos por cliente..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Saldos por cliente"
        description="Resumen consolidado read-only de saldos abiertos y vencidos por cliente."
        actions={<a className="ui-button ui-button-secondary" href="/accounts-receivable/documents">Documentos</a>}
      />

      {error && <ErrorState title="API no disponible" message={error} />}
      {!error && <Alert tone="success">Consulta conectada a API y calculada desde documentos CxC.</Alert>}

      <Card>
        <form className="settings-form" onSubmit={handleSubmit}>
          <label>
            Buscar cliente
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Codigo o nombre" />
          </label>
          <Button disabled={loading} type="submit">Consultar</Button>
        </form>
      </Card>

      <div className="metric-grid">
        <Card><strong>{money(snapshot?.summary.totalOpenAmount)}</strong><span>Total abierto</span></Card>
        <Card><strong>{money(snapshot?.summary.overdueAmount)}</strong><span>Total vencido</span></Card>
        <Card><strong>{snapshot?.summary.openDocumentCount ?? 0}</strong><span>Docs abiertos</span></Card>
        <Card><strong>{snapshot?.summary.overdueDocumentCount ?? 0}</strong><span>Docs vencidos</span></Card>
      </div>

      {rows.length ? (
        <Table
          columns={["Codigo", "Cliente", "Total", "Cobrado", "Abierto", "Vencido", "Por vencer", "Docs", "Vencidos", "Ultimo", "Detalle"]}
          rows={rows}
        />
      ) : (
        <EmptyState title="Sin saldos CxC" description="No hay saldos para los filtros seleccionados." />
      )}
    </div>
  );
}
