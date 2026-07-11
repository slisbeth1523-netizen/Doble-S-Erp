import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Button, Card, EmptyState, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
import type { LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
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

      setFeedback({ tone: "success", message: `Documento ${document.documentNumber} creado en OPEN con saldo ${money(document.remainingAmount)}.` });
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
    record.documentNumber,
    record.customerName,
    record.sourceType,
    shortDate(record.documentDate),
    shortDate(record.dueDate),
    record.status,
    record.daysPastDue,
    money(record.totalAmount),
    money(record.paidAmount),
    money(record.remainingAmount)
  ]);

  if (loading && !snapshot) {
    return <LoadingState label="Cargando documentos CxC..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Documentos"
        description="Consulta documentos CxC y registra documentos manuales o saldos iniciales sin cobros ni contabilidad."
        actions={<a className="ui-button ui-button-secondary" href="/accounts-receivable/customer-balances">Saldos por cliente</a>}
      />

      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

      <div className="metric-grid">
        <Card><strong>{money(snapshot?.summary.remainingAmount)}</strong><span>Saldo abierto</span></Card>
        <Card><strong>{money(snapshot?.summary.overdueAmount)}</strong><span>Saldo vencido</span></Card>
        <Card><strong>{snapshot?.summary.openDocumentCount ?? 0}</strong><span>Docs abiertos</span></Card>
        <Card><strong>{snapshot?.summary.overdueDocumentCount ?? 0}</strong><span>Docs vencidos</span></Card>
      </div>

      <div className="content-grid">
        <Card>
          <form className="settings-form" onSubmit={handleFilter}>
            <h2>Filtros</h2>
            <label>
              Cliente
              <Select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)}>
                <option value="">Todos</option>
                {customers.map((customer) => (
                  <option key={customer.value} value={customer.value}>{customer.label}</option>
                ))}
              </Select>
            </label>
            <label>
              Buscar
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Documento, cliente o referencia" />
            </label>
            <label>
              Estado
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                <option value="OPEN">OPEN</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="PAID">PAID</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </label>
            <label className="inline-check">
              <input checked={overdueOnly} type="checkbox" onChange={(event) => setOverdueOnly(event.target.checked)} />
              Solo vencidos
            </label>
            <Button disabled={loading} type="submit">Consultar</Button>
          </form>
        </Card>

        <Card>
          <form className="settings-form" onSubmit={handleCreate}>
            <h2>Crear documento</h2>
            <label>
              Tipo
              <Select value={sourceType} onChange={(event) => setSourceType(event.target.value as "MANUAL" | "OPENING_BALANCE")}>
                <option value="MANUAL">MANUAL</option>
                <option value="OPENING_BALANCE">OPENING_BALANCE</option>
              </Select>
            </label>
            <label>
              Fecha documento
              <Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
            </label>
            <label>
              Vencimiento
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <label>
              Moneda
              <Input maxLength={3} value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} />
            </label>
            <label>
              Tasa
              <Input min={0.000001} step="0.000001" type="number" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
            </label>
            <label>
              Total
              <Input min={0} step="0.01" type="number" value={totalAmount} onChange={(event) => setTotalAmount(Number(event.target.value))} />
            </label>
            <label>
              Referencia
              <Input value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
            <label>
              Notas
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <Button disabled={saving || !selectedCustomer || totalAmount <= 0} type="submit">Crear</Button>
          </form>
        </Card>
      </div>

      {feedback?.tone === "error" && <ErrorState title="API no disponible" message={feedback.message} />}

      {rows.length ? (
        <Table
          columns={["Documento", "Cliente", "Origen", "Fecha", "Vence", "Estado", "Dias", "Total", "Cobrado", "Saldo"]}
          rows={rows}
        />
      ) : (
        <EmptyState title="Sin documentos CxC" description="No hay documentos para los filtros seleccionados." />
      )}
    </div>
  );
}
