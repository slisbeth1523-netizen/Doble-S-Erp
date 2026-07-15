import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, Input, LoadingState, PageHeader, Table } from "../components/ui/index.js";
import {
  createSalesCreditNoteFromReturn,
  listCreditableSalesReturns,
  listSalesCreditNotes,
  postSalesCreditNote,
  type SalesCreditableReturn,
  type SalesCreditNote
} from "../services/salesCreditNotesClient.js";
import { statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

function formatMoney(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function statusTone(status?: string) {
  if (status === "POSTED" || status === "PAID") return "green";
  if (status === "DRAFT" || status === "PARTIALLY_PAID") return "amber";
  return "neutral";
}

function nextIdempotencyKey(prefix: string) {
  return `ui-sales-credit-note-${prefix}-${crypto.randomUUID()}`;
}

export function SalesCreditNotesPreview() {
  const [creditableReturns, setCreditableReturns] = useState<SalesCreditableReturn[]>([]);
  const [notes, setNotes] = useState<SalesCreditNote[]>([]);
  const [selectedReturnId, setSelectedReturnId] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [amount, setAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [notesText, setNotesText] = useState("");
  const [search, setSearch] = useState("");
  const [createKey, setCreateKey] = useState(() => nextIdempotencyKey("create"));
  const [postKey, setPostKey] = useState(() => nextIdempotencyKey("post"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedReturn = useMemo(
    () => creditableReturns.find((item) => item.salesReturnId === selectedReturnId),
    [creditableReturns, selectedReturnId]
  );

  const selectedNote = useMemo(
    () => notes.find((note) => note.customerCreditNoteId === selectedNoteId),
    [notes, selectedNoteId]
  );

  async function refresh(currentSearch = search) {
    const [pendingResult, noteResult] = await Promise.all([
      listCreditableSalesReturns({ search: currentSearch, page: 1, pageSize: 12 }),
      listSalesCreditNotes({ search: currentSearch, page: 1, pageSize: 12 })
    ]);
    setCreditableReturns(pendingResult.records);
    setNotes(noteResult.records);
    setSelectedReturnId((current) => current || (pendingResult.records[0]?.salesReturnId ?? ""));
    setSelectedNoteId((current) => current || (noteResult.records.find((note) => note.status === "DRAFT")?.customerCreditNoteId ?? ""));
  }

  useEffect(() => {
    let active = true;
    refresh()
      .catch((error: unknown) => {
        if (active) setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cargar notas de credito." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (selectedReturn && amount <= 0) {
      setAmount(Math.min(selectedReturn.pendingCreditAmount, selectedReturn.accountsReceivableRemainingAmount));
    }
  }, [selectedReturn, amount]);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await refresh(search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo consultar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateNote() {
    if (!selectedReturn) {
      setFeedback({ tone: "warning", message: "Selecciona una devolucion posteada con factura." });
      return;
    }
    if (amount <= 0) {
      setFeedback({ tone: "warning", message: "El monto de la nota debe ser mayor que cero." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const result = await createSalesCreditNoteFromReturn({
        salesReturnId: selectedReturn.salesReturnId,
        amount,
        reference: reference || selectedReturn.returnNumber,
        notes: notesText || null,
        idempotencyKey: createKey
      });
      setCreateKey(nextIdempotencyKey("create"));
      setSelectedNoteId(result.customerCreditNoteId);
      setFeedback({ tone: "success", message: `Nota ${result.creditNoteNumber} creada en borrador.` });
      await refresh(search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la nota." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePostNote() {
    if (!selectedNote) {
      setFeedback({ tone: "warning", message: "Selecciona una nota borrador para postear." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const result = await postSalesCreditNote(selectedNote.customerCreditNoteId, postKey);
      setPostKey(nextIdempotencyKey("post"));
      setSelectedNoteId(result.customerCreditNoteId);
      setFeedback({ tone: "success", message: `Nota ${result.creditNoteNumber} posteada y aplicada a CxC.` });
      await refresh(search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear la nota." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando notas de credito de ventas..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Genera notas de credito comerciales desde devoluciones posteadas con factura; aplica CxC sin volver a tocar inventario."
        eyebrow="Ventas"
        title="Notas de credito"
      />

      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <section className="dashboard-grid dashboard-grid-3">
        <Card>
          <span className="metric-label">Devoluciones pendientes</span>
          <strong className="metric-value">{creditableReturns.length}</strong>
          <span className="metric-helper">Con importe por acreditar</span>
        </Card>
        <Card>
          <span className="metric-label">Notas visibles</span>
          <strong className="metric-value">{notes.length}</strong>
          <span className="metric-helper">Pagina actual</span>
        </Card>
        <Card>
          <span className="metric-label">Pendiente total visible</span>
          <strong className="metric-value">
            RD$ {formatMoney(creditableReturns.reduce((total, item) => total + item.pendingCreditAmount, 0))}
          </strong>
          <span className="metric-helper">No incluye paginas no visibles</span>
        </Card>
      </section>

      <Card>
        <form className="toolbar-row" onSubmit={handleSearch}>
          <Input placeholder="Buscar devolucion, factura, documento CxC o cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button disabled={saving} type="submit">Consultar</Button>
          <a className="ui-button ui-button-secondary" href="/sales/returns">Devoluciones</a>
          <a className="ui-button ui-button-secondary" href="/accounts-receivable/customer-credit-notes">Notas CxC</a>
        </form>
      </Card>

      <div className="content-grid two-columns">
        <Card>
          <h2>Crear desde devolucion</h2>
          <div className="form-grid">
            <label>
              Devolucion pendiente
              <select className="ui-input" value={selectedReturnId} onChange={(event) => {
                const next = creditableReturns.find((item) => item.salesReturnId === event.target.value);
                setSelectedReturnId(event.target.value);
                setAmount(next ? Math.min(next.pendingCreditAmount, next.accountsReceivableRemainingAmount) : 0);
              }}>
                <option value="">Selecciona una devolucion</option>
                {creditableReturns.map((item) => (
                  <option key={item.salesReturnId} value={item.salesReturnId}>
                    {item.returnNumber} - {item.invoiceNumber} - RD$ {formatMoney(item.pendingCreditAmount)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Monto
              <Input min="0.01" step="0.01" type="number" value={amount || ""} onChange={(event) => setAmount(Number(event.target.value) || 0)} />
            </label>
            <label>
              Referencia
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Referencia opcional" />
            </label>
            <label>
              Notas
              <Input value={notesText} onChange={(event) => setNotesText(event.target.value)} placeholder="Notas opcionales" />
            </label>
            <Button disabled={saving || !selectedReturn} onClick={handleCreateNote} type="button">
              Crear borrador
            </Button>
          </div>
          {selectedReturn ? (
            <p style={{ color: "var(--muted)", marginTop: "12px" }}>
              Pendiente RD$ {formatMoney(selectedReturn.pendingCreditAmount)} - saldo CxC RD${" "}
              {formatMoney(selectedReturn.accountsReceivableRemainingAmount)} - cantidad {formatNumber(selectedReturn.returnedQuantity)}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2>Postear y aplicar</h2>
          <div className="form-grid">
            <label>
              Nota borrador
              <select className="ui-input" value={selectedNoteId} onChange={(event) => setSelectedNoteId(event.target.value)}>
                <option value="">Selecciona una nota</option>
                {notes.map((note) => (
                  <option disabled={note.status !== "DRAFT"} key={note.customerCreditNoteId} value={note.customerCreditNoteId}>
                    {note.creditNoteNumber} - {note.returnNumber} - {statusLabel(note.status)}
                  </option>
                ))}
              </select>
            </label>
            {selectedNote ? (
              <p style={{ color: "var(--muted)" }}>
                Aplica RD$ {formatMoney(selectedNote.amount)} al documento {selectedNote.accountsReceivableDocumentNumber}.
              </p>
            ) : null}
            <Button disabled={saving || !selectedNote || selectedNote.status !== "DRAFT"} onClick={handlePostNote} type="button">
              Postear nota
            </Button>
          </div>
        </Card>
      </div>

      <Card>
        <h2>Devoluciones pendientes de acreditar</h2>
        <Table
          columns={["Devolucion", "Factura", "Documento CxC", "Cliente", "Devuelto", "Reservado", "Pendiente", "Saldo CxC"]}
          rows={creditableReturns.map((item) => [
            item.returnNumber,
            item.invoiceNumber,
            item.accountsReceivableDocumentNumber,
            item.customerName,
            `RD$ ${formatMoney(item.returnedAmount)}`,
            `RD$ ${formatMoney(item.reservedCreditAmount)}`,
            `RD$ ${formatMoney(item.pendingCreditAmount)}`,
            `RD$ ${formatMoney(item.accountsReceivableRemainingAmount)}`
          ])}
        />
      </Card>

      <Card>
        <h2>Notas de credito de ventas</h2>
        <Table
          columns={["Nota", "Devolucion", "Factura", "Cliente", "Monto", "CxC", "Estado"]}
          rows={notes.map((note) => [
            note.creditNoteNumber,
            note.returnNumber,
            note.invoiceNumber,
            note.customerName,
            `RD$ ${formatMoney(note.amount)}`,
            `${note.accountsReceivableDocumentNumber} - RD$ ${formatMoney(note.accountsReceivableRemainingAmount)}`,
            <Badge key={note.customerCreditNoteId} tone={statusTone(note.status)}>{statusLabel(note.status)}</Badge>
          ])}
        />
      </Card>
    </div>
  );
}
