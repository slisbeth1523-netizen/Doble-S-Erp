import { type FormEvent, useEffect, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Table, FormField, FilterBar } from "../components/ui/index.js";
import { loadSupplierStatements, type SupplierStatementDetail, type SupplierStatementResponse } from "../services/supplierStatementsClient.js";
import { sourceTypeLabel, statusLabel } from "../utils/displayLabels.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortDate(value: string) {
  return value ? new Date(value).toLocaleDateString("es-DO") : "";
}

function initialSupplierId() {
  return new URLSearchParams(window.location.search).get("supplierId") ?? "";
}

export function SupplierStatementsPreview() {
  const [asOfDate, setAsOfDate] = useState(today());
  const [supplierId] = useState(initialSupplierId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [agingBucket, setAgingBucket] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [snapshot, setSnapshot] = useState<SupplierStatementResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const data = await loadSupplierStatements({
        asOfDate,
        search,
        status,
        agingBucket,
        overdueOnly,
        supplierId,
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

  const rows = (snapshot?.records ?? []).map((record: SupplierStatementDetail) => [
    <strong style={{ textAlign: "left", display: "block" }}>{record.documentNumber}</strong>,
    <div style={{ textAlign: "left" }}>{record.supplierName}</div>,
    <div style={{ textAlign: "center" }}>{sourceTypeLabel(record.sourceType)}</div>,
    <div style={{ textAlign: "center" }}>{shortDate(record.documentDate)}</div>,
    <div style={{ textAlign: "center" }}>{shortDate(record.dueDate)}</div>,
    <div style={{ textAlign: "center" }}>{statusLabel(record.status)}</div>,
    <div style={{ textAlign: "center" }}>{sourceTypeLabel(record.agingBucket)}</div>,
    <div style={{ textAlign: "right" }}>{record.daysPastDue}</div>,
    <div style={{ textAlign: "right" }}>{money(record.totalAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.paidAmount)}</div>,
    <div style={{ textAlign: "right", fontWeight: "600" }}>{money(record.remainingAmount)}</div>
  ]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por pagar"
        title="Estado de cuenta de proveedores"
        description="Consulta cronológicamente los documentos, pagos y balances de cada proveedor."
        actions={
          <div className="runtime-page-actions">
            <a className="ui-button ui-button-secondary" href="/accounts-payable/documents">Documentos CxP</a>
            <a className="ui-button ui-button-secondary" href="/accounts-payable/payments">Pagos</a>
            <a className="ui-button ui-button-secondary" href="/accounts-payable/supplier-adjustments">Notas proveedor</a>
          </div>
        }
      />

      <Card>
        <form onSubmit={handleSubmit}>
          <FilterBar>
            <FormField label="Fecha de corte" style={{ flex: "1 1 200px" }}>
              <Input type="date" value={asOfDate} onChange={(event) => setAsOfDate(event.target.value)} />
            </FormField>
            <FormField label="Buscar proveedor o documento" style={{ flex: "1 1 250px" }}>
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Proveedor, documento o estado..." />
            </FormField>
            <FormField label="Estado" style={{ flex: "1 1 180px" }}>
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                <option value="OPEN">Abierto</option>
                <option value="PARTIALLY_PAID">Parcialmente pagado</option>
                <option value="PAID">Pagado</option>
                <option value="PENDING">Pendiente</option>
              </Select>
            </FormField>
            <FormField label="Rango de antigüedad" style={{ flex: "1 1 180px" }}>
              <Select value={agingBucket} onChange={(event) => setAgingBucket(event.target.value)}>
                <option value="">Todos</option>
                <option value="CURRENT">Corriente</option>
                <option value="1-30">1 a 30 días</option>
                <option value="31-60">31 a 60 días</option>
                <option value="61-90">61 a 90 días</option>
                <option value="90+">Más de 90 días</option>
              </Select>
            </FormField>
          </FilterBar>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", marginTop: "12px" }}>
            <label className="inline-check" style={{ display: "inline-flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <input checked={overdueOnly} type="checkbox" onChange={(event) => setOverdueOnly(event.target.checked)} className="ui-checkbox" />
              <span>Solo vencidos</span>
            </label>
            <Button disabled={loading} type="submit" variant="primary">
              {loading ? "Consultando..." : "Consultar estado de cuenta"}
            </Button>
          </div>
        </form>
      </Card>

      {error && <ErrorState title="API no disponible" message={error} />}
      {loading && <LoadingState label="Cargando estado de cuenta..." />}

      {!loading && !error && snapshot && (
        <>
          <div className="metric-grid" style={{ marginBottom: "24px" }}>
            <Card className="metric-card">
              <span>Balance total</span>
              <strong>{money(snapshot.summary.remainingAmount)}</strong>
              <small style={{ color: "var(--muted)" }}>Saldo pendiente total</small>
            </Card>
            <Card className="metric-card">
              <span>Vencido</span>
              <strong style={{ color: "var(--red)" }}>{money(snapshot.summary.overdueAmount)}</strong>
              <small style={{ color: "var(--muted)" }}>Total saldo vencido</small>
            </Card>
            <Card className="metric-card">
              <span>Por vencer</span>
              <strong style={{ color: "var(--green)" }}>{money(snapshot.summary.notDueAmount)}</strong>
              <small style={{ color: "var(--muted)" }}>Dentro de fecha límite</small>
            </Card>
            <Card className="metric-card">
              <span>Documentos</span>
              <strong>{snapshot.summary.documentCount}</strong>
              <small style={{ color: "var(--muted)" }}>Comprobantes vigentes</small>
            </Card>
          </div>

          <Alert tone="success">Consulta conectada a la API. Fecha de corte: {snapshot.asOfDate}.</Alert>
          {supplierId && <Alert tone="info">Detalle filtrado por proveedor seleccionado desde antigüedad.</Alert>}

          <Card style={{ marginTop: "24px" }}>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Detalle de Movimientos</h3>
            {rows.length ? (
              <Table
                columns={["Documento", "Proveedor", "Origen", "Fecha", "Vence", "Estado", "Rango", "Días", "Total", "Pagado", "Saldo"]}
                rows={rows}
              />
            ) : (
              <EmptyState title="Sin movimientos" description="No existen movimientos para el proveedor y período seleccionados." />
            )}
          </Card>
        </>
      )}
    </div>
  );
}
