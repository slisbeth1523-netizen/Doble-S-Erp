import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  FormField,
  FormSection,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Textarea
} from "../components/ui/index.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  applyCustomerCreditNote,
  createCustomerCreditNote,
  getCustomerCreditNote,
  listCustomerCreditNotes,
  listCustomers,
  listOpenReceivableDocuments,
  postCustomerCreditNote,
  type AccountsReceivableDocument,
  type CustomerCreditNote,
  type CustomerCreditNoteStatus
} from "../services/customerCreditNotesClient.js";
import { statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

export function CustomerCreditNotesPreview() {
  const [notes, setNotes] = useState<CustomerCreditNote[]>([]);
  const [customers, setCustomers] = useState<CatalogRecord[]>([]);
  const [selectedNote, setSelectedNote] = useState<CustomerCreditNote | null>(null);
  const [openDocuments, setOpenDocuments] = useState<AccountsReceivableDocument[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [noteAmount, setNoteAmount] = useState(0);
  const [noteDate, setNoteDate] = useState(new Date().toISOString().substring(0, 10));
  const [noteReference, setNoteReference] = useState("");
  const [noteNotes, setNoteNotes] = useState("");

  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [appliedAmount, setAppliedAmount] = useState(0);
  const [applicationNotes, setApplicationNotes] = useState("");

  async function loadInitialData() {
    try {
      setLoading(true);
      const [noteList, customerList] = await Promise.all([listCustomerCreditNotes(), listCustomers()]);
      setNotes(noteList);
      setCustomers(customerList);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar las notas de credito."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const customerId = selectedNote?.status === "DRAFT" ? selectedNote.customerId : selectedCustomerId;
    if (!customerId) {
      setOpenDocuments([]);
      return;
    }

    listOpenReceivableDocuments(customerId)
      .then(setOpenDocuments)
      .catch((error) => {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "No se pudieron cargar los documentos abiertos."
        });
      });
  }, [selectedCustomerId, selectedNote]);

  const selectedDocument = useMemo(
    () => openDocuments.find((document) => document.id === selectedDocumentId),
    [openDocuments, selectedDocumentId]
  );

  function formatMoney(value: unknown) {
    return Number(value ?? 0).toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function statusTone(status?: CustomerCreditNoteStatus) {
    if (status === "POSTED") return "green";
    if (status === "CANCELLED") return "red";
    return "amber";
  }

  async function selectNote(noteId: string) {
    try {
      setLoading(true);
      const detail = await getCustomerCreditNote(noteId);
      setSelectedNote(detail);
      setIsCreating(false);
      setSelectedDocumentId("");
      setAppliedAmount(0);
      setApplicationNotes("");
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar la nota de credito."
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateNote(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomerId || noteAmount <= 0) {
      setFeedback({ tone: "warning", message: "Selecciona un cliente y define un monto valido." });
      return;
    }

    try {
      setSubmitting(true);
      const note = await createCustomerCreditNote({
        customerId: selectedCustomerId,
        amount: noteAmount,
        creditNoteDate: noteDate,
        reference: noteReference || null,
        notes: noteNotes || null
      });
      setSelectedNote(note);
      setIsCreating(false);
      setFeedback({ tone: "success", message: `Nota ${note.creditNoteNumber} creada en borrador.` });
      setNotes(await listCustomerCreditNotes());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo crear la nota de credito."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyNote(event: FormEvent) {
    event.preventDefault();
    if (!selectedNote || !selectedDocumentId || appliedAmount <= 0) {
      setFeedback({ tone: "warning", message: "Selecciona un documento y un monto mayor que cero." });
      return;
    }

    try {
      setSubmitting(true);
      const updated = await applyCustomerCreditNote(selectedNote.id, {
        accountsReceivableDocumentId: selectedDocumentId,
        appliedAmount,
        notes: applicationNotes || null
      });
      setSelectedNote(updated);
      setSelectedDocumentId("");
      setAppliedAmount(0);
      setApplicationNotes("");
      setFeedback({ tone: "success", message: "Aplicacion guardada correctamente." });
      setNotes(await listCustomerCreditNotes());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar la aplicacion."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostNote() {
    if (!selectedNote) return;
    if (Math.abs(selectedNote.appliedAmount - selectedNote.amount) > 0.001) {
      setFeedback({
        tone: "warning",
        message: "El monto aplicado debe coincidir con el monto de la nota antes de postear."
      });
      return;
    }

    try {
      setSubmitting(true);
      const posted = await postCustomerCreditNote(selectedNote.id);
      setSelectedNote(posted);
      setFeedback({ tone: "success", message: `Nota ${posted.creditNoteNumber} posteada correctamente.` });
      setNotes(await listCustomerCreditNotes());
      setOpenDocuments(await listOpenReceivableDocuments(posted.customerId));
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo postear la nota de credito."
      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setSelectedCustomerId("");
    setNoteAmount(0);
    setNoteDate(new Date().toISOString().substring(0, 10));
    setNoteReference("");
    setNoteNotes("");
    setSelectedNote(null);
    setIsCreating(true);
    setFeedback(null);
  }

  if (loading && notes.length === 0) {
    return <LoadingState label="Cargando notas de credito..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Notas de credito"
        description="Registro de creditos a clientes, aplicacion a documentos CxC y posteo transaccional de saldos."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={resetCreateForm}>
          Nueva nota
        </Button>
        <a className="ui-button ui-button-secondary" href="/accounts-receivable/documents">
          Documentos CxC
        </a>
        <a className="ui-button ui-button-secondary" href="/master-data/customer-credit-notes">
          Consulta notas
        </a>
      </div>

      {(isCreating || selectedNote) && (
        <Card className="ui-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
            <h3>{isCreating ? "Crear nota en borrador" : `Detalle ${selectedNote?.creditNoteNumber}`}</h3>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreating(false);
                setSelectedNote(null);
                setFeedback(null);
              }}
            >
              Cerrar
            </Button>
          </div>

          {isCreating ? (
            <form onSubmit={handleCreateNote}>
              <FormSection title="Datos de la nota">
                <div className="grid-2">
                  <FormField label="Cliente" required>
                    <Select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} required>
                      <option value="">Selecciona un cliente...</option>
                      {customers.map((customer) => (
                        <option key={String(customer.id)} value={String(customer.id)}>
                          {String(customer.name)} ({String(customer.code)})
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField label="Monto" required>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={noteAmount || ""}
                      onChange={(event) => setNoteAmount(Number(event.target.value) || 0)}
                      required
                    />
                  </FormField>
                </div>

                <div className="grid-2">
                  <FormField label="Fecha" required>
                    <Input type="date" value={noteDate} onChange={(event) => setNoteDate(event.target.value)} required />
                  </FormField>

                  <FormField label="Referencia">
                    <Input value={noteReference} onChange={(event) => setNoteReference(event.target.value)} />
                  </FormField>
                </div>

                <FormField label="Notas">
                  <Textarea value={noteNotes} onChange={(event) => setNoteNotes(event.target.value)} />
                </FormField>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                  <Button type="button" variant="secondary" onClick={() => setIsCreating(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? "Guardando..." : "Guardar borrador"}
                  </Button>
                </div>
              </FormSection>
            </form>
          ) : (
            selectedNote && (
              <div className="page-stack">
                <div className="metric-grid">
                  <Card className="metric-card">
                    <span>Monto nota</span>
                    <strong>RD$ {formatMoney(selectedNote.amount)}</strong>
                    <small>{selectedNote.creditNoteNumber}</small>
                  </Card>
                  <Card className="metric-card">
                    <span>Aplicado</span>
                    <strong>RD$ {formatMoney(selectedNote.appliedAmount)}</strong>
                    <small>{selectedNote.applicationCount} aplicaciones</small>
                  </Card>
                  <Card className="metric-card">
                    <span>Sin aplicar</span>
                    <strong>RD$ {formatMoney(selectedNote.unappliedAmount)}</strong>
                    <small>Debe quedar en cero para postear</small>
                  </Card>
                  <Card className="metric-card">
                    <span>Estado</span>
                    <strong>
                      <Badge tone={statusTone(selectedNote.status)}>{statusLabel(selectedNote.status)}</Badge>
                    </strong>
                    <small>{selectedNote.customerName}</small>
                  </Card>
                </div>

                {selectedNote.status === "DRAFT" && (
                  <form onSubmit={handleApplyNote}>
                    <FormSection title="Aplicar a documento CxC">
                      {openDocuments.length === 0 ? (
                        <p style={{ color: "var(--muted)" }}>Este cliente no tiene documentos abiertos para aplicar.</p>
                      ) : (
                        <>
                          <div className="grid-3" style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                            <FormField label="Documento" required>
                              <Select
                                value={selectedDocumentId}
                                onChange={(event) => {
                                  const nextDocument = openDocuments.find((document) => document.id === event.target.value);
                                  setSelectedDocumentId(event.target.value);
                                  if (nextDocument) {
                                    const maxAmount = Math.min(nextDocument.remainingAmount, selectedNote.unappliedAmount);
                                    setAppliedAmount(maxAmount > 0 ? maxAmount : nextDocument.remainingAmount);
                                  }
                                }}
                                required
                              >
                                <option value="">Selecciona documento...</option>
                                {openDocuments.map((document) => (
                                  <option key={document.id} value={document.id}>
                                    {document.documentNumber} - saldo RD$ {formatMoney(document.remainingAmount)}
                                  </option>
                                ))}
                              </Select>
                            </FormField>

                            <FormField label="Monto aplicado" required>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={appliedAmount || ""}
                                onChange={(event) => setAppliedAmount(Number(event.target.value) || 0)}
                                required
                              />
                            </FormField>

                            <div style={{ display: "flex", alignItems: "flex-end" }}>
                              <Button type="submit" variant="primary" disabled={submitting} style={{ width: "100%" }}>
                                {submitting ? "Aplicando..." : "Aplicar"}
                              </Button>
                            </div>
                          </div>

                          {selectedDocument && (
                            <p style={{ margin: "8px 0 0", color: "var(--muted)" }}>
                              Total documento RD$ {formatMoney(selectedDocument.totalAmount)} · pagado RD${" "}
                              {formatMoney(selectedDocument.paidAmount)} · saldo RD${" "}
                              {formatMoney(selectedDocument.remainingAmount)}
                            </p>
                          )}

                          <FormField label="Nota de aplicacion">
                            <Input value={applicationNotes} onChange={(event) => setApplicationNotes(event.target.value)} />
                          </FormField>
                        </>
                      )}
                    </FormSection>
                  </form>
                )}

                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left" }}>Documento CxC</th>
                        <th style={{ textAlign: "left" }}>Estado doc.</th>
                        <th style={{ textAlign: "right" }}>Aplicado</th>
                        <th style={{ textAlign: "right" }}>Saldo doc.</th>
                        <th style={{ textAlign: "left" }}>Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedNote.applications.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                            No hay aplicaciones registradas.
                          </td>
                        </tr>
                      ) : (
                        selectedNote.applications.map((application) => (
                          <tr key={application.id}>
                            <td style={{ textAlign: "left" }}>{application.documentNumber}</td>
                            <td style={{ textAlign: "left" }}>{statusLabel(application.documentStatus)}</td>
                            <td style={{ textAlign: "right" }}>RD$ {formatMoney(application.appliedAmount)}</td>
                            <td style={{ textAlign: "right" }}>RD$ {formatMoney(application.documentRemainingAmount)}</td>
                            <td style={{ textAlign: "left" }}>{application.notes || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {selectedNote.status === "DRAFT" && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" onClick={handlePostNote} disabled={submitting}>
                      {submitting ? "Posteando..." : "Postear nota"}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </Card>
      )}

      {!isCreating && !selectedNote && (
        <Card className="ui-card">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Nota</th>
                  <th style={{ textAlign: "left" }}>Cliente</th>
                  <th style={{ textAlign: "center" }}>Fecha</th>
                  <th style={{ textAlign: "right" }}>Monto</th>
                  <th style={{ textAlign: "right" }}>Aplicado</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No hay notas de credito registradas.
                    </td>
                  </tr>
                ) : (
                  notes.map((note) => (
                    <tr key={note.id}>
                      <td style={{ textAlign: "left" }}>{note.creditNoteNumber}</td>
                      <td style={{ textAlign: "left" }}>
                        {note.customerName} ({note.customerCode})
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {new Date(note.creditNoteDate).toLocaleDateString("es-DO")}
                      </td>
                      <td style={{ textAlign: "right" }}>RD$ {formatMoney(note.amount)}</td>
                      <td style={{ textAlign: "right" }}>RD$ {formatMoney(note.appliedAmount)}</td>
                      <td style={{ textAlign: "center" }}>
                        <Badge tone={statusTone(note.status)}>{statusLabel(note.status)}</Badge>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Button variant="secondary" onClick={() => selectNote(note.id)}>
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
