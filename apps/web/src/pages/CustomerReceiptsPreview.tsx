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
  applyCustomerReceipt,
  createCustomerReceipt,
  getCustomerReceipt,
  listCustomerReceipts,
  listCustomers,
  listOpenReceivableDocuments,
  postCustomerReceipt,
  type AccountsReceivableDocument,
  type CustomerReceipt,
  type CustomerReceiptStatus
} from "../services/customerReceiptsClient.js";
import { statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

export function CustomerReceiptsPreview() {
  const [receipts, setReceipts] = useState<CustomerReceipt[]>([]);
  const [customers, setCustomers] = useState<CatalogRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<CustomerReceipt | null>(null);
  const [openDocuments, setOpenDocuments] = useState<AccountsReceivableDocument[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [receiptTotalAmount, setReceiptTotalAmount] = useState(0);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().substring(0, 10));
  const [receiptReference, setReceiptReference] = useState("");
  const [receiptNotes, setReceiptNotes] = useState("");

  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [appliedAmount, setAppliedAmount] = useState(0);
  const [applicationNotes, setApplicationNotes] = useState("");

  async function loadInitialData() {
    try {
      setLoading(true);
      const [receiptList, customerList] = await Promise.all([listCustomerReceipts(), listCustomers()]);
      setReceipts(receiptList);
      setCustomers(customerList);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar los recibos."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    const customerId = selectedReceipt?.status === "DRAFT" ? selectedReceipt.customerId : selectedCustomerId;
    if (!customerId) {
      setOpenDocuments([]);
      return;
    }

    listOpenReceivableDocuments(customerId)
      .then(setOpenDocuments)
      .catch((error) => {
        setFeedback({
          tone: "error",
          message: error instanceof Error ? error.message : "No se pudieron cargar los documentos pendientes."
        });
      });
  }, [selectedCustomerId, selectedReceipt]);

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

  function statusTone(status?: CustomerReceiptStatus) {
    if (status === "POSTED") return "green";
    if (status === "CANCELLED") return "red";
    return "amber";
  }

  async function selectReceipt(receiptId: string) {
    try {
      setLoading(true);
      const detail = await getCustomerReceipt(receiptId);
      setSelectedReceipt(detail);
      setIsCreating(false);
      setSelectedDocumentId("");
      setAppliedAmount(0);
      setApplicationNotes("");
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar el detalle del recibo."
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReceipt(event: FormEvent) {
    event.preventDefault();
    if (!selectedCustomerId || receiptTotalAmount <= 0) {
      setFeedback({ tone: "warning", message: "Selecciona un cliente y define un monto valido." });
      return;
    }

    try {
      setSubmitting(true);
      const receipt = await createCustomerReceipt({
        customerId: selectedCustomerId,
        totalAmount: receiptTotalAmount,
        receiptDate,
        reference: receiptReference || null,
        notes: receiptNotes || null
      });
      setSelectedReceipt(receipt);
      setIsCreating(false);
      setFeedback({ tone: "success", message: `Recibo ${receipt.receiptNumber} creado en borrador.` });
      setReceipts(await listCustomerReceipts());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo crear el recibo."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApplyReceipt(event: FormEvent) {
    event.preventDefault();
    if (!selectedReceipt || !selectedDocumentId || appliedAmount <= 0) {
      setFeedback({ tone: "warning", message: "Selecciona un documento y un monto mayor que cero." });
      return;
    }

    try {
      setSubmitting(true);
      const updated = await applyCustomerReceipt(selectedReceipt.id, {
        accountsReceivableDocumentId: selectedDocumentId,
        appliedAmount,
        notes: applicationNotes || null
      });
      setSelectedReceipt(updated);
      setSelectedDocumentId("");
      setAppliedAmount(0);
      setApplicationNotes("");
      setFeedback({ tone: "success", message: "Aplicacion guardada correctamente." });
      setReceipts(await listCustomerReceipts());
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo guardar la aplicacion."
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostReceipt() {
    if (!selectedReceipt) return;
    if (Math.abs(selectedReceipt.appliedAmount - selectedReceipt.totalAmount) > 0.001) {
      setFeedback({
        tone: "warning",
        message: "El monto aplicado debe coincidir con el total del recibo antes de postear."
      });
      return;
    }

    try {
      setSubmitting(true);
      const posted = await postCustomerReceipt(selectedReceipt.id);
      setSelectedReceipt(posted);
      setFeedback({ tone: "success", message: `Recibo ${posted.receiptNumber} posteado correctamente.` });
      setReceipts(await listCustomerReceipts());
      setOpenDocuments(await listOpenReceivableDocuments(posted.customerId));
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo postear el recibo."
      });
    } finally {
      setSubmitting(false);
    }
  }

  function resetCreateForm() {
    setSelectedCustomerId("");
    setReceiptTotalAmount(0);
    setReceiptDate(new Date().toISOString().substring(0, 10));
    setReceiptReference("");
    setReceiptNotes("");
    setSelectedReceipt(null);
    setIsCreating(true);
    setFeedback(null);
  }

  if (loading && receipts.length === 0) {
    return <LoadingState label="Cargando recibos de clientes..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por cobrar"
        title="Recibos de clientes"
        description="Registro de cobros, aplicacion a documentos CxC y posteo transaccional de saldos pendientes."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <Button variant="primary" onClick={resetCreateForm}>
          Nuevo recibo
        </Button>
        <a className="ui-button ui-button-secondary" href="/accounts-receivable/documents">
          Documentos CxC
        </a>
        <a className="ui-button ui-button-secondary" href="/master-data/customer-receipts">
          Consulta recibos
        </a>
      </div>

      {(isCreating || selectedReceipt) && (
        <Card className="ui-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", alignItems: "center" }}>
            <h3>{isCreating ? "Crear recibo en borrador" : `Detalle ${selectedReceipt?.receiptNumber}`}</h3>
            <Button
              variant="secondary"
              onClick={() => {
                setIsCreating(false);
                setSelectedReceipt(null);
                setFeedback(null);
              }}
            >
              Cerrar
            </Button>
          </div>

          {isCreating ? (
            <form onSubmit={handleCreateReceipt}>
              <FormSection title="Datos del recibo">
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

                  <FormField label="Monto del recibo" required>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={receiptTotalAmount || ""}
                      onChange={(event) => setReceiptTotalAmount(Number(event.target.value) || 0)}
                      required
                    />
                  </FormField>
                </div>

                <div className="grid-2">
                  <FormField label="Fecha" required>
                    <Input
                      type="date"
                      value={receiptDate}
                      onChange={(event) => setReceiptDate(event.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Referencia">
                    <Input value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} />
                  </FormField>
                </div>

                <FormField label="Notas">
                  <Textarea value={receiptNotes} onChange={(event) => setReceiptNotes(event.target.value)} />
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
            selectedReceipt && (
              <div className="page-stack">
                <div className="metric-grid">
                  <Card className="metric-card">
                    <span>Total recibo</span>
                    <strong>RD$ {formatMoney(selectedReceipt.totalAmount)}</strong>
                    <small>{selectedReceipt.receiptNumber}</small>
                  </Card>
                  <Card className="metric-card">
                    <span>Aplicado</span>
                    <strong>RD$ {formatMoney(selectedReceipt.appliedAmount)}</strong>
                    <small>{selectedReceipt.applicationCount} aplicaciones</small>
                  </Card>
                  <Card className="metric-card">
                    <span>Sin aplicar</span>
                    <strong>RD$ {formatMoney(selectedReceipt.unappliedAmount)}</strong>
                    <small>Debe quedar en cero para postear</small>
                  </Card>
                  <Card className="metric-card">
                    <span>Estado</span>
                    <strong>
                      <Badge tone={statusTone(selectedReceipt.status)}>{statusLabel(selectedReceipt.status)}</Badge>
                    </strong>
                    <small>{selectedReceipt.customerName}</small>
                  </Card>
                </div>

                {selectedReceipt.status === "DRAFT" && (
                  <form onSubmit={handleApplyReceipt}>
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
                                    const maxAmount = Math.min(nextDocument.remainingAmount, selectedReceipt.unappliedAmount);
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
                            <Input
                              value={applicationNotes}
                              onChange={(event) => setApplicationNotes(event.target.value)}
                            />
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
                      {selectedReceipt.applications.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                            No hay aplicaciones registradas.
                          </td>
                        </tr>
                      ) : (
                        selectedReceipt.applications.map((application) => (
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

                {selectedReceipt.status === "DRAFT" && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" onClick={handlePostReceipt} disabled={submitting}>
                      {submitting ? "Posteando..." : "Postear recibo"}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}
        </Card>
      )}

      {!isCreating && !selectedReceipt && (
        <Card className="ui-card">
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Recibo</th>
                  <th style={{ textAlign: "left" }}>Cliente</th>
                  <th style={{ textAlign: "center" }}>Fecha</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                  <th style={{ textAlign: "right" }}>Aplicado</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                  <th style={{ textAlign: "center" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No hay recibos registrados.
                    </td>
                  </tr>
                ) : (
                  receipts.map((receipt) => (
                    <tr key={receipt.id}>
                      <td style={{ textAlign: "left" }}>{receipt.receiptNumber}</td>
                      <td style={{ textAlign: "left" }}>
                        {receipt.customerName} ({receipt.customerCode})
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {new Date(receipt.receiptDate).toLocaleDateString("es-DO")}
                      </td>
                      <td style={{ textAlign: "right" }}>RD$ {formatMoney(receipt.totalAmount)}</td>
                      <td style={{ textAlign: "right" }}>RD$ {formatMoney(receipt.appliedAmount)}</td>
                      <td style={{ textAlign: "center" }}>
                        <Badge tone={statusTone(receipt.status)}>{statusLabel(receipt.status)}</Badge>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Button variant="secondary" onClick={() => selectReceipt(receipt.id)}>
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
