import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Table } from "../components/ui/index.js";
import { loadCustomerStatements, type CustomerStatementDetail, type CustomerStatementResponse } from "../services/customerStatementsClient.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(value: string) {
  return value ? new Date(value).toLocaleDateString("es-DO") : "";
}

function initialCustomerId() {
  return new URLSearchParams(window.location.search).get("customerId") ?? "";
}

export function CustomerStatementsPreview() {
  const [asOfDate, setAsOfDate] = useState(today());
  const [customerId] = useState(initialCustomerId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [agingBucket, setAgingBucket] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [snapshot, setSnapshot] = useState<CustomerStatementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await loadCustomerStatements({
        asOfDate,
        search,
        status,
        agingBucket,
        overdueOnly,
        customerId,
        pageSize: 100
      });
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

  const rows = (snapshot?.records ?? []).map((record: CustomerStatementDetail) => [
    record.documentNumber,
    record.customerName,
    record.sourceType,
    shortDate(record.documentDate),
    shortDate(record.dueDate),
    record.status,
    record.agingBucket,
    record.daysPastDue,
    money(record.totalAmount),
    money(record.paidAmount),
    money(record.remainingAmount)
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Estado de cuenta"
        description="Consulta read-only de documentos CxC por cliente, con saldo, vencimiento y bucket a fecha de corte."
        actions={
          <>
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/documents">Documentos CxC</a>
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
              Buscar cliente o documento
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cliente, documento o estado" />
            </label>
            <label>
              Estado
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                <option value="OPEN">OPEN</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="PAID">PAID</option>
              </Select>
            </label>
            <label>
              Bucket
              <Select value={agingBucket} onChange={(event) => setAgingBucket(event.target.value)}>
                <option value="">Todos</option>
                <option value="CURRENT">CURRENT</option>
                <option value="1-30">1-30</option>
                <option value="31-60">31-60</option>
                <option value="61-90">61-90</option>
                <option value="90+">90+</option>
              </Select>
            </label>
          </div>
          <label className="inline-check">
            <input checked={overdueOnly} type="checkbox" onChange={(event) => setOverdueOnly(event.target.checked)} />
            Solo vencidos
          </label>
          <Button disabled={loading} type="submit">
            Consultar
          </Button>
        </form>
      </Card>

      {error && <ErrorState title="API no disponible" message={error} />}
      {loading && <LoadingState label="Cargando estado de cuenta..." />}

      {!loading && !error && snapshot && (
        <>
          <div className="metric-grid">
            <Card><strong>{money(snapshot.summary.remainingAmount)}</strong><span>Balance total</span></Card>
            <Card><strong>{money(snapshot.summary.overdueAmount)}</strong><span>Vencido</span></Card>
            <Card><strong>{money(snapshot.summary.notDueAmount)}</strong><span>Por vencer</span></Card>
            <Card><strong>{snapshot.summary.openDocumentCount}</strong><span>Docs abiertos</span></Card>
          </div>

          <Alert tone="success">Consulta conectada a API. Fecha de corte: {snapshot.asOfDate}.</Alert>
          {customerId && <Alert tone="info">Detalle filtrado por cliente seleccionado desde antiguedad.</Alert>}

          {rows.length ? (
            <Table
              columns={["Documento", "Cliente", "Origen", "Fecha", "Vence", "Estado", "Bucket", "Dias", "Total", "Pagado", "Saldo"]}
              rows={rows}
            />
          ) : (
            <EmptyState title="Sin documentos" description="No hay documentos para los filtros seleccionados." />
          )}
        </>
      )}
    </div>
  );
}
