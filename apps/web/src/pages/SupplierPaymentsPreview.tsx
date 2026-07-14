import { type FormEvent, useEffect, useState, useMemo } from "react";
import { Alert, Badge, Button, Card, Input, LoadingState, PageHeader, Select, Textarea, FormField, FormSection, FilterBar } from "../components/ui/index.js";
import {
  listSupplierPayments,
  getSupplierPayment,
  createSupplierPayment,
  applyPayment,
  removeApplication,
  postPayment,
  listOpenDocuments,
  listSuppliers,
  type SupplierPayment,
  type SupplierPaymentApplication,
  type AccountsPayableDocument,
  type SupplierPaymentStatus
} from "../services/supplierPaymentsClient.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

export function SupplierPaymentsPreview() {
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [suppliers, setSuppliers] = useState<CatalogRecord[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<SupplierPayment | null>(null);
  const [isTogglerOpen, setIsTogglerOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    proveedor: true,
    fecha: true,
    total: true,
    aplicado: true,
    estado: true,
    referencia: false
  });
  
  // Create payment inputs
  const [isCreating, setIsCreating] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [paymentTotalAmount, setPaymentTotalAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Application inputs
  const [openDocuments, setOpenDocuments] = useState<AccountsPayableDocument[]>([]);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [appliedAmount, setAppliedAmount] = useState(0);
  const [appNotes, setAppNotes] = useState("");

  // Loading and feedback states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Load initial data
  async function loadInitialData() {
    try {
      setLoading(true);
      const [paymentsList, suppliersList] = await Promise.all([
        listSupplierPayments(),
        listSuppliers()
      ]);
      setPayments(paymentsList);
      setSuppliers(suppliersList);
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al cargar datos iniciales."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInitialData();
  }, []);

  // When a supplier is selected for a new payment, load their open documents
  useEffect(() => {
    if (!selectedSupplierId) {
      setOpenDocuments([]);
      return;
    }
    listOpenDocuments(selectedSupplierId)
      .then(setOpenDocuments)
      .catch((err) => {
        setFeedback({
          tone: "error",
          message: err instanceof Error ? err.message : "Error al cargar documentos pendientes."
        });
      });
  }, [selectedSupplierId]);

  // When payment details are loaded, also load open documents for application dropdown
  useEffect(() => {
    if (!selectedPayment || selectedPayment.Status !== "DRAFT") {
      setOpenDocuments([]);
      return;
    }
    listOpenDocuments(selectedPayment.SupplierId)
      .then(setOpenDocuments)
      .catch((err) => {
        setFeedback({
          tone: "error",
          message: err instanceof Error ? err.message : "Error al cargar documentos pendientes."
        });
      });
  }, [selectedPayment]);

  // Select a payment to view details
  async function handleSelectPayment(id: string) {
    try {
      setLoading(true);
      const detail = await getSupplierPayment(id);
      setSelectedPayment(detail);
      setIsCreating(false);
      setFeedback(null);
      // Reset application inputs
      setSelectedDocId("");
      setAppliedAmount(0);
      setAppNotes("");
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al cargar detalles del pago."
      });
    } finally {
      setLoading(false);
    }
  }

  // Handle creating new payment
  async function handleCreatePayment(e: FormEvent) {
    e.preventDefault();
    if (!selectedSupplierId || paymentTotalAmount <= 0) {
      setFeedback({ tone: "warning", message: "Selecciona un proveedor y define un monto total válido." });
      return;
    }
    try {
      setSubmitting(true);
      const newPayment = await createSupplierPayment({
        supplierId: selectedSupplierId,
        totalAmount: paymentTotalAmount,
        paymentDate,
        reference: paymentReference || null,
        notes: paymentNotes || null
      });
      setFeedback({ tone: "success", message: `Pago ${newPayment.PaymentNumber} creado en borrador.` });
      
      // Update list and select the new payment
      const updatedList = await listSupplierPayments();
      setPayments(updatedList);
      setSelectedPayment(newPayment);
      setIsCreating(false);
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al registrar el pago."
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Handle adding an application line
  async function handleAddApplication(e: FormEvent) {
    e.preventDefault();
    if (!selectedPayment || !selectedDocId || appliedAmount <= 0) {
      setFeedback({ tone: "warning", message: "Seleccione un documento e ingrese un monto a aplicar mayor a cero." });
      return;
    }
    try {
      setSubmitting(true);
      const updated = await applyPayment(selectedPayment.SupplierPaymentId, {
        accountsPayableDocumentId: selectedDocId,
        appliedAmount,
        notes: appNotes || null
      });
      setSelectedPayment(updated);
      setFeedback({ tone: "success", message: "Aplicación guardada correctamente." });
      
      // Reset application inputs
      setSelectedDocId("");
      setAppliedAmount(0);
      setAppNotes("");

      // Update list
      const updatedList = await listSupplierPayments();
      setPayments(updatedList);
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al guardar la aplicación."
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Handle deleting an application line
  async function handleDeleteApplication(docId: string) {
    if (!selectedPayment) return;
    try {
      setSubmitting(true);
      const updated = await removeApplication(selectedPayment.SupplierPaymentId, docId);
      setSelectedPayment(updated);
      setFeedback({ tone: "success", message: "Aplicación de pago eliminada." });
      
      // Update list
      const updatedList = await listSupplierPayments();
      setPayments(updatedList);
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al eliminar la aplicación."
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Handle posting a payment
  async function handlePostPayment() {
    if (!selectedPayment) return;
    if (Math.abs(selectedPayment.AppliedAmountTotal - selectedPayment.TotalAmount) > 0.001) {
      setFeedback({ tone: "warning", message: "El monto total aplicado debe coincidir exactamente con el monto total del pago antes de postear." });
      return;
    }
    if (!confirm("¿Está seguro de que desea postear este pago? Esta acción no se puede deshacer y aplicará los saldos en CxP.")) {
      return;
    }
    try {
      setSubmitting(true);
      const posted = await postPayment(selectedPayment.SupplierPaymentId);
      setSelectedPayment(posted);
      setFeedback({ tone: "success", message: `Pago ${posted.PaymentNumber} posteado y aplicado de manera exitosa.` });
      
      // Update list
      const updatedList = await listSupplierPayments();
      setPayments(updatedList);
    } catch (err: unknown) {
      setFeedback({
        tone: "error",
        message: err instanceof Error ? err.message : "Error al completar el pago."
      });
    } finally {
      setSubmitting(false);
    }
  }

  const selectedDocInfo = useMemo(() => {
    return openDocuments.find((d) => d.AccountsPayableDocumentId === selectedDocId);
  }, [selectedDocId, openDocuments]);

  function formatMoney(val: unknown) {
    return Number(val ?? 0).toLocaleString("es-DO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function getStatusTone(status?: SupplierPaymentStatus) {
    switch (status) {
      case "POSTED":
        return "green";
      case "CANCELLED":
        return "red";
      case "DRAFT":
      default:
        return "amber";
    }
  }

  if (loading && payments.length === 0) {
    return <LoadingState label="Cargando pagos a proveedores..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por pagar"
        title="Pagos a Proveedores (CxP)"
        description="Emisión de comprobantes de pago, distribución de saldos y aplicación transaccional a facturas pendientes."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      {/* Detail or Creation workspace */}
      {(selectedPayment || isCreating) && (
        <div style={{ borderLeft: "4px solid var(--primary)", borderRadius: "var(--radius)" }}>
          <Card className="ui-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3>
                {isCreating ? "Registrar Nuevo Pago a Proveedor" : `Detalle de Pago: ${selectedPayment?.PaymentNumber}`}
              </h3>
              <Button
                variant="secondary"
                onClick={() => {
                  setSelectedPayment(null);
                  setIsCreating(false);
                  setFeedback(null);
                }}
              >
                Cerrar Detalle
              </Button>
            </div>

          {isCreating ? (
              <form onSubmit={handleCreatePayment}>
                <FormSection title="Registrar Nuevo Pago a Proveedor">
                  <div className="grid-2">
                    <FormField label="Proveedor" required>
                      <Select
                        value={selectedSupplierId}
                        onChange={(e) => setSelectedSupplierId(e.target.value)}
                        required
                      >
                        <option value="">Seleccione un proveedor...</option>
                        {suppliers.map((s) => (
                          <option key={String(s.id)} value={String(s.id)}>
                            {String(s.name)} ({String(s.code)})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    <FormField label="Monto Total a Pagar" required>
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={paymentTotalAmount || ""}
                        onChange={(e) => setPaymentTotalAmount(parseFloat(e.target.value) || 0)}
                        required
                      />
                    </FormField>
                  </div>

                  <div className="grid-2">
                    <FormField label="Fecha de Pago" required>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                      />
                    </FormField>

                    <FormField label="Referencia (No. Cheque / Transferencia)">
                      <Input
                        type="text"
                        placeholder="Ej. TR-00192"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField label="Notas / Justificación">
                    <Textarea
                      placeholder="Observaciones de este pago..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </FormField>

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                    <Button
                      variant="secondary"
                      onClick={() => setIsCreating(false)}
                      type="button"
                    >
                      Cancelar
                    </Button>
                    <Button variant="primary" type="submit" disabled={submitting}>
                      {submitting ? "Guardando..." : "Guardar borrador"}
                    </Button>
                  </div>
                </FormSection>
              </form>
            ) : (
              selectedPayment && (
                <div className="page-stack" style={{ gap: "24px" }}>
                  {/* Metrics header */}
                  <div className="metric-grid">
                    <Card className="metric-card">
                      <span>Monto Total del Pago</span>
                      <strong style={{ color: "var(--primary)" }}>${formatMoney(selectedPayment.TotalAmount)}</strong>
                      <small>Monto total emitido</small>
                    </Card>
                    <Card className="metric-card">
                      <span>Monto Aplicado</span>
                      <strong style={{ color: "var(--green)" }}>${formatMoney(selectedPayment.AppliedAmountTotal)}</strong>
                      <small>Saldado contra facturas</small>
                    </Card>
                    <Card className="metric-card">
                      <span>Balance Sin Aplicar</span>
                      <strong style={{ color: selectedPayment.TotalAmount - selectedPayment.AppliedAmountTotal > 0.001 ? "var(--amber)" : "var(--text)" }}>
                        ${formatMoney(selectedPayment.TotalAmount - selectedPayment.AppliedAmountTotal)}
                      </strong>
                      <small>Pendiente de distribuir</small>
                    </Card>
                    <Card className="metric-card">
                      <span>Estado del Pago</span>
                      <div style={{ marginTop: "8px" }}>
                          <Badge tone={getStatusTone(selectedPayment.Status)}>{statusLabel(selectedPayment.Status)}</Badge>
                      </div>
                      <small>Secuencia: {selectedPayment.PaymentNumber}</small>
                    </Card>
                  </div>

                  <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius)", padding: "20px", border: "1px solid var(--border)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>Información del Proveedor</h4>
                      <p style={{ margin: "6px 0", fontSize: "0.9rem" }}><span style={{ color: "var(--muted)" }}>Código:</span> <strong>{selectedPayment.SupplierCode}</strong></p>
                      <p style={{ margin: "6px 0", fontSize: "0.9rem" }}><span style={{ color: "var(--muted)" }}>Nombre:</span> <strong>{selectedPayment.SupplierName}</strong></p>
                      <p style={{ margin: "6px 0", fontSize: "0.9rem" }}><span style={{ color: "var(--muted)" }}>Fecha Emisión:</span> <strong>{new Date(selectedPayment.PaymentDate).toLocaleDateString("es-DO")}</strong></p>
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 12px 0", fontSize: "1rem", fontWeight: 700, borderBottom: "1px solid var(--border)", paddingBottom: "6px" }}>Referencias</h4>
                      <p style={{ margin: "6px 0", fontSize: "0.9rem" }}><span style={{ color: "var(--muted)" }}>Referencia:</span> <strong>{selectedPayment.Reference || "N/A"}</strong></p>
                      <p style={{ margin: "6px 0", fontSize: "0.9rem" }}><span style={{ color: "var(--muted)" }}>Notas:</span> <strong>{selectedPayment.Notes || "Sin notas"}</strong></p>
                      {selectedPayment.PostedAt && (
                        <p style={{ margin: "6px 0", fontSize: "0.9rem" }}><span style={{ color: "var(--muted)" }}>Posteado el:</span> <strong>{new Date(selectedPayment.PostedAt).toLocaleString("es-DO")}</strong></p>
                      )}
                    </div>
                  </div>

                  {/* Applications section */}
                  {selectedPayment.Status === "DRAFT" && (
                    <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius)", padding: "20px", background: "var(--surface-muted)" }}>
                      <form onSubmit={handleAddApplication}>
                        <FormSection title="Aplicar a Documento de Cuenta por Pagar" description="Selecciona facturas pendientes para distribuir el monto de este pago.">
                          {openDocuments.length === 0 ? (
                            <p style={{ color: "var(--muted)", fontStyle: "italic", margin: 0 }}>
                              Este proveedor no posee documentos o facturas pendientes en cuentas por pagar (CxP).
                            </p>
                          ) : (
                            <>
                              <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                                <FormField label="Documento CxP" required>
                                  <Select
                                    value={selectedDocId}
                                    onChange={(e) => {
                                      setSelectedDocId(e.target.value);
                                      const doc = openDocuments.find((d) => d.AccountsPayableDocumentId === e.target.value);
                                      if (doc) {
                                        // Default to document remaining balance or remaining unapplied payment amount, whichever is smaller
                                        const maxPayable = Math.min(doc.RemainingAmount, selectedPayment.TotalAmount - selectedPayment.AppliedAmountTotal);
                                        setAppliedAmount(maxPayable > 0 ? maxPayable : doc.RemainingAmount);
                                      }
                                    }}
                                    required
                                  >
                                    <option value="">Seleccione documento...</option>
                                    {openDocuments.map((d) => (
                                      <option key={d.AccountsPayableDocumentId} value={d.AccountsPayableDocumentId}>
                                        {d.DocumentNumber} ({d.SourceDocumentNumber}) - Bal: ${formatMoney(d.RemainingAmount)}
                                      </option>
                                    ))}
                                  </Select>
                                </FormField>

                                <FormField label="Monto a Aplicar" required>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max={selectedDocInfo?.RemainingAmount}
                                    value={appliedAmount || ""}
                                    onChange={(e) => setAppliedAmount(parseFloat(e.target.value) || 0)}
                                    required
                                  />
                                </FormField>

                                <div style={{ display: "flex", alignSelf: "flex-end", height: "42px" }}>
                                  <Button type="submit" style={{ width: "100%" }} disabled={submitting} variant="primary">
                                    {submitting ? "Aplicando..." : "Aplicar"}
                                  </Button>
                                </div>
                              </div>

                              {selectedDocInfo && (
                                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", padding: "12px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", display: "flex", gap: "24px" }}>
                                  <p style={{ margin: 0 }}><strong>Monto Total Documento:</strong> ${formatMoney(selectedDocInfo.TotalAmount)}</p>
                                  <p style={{ margin: 0 }}><strong>Balance Pendiente:</strong> ${formatMoney(selectedDocInfo.RemainingAmount)}</p>
                                </div>
                              )}

                              <FormField label="Comentario de aplicación">
                                <Input
                                  type="text"
                                  placeholder="Ej. Abono parcial a factura..."
                                  value={appNotes}
                                  onChange={(e) => setAppNotes(e.target.value)}
                                />
                              </FormField>
                            </>
                          )}
                        </FormSection>
                      </form>
                    </div>
                  )}

                  {/* Applications list */}
                  <div>
                    <h4 style={{ marginBottom: "10px" }}>Documentos Aplicados</h4>
                    {!selectedPayment.applications || selectedPayment.applications.length === 0 ? (
                      <p style={{ color: "var(--muted)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>
                        No se han aplicado documentos a este pago.
                      </p>
                    ) : (
                      <div className="ui-table-wrap">
                        <table className="ui-table">
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left" }}>No. Documento CxP</th>
                              <th style={{ textAlign: "left" }}>Factura No.</th>
                              <th style={{ textAlign: "right" }}>Monto Aplicado</th>
                              <th style={{ textAlign: "left" }}>Notas</th>
                              {selectedPayment.Status === "DRAFT" && <th style={{ textAlign: "center" }}>Acciones</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {selectedPayment.applications.map((app) => (
                              <tr key={app.SupplierPaymentApplicationId}>
                                <td style={{ textAlign: "left" }}>{app.DocumentNumber}</td>
                                <td style={{ textAlign: "left" }}>{app.SourceDocumentNumber}</td>
                                <td style={{ textAlign: "right", fontWeight: "600" }}>${formatMoney(app.AppliedAmount)}</td>
                                <td style={{ textAlign: "left" }}>{app.Notes || "-"}</td>
                                {selectedPayment.Status === "DRAFT" && (
                                  <td style={{ textAlign: "center" }}>
                                    <Button
                                      variant="danger"
                                      onClick={() => handleDeleteApplication(app.AccountsPayableDocumentId)}
                                      disabled={submitting}
                                    >
                                      Eliminar
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Post payment action */}
                  {selectedPayment.Status === "DRAFT" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid var(--border)", paddingTop: "20px" }}>
                      <Button
                        onClick={handlePostPayment}
                        disabled={submitting || Math.abs(selectedPayment.AppliedAmountTotal - selectedPayment.TotalAmount) > 0.001}
                        style={{ paddingLeft: "32px", paddingRight: "32px" }}
                        variant="primary"
                      >
                        {submitting ? "Posteando..." : "Postear y Aplicar Pago"}
                      </Button>
                    </div>
                  )}
                </div>
              )
            )}
          </Card>
        </div>
      )}

      {/* Main List view */}
      {!selectedPayment && !isCreating && (
        <Card className="ui-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3>Historial de Pagos a Proveedores</h3>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div className="column-toggler-container">
                <button
                  className="column-toggler-btn"
                  onClick={() => setIsTogglerOpen(!isTogglerOpen)}
                  type="button"
                >
                  ⚙️ Columnas
                </button>
                {isTogglerOpen && (
                  <div className="column-toggler-dropdown">
                    <label className="column-toggler-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.proveedor}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, proveedor: e.target.checked })}
                      />
                      Proveedor
                    </label>
                    <label className="column-toggler-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.fecha}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, fecha: e.target.checked })}
                      />
                      Fecha
                    </label>
                    <label className="column-toggler-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.total}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, total: e.target.checked })}
                      />
                      Total Pago
                    </label>
                    <label className="column-toggler-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.aplicado}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, aplicado: e.target.checked })}
                      />
                      Aplicado
                    </label>
                    <label className="column-toggler-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.estado}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, estado: e.target.checked })}
                      />
                      Estado
                    </label>
                    <label className="column-toggler-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.referencia}
                        onChange={(e) => setVisibleColumns({ ...visibleColumns, referencia: e.target.checked })}
                      />
                      Referencia
                    </label>
                  </div>
                )}
              </div>

              <Button
                variant="primary"
                onClick={() => {
                  setIsCreating(true);
                  setSelectedSupplierId("");
                  setPaymentTotalAmount(0);
                  setPaymentReference("");
                  setPaymentNotes("");
                  setFeedback(null);
                }}
              >
                + Nuevo Pago
              </Button>
            </div>
          </div>

          {payments.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", margin: "40px 0" }}>
              No se han registrado pagos. Haga clic en "+ Nuevo Pago" para crear uno.
            </p>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Número de Pago</th>
                    {visibleColumns.proveedor && <th style={{ textAlign: "left" }}>Proveedor</th>}
                    {visibleColumns.fecha && <th style={{ textAlign: "center" }}>Fecha</th>}
                    {visibleColumns.total && <th style={{ textAlign: "right" }}>Total Pago</th>}
                    {visibleColumns.aplicado && <th style={{ textAlign: "right" }}>Aplicado</th>}
                    {visibleColumns.estado && <th style={{ textAlign: "center" }}>Estado</th>}
                    {visibleColumns.referencia && <th style={{ textAlign: "left" }}>Referencia</th>}
                    <th style={{ textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.SupplierPaymentId}>
                      <td style={{ textAlign: "left" }}><strong>{p.PaymentNumber}</strong></td>
                      {visibleColumns.proveedor && <td style={{ textAlign: "left" }}>{p.SupplierName} ({p.SupplierCode})</td>}
                      {visibleColumns.fecha && <td style={{ textAlign: "center" }}>{new Date(p.PaymentDate).toLocaleDateString("es-DO")}</td>}
                      {visibleColumns.total && <td style={{ textAlign: "right", fontWeight: "600" }}>${formatMoney(p.TotalAmount)}</td>}
                      {visibleColumns.aplicado && <td style={{ textAlign: "right" }}>${formatMoney(p.AppliedAmountTotal)}</td>}
                      {visibleColumns.estado && (
                        <td style={{ textAlign: "center" }}>
                            <Badge tone={getStatusTone(p.Status)}>{statusLabel(p.Status)}</Badge>
                        </td>
                      )}
                      {visibleColumns.referencia && <td style={{ textAlign: "left" }}>{p.Reference || "-"}</td>}
                      <td style={{ textAlign: "center" }}>
                        <Button
                          variant="secondary"
                          onClick={() => handleSelectPayment(p.SupplierPaymentId)}
                        >
                          Ver Detalle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
