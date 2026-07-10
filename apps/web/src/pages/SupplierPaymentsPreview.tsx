import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Textarea } from "../components/ui/index.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addSupplierPaymentApplication,
  createSupplierPayment,
  loadSupplierPaymentOptions,
  openDocumentsForSupplier,
  postSupplierPayment,
  type SupplierPayment
} from "../services/supplierPaymentsClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

function statusTone(status?: string) {
  switch (status) {
    case "POSTED":
    case "PAID":
      return "green";
    case "PARTIALLY_PAID":
      return "blue";
    case "CANCELLED":
      return "red";
    default:
      return "amber";
  }
}

export function SupplierPaymentsPreview() {
  const [suppliers, setSuppliers] = useState<LookupOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [documents, setDocuments] = useState<CatalogRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [paymentsList, setPaymentsList] = useState<CatalogRecord[]>([]);
  const [createdPayment, setCreatedPayment] = useState<SupplierPayment | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [appliedAmount, setAppliedAmount] = useState(0);
  const [applicationNotes, setApplicationNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.value === selectedSupplierId) ?? null,
    [selectedSupplierId, suppliers]
  );

  const openDocuments = useMemo(
    () => openDocumentsForSupplier(documents, selectedSupplier),
    [documents, selectedSupplier]
  );

  const selectedDocument = useMemo(
    () => openDocuments.find((document) => String(document.id) === selectedDocumentId) ?? null,
    [openDocuments, selectedDocumentId]
  );

  const canCreatePayment = Boolean(selectedSupplier && totalAmount > 0 && !createdPayment);
  const canApply = Boolean(createdPayment?.status === "DRAFT" && selectedDocument && appliedAmount > 0);
  const canPost = Boolean(createdPayment?.status === "DRAFT" && createdPayment.applicationCount > 0);

  async function refreshData() {
    const snapshot = await loadSupplierPaymentOptions();
    setSuppliers(snapshot.suppliers);
    setDocuments(snapshot.documents);
    setPaymentsList(snapshot.payments);

    if (!selectedSupplierId && snapshot.suppliers[0]) {
      setSelectedSupplierId(snapshot.suppliers[0].value);
    }
  }

  useEffect(() => {
    let active = true;

    refreshData()
      .catch((error: unknown) => {
        if (active) {
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo conectar la API." });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const firstDocument = openDocuments[0];
    setSelectedDocumentId(firstDocument ? String(firstDocument.id) : "");
    const pendingBalance = Number(firstDocument?.remainingAmount ?? 0);
    setAppliedAmount(createdPayment ? Math.min(createdPayment.unappliedAmount, pendingBalance) : pendingBalance);
  }, [openDocuments, createdPayment]);

  async function handleCreatePayment(event: FormEvent) {
    event.preventDefault();
    if (!selectedSupplier || totalAmount <= 0) return;

    setSaving(true);
    setFeedback(null);

    try {
      const payment = await createSupplierPayment({
        supplierId: selectedSupplier.value,
        paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
        totalAmount,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined
      });

      setCreatedPayment(payment);
      setFeedback({ tone: "success", message: `Pago ${payment.paymentNumber} creado en borrador. El saldo CxP sigue intacto hasta postear.` });
      await refreshData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Error al crear pago." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddApplication(event: FormEvent) {
    event.preventDefault();
    if (!createdPayment || !selectedDocument) return;

    setSaving(true);
    setFeedback(null);

    try {
      const payment = await addSupplierPaymentApplication(createdPayment.id, {
        accountsPayableDocumentId: String(selectedDocument.id),
        appliedAmount,
        notes: applicationNotes.trim() || undefined
      });

      setCreatedPayment(payment);
      setApplicationNotes("");
      setFeedback({ tone: "success", message: "Aplicacion registrada en el pago borrador." });
      await refreshData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Error al aplicar pago." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePostPayment() {
    if (!createdPayment) return;

    setSaving(true);
    setFeedback(null);

    try {
      const payment = await postSupplierPayment(createdPayment.id);
      setCreatedPayment(payment);
      setFeedback({ tone: "success", message: `Pago ${payment.paymentNumber} posteado. Los saldos CxP fueron actualizados.` });
      await refreshData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Error al postear pago." });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setCreatedPayment(null);
    setTotalAmount(0);
    setPaymentDate("");
    setReference("");
    setNotes("");
    setApplicationNotes("");
    setFeedback(null);
  }

  if (loading) {
    return <LoadingState label="Cargando pagos a proveedores..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por pagar"
        title="Pagos a Proveedores"
        description="Crea pagos en borrador, aplÃ­calos a documentos abiertos y postea la reducciÃ³n de saldos de CxP."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      {!suppliers.length && (
        <ErrorState
          title="Sin proveedores disponibles"
          message="Agrega un proveedor activo para crear pagos de cuentas por pagar."
        />
      )}

      {suppliers.length > 0 && (
        <div className="content-grid">
          <div className="ui-card">
            <form className="settings-form" onSubmit={handleCreatePayment}>
              <h2>1. Crear pago borrador</h2>

              <div className="runtime-field">
                <span>Proveedor</span>
                <Select
                  value={selectedSupplierId}
                  onChange={(event) => {
                    setSelectedSupplierId(event.target.value);
                    setCreatedPayment(null);
                  }}
                  disabled={saving || Boolean(createdPayment)}
                >
                  {suppliers.map((supplier) => (
                    <option key={supplier.value} value={supplier.value}>
                      {supplier.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="runtime-field">
                <span>Total del pago</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={totalAmount || ""}
                  onChange={(event) => setTotalAmount(Number(event.target.value))}
                  disabled={saving || Boolean(createdPayment)}
                  required
                />
              </div>

              <div className="runtime-field">
                <span>Fecha</span>
                <Input
                  type="datetime-local"
                  value={paymentDate}
                  onChange={(event) => setPaymentDate(event.target.value)}
                  disabled={saving || Boolean(createdPayment)}
                />
              </div>

              <div className="runtime-field">
                <span>Referencia</span>
                <Input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  disabled={saving || Boolean(createdPayment)}
                  placeholder="Transferencia, cheque o referencia interna"
                />
              </div>

              <div className="runtime-field">
                <span>Notas</span>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={saving || Boolean(createdPayment)}
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <Button disabled={!canCreatePayment || saving} type="submit">
                  Crear pago DRAFT
                </Button>
                <Button disabled={saving} onClick={handleReset} type="button" variant="secondary">
                  Nuevo
                </Button>
              </div>
            </form>

            {createdPayment && (
              <div style={{ marginTop: "24px" }}>
                <h2>2. Aplicar a documentos CxP</h2>
                <div className="metric-grid">
                  <Card className="metric-card">
                    <span>Pago</span>
                    <strong>{createdPayment.paymentNumber}</strong>
                    <small><Badge tone={statusTone(createdPayment.status)}>{createdPayment.status}</Badge></small>
                  </Card>
                  <Card className="metric-card">
                    <span>Sin aplicar</span>
                    <strong>${formatNumber(createdPayment.unappliedAmount)}</strong>
                    <small>Total ${formatNumber(createdPayment.totalAmount)}</small>
                  </Card>
                </div>

                <form className="settings-form" onSubmit={handleAddApplication}>
                  <div className="runtime-field">
                    <span>Documento abierto</span>
                    <Select
                      value={selectedDocumentId}
                      onChange={(event) => setSelectedDocumentId(event.target.value)}
                      disabled={saving || createdPayment.status !== "DRAFT" || openDocuments.length === 0}
                    >
                      {openDocuments.map((document) => (
                        <option key={String(document.id)} value={String(document.id)}>
                          {String(document.code)} - Balance ${formatNumber(document.remainingAmount)}
                        </option>
                      ))}
                    </Select>
                    <small>
                      <a href="/accounts-payable/documents">Ver Documentos CxP</a>
                    </small>
                  </div>

                  <div className="runtime-field">
                    <span>Monto aplicado</span>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      max={Number(selectedDocument?.remainingAmount ?? createdPayment.unappliedAmount)}
                      value={appliedAmount || ""}
                      onChange={(event) => setAppliedAmount(Number(event.target.value))}
                      disabled={saving || createdPayment.status !== "DRAFT"}
                      required
                    />
                  </div>

                  <div className="runtime-field">
                    <span>Notas de aplicacion</span>
                    <Input
                      value={applicationNotes}
                      onChange={(event) => setApplicationNotes(event.target.value)}
                      disabled={saving || createdPayment.status !== "DRAFT"}
                    />
                  </div>

                  <div className="form-actions">
                    <Button disabled={!canApply || saving} type="submit">
                      Aplicar monto
                    </Button>
                    <Button disabled={!canPost || saving} onClick={handlePostPayment} type="button">
                      Postear pago
                    </Button>
                  </div>
                </form>

                {createdPayment.applications.length > 0 && (
                  <div className="ui-table-wrap" style={{ marginTop: "16px" }}>
                    <table className="ui-table">
                      <thead>
                        <tr>
                          <th>Documento</th>
                          <th>Aplicado</th>
                          <th>Balance doc.</th>
                          <th>Estado doc.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {createdPayment.applications.map((application) => (
                          <tr key={application.id}>
                            <td>{application.documentNumber}</td>
                            <td>${formatNumber(application.appliedAmount)}</td>
                            <td>${formatNumber(application.documentRemainingAmount)}</td>
                            <td><Badge tone={statusTone(application.documentStatus)}>{application.documentStatus}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="page-stack">
            <div className="ui-card">
              <h2>Documentos abiertos</h2>
              {openDocuments.length === 0 ? (
                <p style={{ color: "var(--muted)" }}>No hay documentos abiertos para el proveedor seleccionado.</p>
              ) : (
                <div className="ui-table-wrap">
                  <table className="ui-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Balance</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openDocuments.slice(0, 8).map((document) => (
                        <tr key={String(document.id)}>
                          <td>{String(document.code)}</td>
                          <td>${formatNumber(document.remainingAmount)}</td>
                          <td><Badge tone={statusTone(document.status as string)}>{String(document.status)}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="ui-card">
              <h2>Pagos recientes</h2>
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>Pago</th>
                      <th>Total</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentsList.map((payment) => (
                      <tr key={String(payment.id)}>
                        <td>{String(payment.code)}</td>
                        <td>${formatNumber(payment.totalAmount)}</td>
                        <td><Badge tone={statusTone(payment.status as string)}>{String(payment.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: "14px" }}>
                <a href="/master-data/supplier-payments">Consulta read-only de pagos</a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
