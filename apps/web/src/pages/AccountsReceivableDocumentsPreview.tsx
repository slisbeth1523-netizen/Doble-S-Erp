import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea, FormField, FilterBar } from "../components/ui/index.js";
import type { LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { sourceTypeLabel, statusLabel } from "../utils/displayLabels.js";
import {
  createAccountsReceivableDocument,
  loadAccountsReceivableDocuments,
  loadAccountsReceivableOptions,
  type AccountsReceivableDocument,
  type DocumentsResponse
} from "../services/accountsReceivableClient.js";

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

type Feedback = { tone: "success" | "error" | "warning"; message: string };

export function AccountsReceivableDocumentsPreview() {
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [sourceType, setSourceType] = useState<"MANUAL" | "OPENING_BALANCE">("MANUAL");
  const [documentDate, setDocumentDate] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [currencyCode, setCurrencyCode] = useState("DOP");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [totalAmount, setTotalAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [snapshot, setSnapshot] = useState<DocumentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.value === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
  );

  async function refresh() {
    setLoading(true);
    setFeedback(null);

    try {
      const [options, documents] = await Promise.all([
        loadAccountsReceivableOptions(),
        loadAccountsReceivableDocuments({ customerId: selectedCustomerId, search, status, overdueOnly, pageSize: 100 })
      ]);

      setCustomers(options.customers);
      if (!selectedCustomerId && options.customers[0]) {
        setSelectedCustomerId(options.customers[0].value);
      }
      setSnapshot(documents);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "API no disponible." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  function handleFilter(event: FormEvent) {
    event.preventDefault();
    void refresh();
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomer || totalAmount <= 0 || !dueDate) return;

    setSaving(true);
    setFeedback(null);

    try {
      const document = await createAccountsReceivableDocument({
        customerId: selectedCustomer.value,
        sourceType,
        documentDate: documentDate ? new Date(documentDate).toISOString() : undefined,
        dueDate: new Date(dueDate).toISOString(),
        currencyCode,
        exchangeRate,
        totalAmount,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined
      });

      setFeedback({ tone: "success", message: `Documento ${document.documentNumber} creado en estado Abierto con saldo ${money(document.remainingAmount)}.` });
      setTotalAmount(0);
      setReference("");
      setNotes("");
      await refresh();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear el documento." });
    } finally {
      setSaving(false);
    }
  }

  const rows = (snapshot?.records ?? []).map((record: AccountsReceivableDocument) => [
    <strong style={{ textAlign: "left", display: "block" }}>{record.documentNumber}</strong>,
    <div style={{ textAlign: "left" }}>{record.customerName}</div>,
    <div style={{ textAlign: "center" }}>{sourceTypeLabel(record.sourceType)}</div>,
    <div style={{ textAlign: "center" }}>{shortDate(record.documentDate)}</div>,
    <div style={{ textAlign: "center" }}>{shortDate(record.dueDate)}</div>,
    <div style={{ textAlign: "center" }}>{statusLabel(record.status)}</div>,
    <div style={{ textAlign: "right" }}>{record.daysPastDue}</div>,
    <div style={{ textAlign: "right" }}>{money(record.totalAmount)}</div>,
    <div style={{ textAlign: "right" }}>{money(record.paidAmount)}</div>,
    <div style={{ textAlign: "right", fontWeight: "600" }}>{money(record.remainingAmount)}</div>
  ]);

  if (loading && !snapshot) {
    return <LoadingState label="Cargando documentos CxC..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Documentos de cuentas por cobrar"
        description="Consulta las facturas, notas y documentos pendientes asociados a tus clientes."
        actions={
          <div className="runtime-page-actions">
            <a className="ui-button ui-button-secondary" href="/accounts-receivable/customer-balances">Saldos por cliente</a>
          </div>
        }
      />

      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

      <div className="metric-grid" style={{ marginBottom: "24px" }}>
        <Card className="metric-card">
          <span>Saldo abierto</span>
          <strong>{money(snapshot?.summary.remainingAmount)}</strong>
          <small style={{ color: "var(--muted)" }}>Pendiente de cobro</small>
        </Card>
        <Card className="metric-card">
          <span>Saldo vencido</span>
          <strong style={{ color: "var(--red)" }}>{money(snapshot?.summary.overdueAmount)}</strong>
          <small style={{ color: "var(--muted)" }}>Saldos fuera de plazo</small>
        </Card>
        <Card className="metric-card">
          <span>Docs abiertos</span>
          <strong>{snapshot?.summary.openDocumentCount ?? 0}</strong>
          <small style={{ color: "var(--muted)" }}>Comprobantes activos</small>
        </Card>
        <Card className="metric-card">
          <span>Docs vencidos</span>
          <strong style={{ color: "var(--amber)" }}>{snapshot?.summary.overdueDocumentCount ?? 0}</strong>
          <small style={{ color: "var(--muted)" }}>Facturas vencidas</small>
        </Card>
      </div>

      <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", marginBottom: "24px" }}>
        <Card>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Búsqueda y Filtros</h2>
          <form onSubmit={handleFilter} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <FormField label="Cliente">
              <Select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                <option value="">Todos</option>
                {customers.map((customer) => (
                  <option key={customer.value} value={customer.value}>{customer.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Buscar">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Documento, cliente o referencia..." />
            </FormField>
            <FormField label="Estado">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                <option value="OPEN">Abierto</option>
                <option value="PARTIALLY_PAID">Parcialmente pagado</option>
                <option value="PAID">Pagado</option>
                <option value="CANCELLED">Cancelado</option>
              </Select>
            </FormField>
            <label className="inline-check" style={{ display: "inline-flex", alignItems: "center", gap: "8px", margin: "8px 0" }}>
              <input checked={overdueOnly} type="checkbox" onChange={(event) => setOverdueOnly(event.target.checked)} className="ui-checkbox" />
              <span>Solo vencidos</span>
            </label>
            <Button disabled={loading} type="submit" variant="primary">Consultar documentos</Button>
          </form>
        </Card>

        <Card>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Crear documento manual</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <FormField label="Tipo">
              <Select value={sourceType} onChange={(event) => setSourceType(event.target.value as "MANUAL" | "OPENING_BALANCE")}>
                <option value="MANUAL">Manual</option>
                <option value="OPENING_BALANCE">Saldo inicial</option>
              </Select>
            </FormField>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <FormField label="Fecha documento">
                <Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
              </FormField>
              <FormField label="Vencimiento">
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </FormField>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <FormField label="Moneda">
                <Input maxLength={3} value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} />
              </FormField>
              <FormField label="Tasa">
                <Input min={0.000001} step="0.000001" type="number" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
              </FormField>
            </div>
            <FormField label="Monto total">
              <Input min={0} step="0.01" type="number" value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} />
            </FormField>
            <FormField label="Referencia">
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. Factura #..." />
            </FormField>
            <FormField label="Notas">
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Comentarios adicionales..." rows={2} />
            </FormField>
            <Button disabled={saving || !selectedCustomer || totalAmount <= 0} type="submit" variant="primary">Crear documento</Button>
          </form>
        </Card>
      </div>

      {feedback?.tone === "error" && <ErrorState title="API no disponible" message={feedback.message} />}

      <Card>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "16px" }}>Historial de Documentos CxC</h3>
        {rows.length ? (
          <Table
            columns={["Documento", "Cliente", "Origen", "Fecha", "Vence", "Estado", "Días", "Total", "Cobrado", "Saldo"]}
            rows={rows}
          />
        ) : (
          <EmptyState title="Sin documentos CxC" description="No hay documentos de cuentas por cobrar para mostrar." />
        )}
      </Card>
    </div>
  );
}
