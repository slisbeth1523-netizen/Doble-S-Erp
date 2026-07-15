import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Textarea } from "../components/ui/index.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addSupplierAdjustmentApplication,
  createSupplierAdjustment,
  loadSupplierAdjustmentOptions,
  openDocumentsForSupplier,
  postSupplierAdjustment,
  type SupplierAdjustment,
  type SupplierAdjustmentType
} from "../services/supplierAdjustmentsClient.js";
import { sourceTypeLabel, statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
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

function typeLabel(type: SupplierAdjustmentType) {
  return type === "CREDIT_NOTE" ? "Nota de credito" : "Nota de debito";
}

export function SupplierAdjustmentsPreview() {
  const [suppliers, setSuppliers] = useState<LookupOption[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [documents, setDocuments] = useState<CatalogRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [adjustmentsList, setAdjustmentsList] = useState<CatalogRecord[]>([]);
  const [createdAdjustment, setCreatedAdjustment] = useState<SupplierAdjustment | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<SupplierAdjustmentType>("CREDIT_NOTE");
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [amount, setAmount] = useState(0);
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
  const openDocuments = useMemo(() => openDocumentsForSupplier(documents, selectedSupplier), [documents, selectedSupplier]);
  const selectedDocument = useMemo(
    () => openDocuments.find((document) => String(document.id) === selectedDocumentId) ?? null,
    [openDocuments, selectedDocumentId]
  );

  const canCreate = Boolean(selectedSupplier && amount > 0 && !createdAdjustment);
  const canApply = Boolean(
    createdAdjustment?.status === "DRAFT" &&
      createdAdjustment.adjustmentType === "CREDIT_NOTE" &&
      selectedDocument &&
      appliedAmount > 0
  );
  const canPost = Boolean(
    createdAdjustment?.status === "DRAFT" &&
      (createdAdjustment.adjustmentType === "DEBIT_NOTE" || createdAdjustment.applicationCount > 0)
  );

  async function refreshData() {
    const snapshot = await loadSupplierAdjustmentOptions();
    setSuppliers(snapshot.suppliers);
    setDocuments(snapshot.documents);
    setAdjustmentsList(snapshot.adjustments);
    if (!selectedSupplierId && snapshot.suppliers[0]) {
      setSelectedSupplierId(snapshot.suppliers[0].value);
    }
  }

  useEffect(() => {
    let active = true;
    refreshData()
      .catch((error: unknown) => {
        if (active) setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo conectar la API." });
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
    setAppliedAmount(createdAdjustment ? Math.min(createdAdjustment.unappliedAmount, pendingBalance) : pendingBalance);
  }, [openDocuments, createdAdjustment]);

  async function handleCreateAdjustment(event: FormEvent) {
    event.preventDefault();
    if (!selectedSupplier || amount <= 0) return;

    setSaving(true);
    setFeedback(null);
    try {
      const adjustment = await createSupplierAdjustment({
        supplierId: selectedSupplier.value,
        adjustmentType,
        adjustmentDate: adjustmentDate ? new Date(adjustmentDate).toISOString() : undefined,
        amount,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined
      });
      setCreatedAdjustment(adjustment);
      setFeedback({ tone: "success", message: `${typeLabel(adjustment.adjustmentType)} ${adjustment.adjustmentNumber} creada en borrador.` });
      await refreshData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Error al crear nota." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddApplication(event: FormEvent) {
    event.preventDefault();
    if (!createdAdjustment || !selectedDocument) return;

    setSaving(true);
    setFeedback(null);
    try {
      const adjustment = await addSupplierAdjustmentApplication(createdAdjustment.id, {
        accountsPayableDocumentId: String(selectedDocument.id),
        appliedAmount,
        notes: applicationNotes.trim() || undefined
      });
      setCreatedAdjustment(adjustment);
      setApplicationNotes("");
      setFeedback({ tone: "success", message: "Aplicacion registrada en la nota de credito." });
      await refreshData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Error al aplicar nota." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePostAdjustment() {
    if (!createdAdjustment) return;

    setSaving(true);
    setFeedback(null);
    try {
      const adjustment = await postSupplierAdjustment(createdAdjustment.id);
      setCreatedAdjustment(adjustment);
      setFeedback({
        tone: "success",
        message:
          adjustment.adjustmentType === "CREDIT_NOTE"
            ? `Nota ${adjustment.adjustmentNumber} posteada. El saldo CxP fue reducido.`
            : `Nota ${adjustment.adjustmentNumber} posteada. CxP ${adjustment.generatedDocumentNumber ?? ""} creada.`
      });
      await refreshData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "Error al postear nota." });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setCreatedAdjustment(null);
    setAmount(0);
    setAdjustmentDate("");
    setReference("");
    setNotes("");
    setApplicationNotes("");
    setFeedback(null);
  }

  if (loading) return <LoadingState label="Cargando notas de proveedor..." />;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Cuentas por pagar"
        title="Notas de Proveedor"
        description="Registra notas de credito para reducir saldos y notas de debito para crear CxP adicional."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      {!suppliers.length && <ErrorState title="Sin proveedores disponibles" message="Agrega un proveedor activo para crear notas." />}

      {suppliers.length > 0 && (
        <div className="content-grid">
          <div className="ui-card">
            <form className="settings-form" onSubmit={handleCreateAdjustment}>
              <h2>1. Crear nota borrador</h2>

              <div className="runtime-field">
                <span>Proveedor</span>
                <Select
                  value={selectedSupplierId}
                  onChange={(event) => {
                    setSelectedSupplierId(event.target.value);
                    setCreatedAdjustment(null);
                  }}
                  disabled={saving || Boolean(createdAdjustment)}
                >
                  {suppliers.map((supplier) => (
                    <option key={supplier.value} value={supplier.value}>
                      {supplier.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="runtime-field">
                <span>Tipo</span>
                <Select
                  value={adjustmentType}
                  onChange={(event) => setAdjustmentType(event.target.value as SupplierAdjustmentType)}
                  disabled={saving || Boolean(createdAdjustment)}
                >
                  <option value="CREDIT_NOTE">Nota de credito</option>
                  <option value="DEBIT_NOTE">Nota de debito</option>
                </Select>
              </div>

              <div className="runtime-field">
                <span>Monto</span>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount || ""}
                  onChange={(event) => setAmount(Number(event.target.value))}
                  disabled={saving || Boolean(createdAdjustment)}
                  required
                />
              </div>

              <div className="runtime-field">
                <span>Fecha</span>
                <Input
                  type="datetime-local"
                  value={adjustmentDate}
                  onChange={(event) => setAdjustmentDate(event.target.value)}
                  disabled={saving || Boolean(createdAdjustment)}
                />
              </div>

              <div className="runtime-field">
                <span>Referencia</span>
                <Input value={reference} onChange={(event) => setReference(event.target.value)} disabled={saving || Boolean(createdAdjustment)} />
              </div>

              <div className="runtime-field">
                <span>Notas</span>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={saving || Boolean(createdAdjustment)} rows={3} />
              </div>

              <div className="form-actions">
                <Button disabled={!canCreate || saving} type="submit">Crear nota borrador</Button>
                <Button disabled={saving} onClick={handleReset} type="button" variant="secondary">Nueva</Button>
              </div>
            </form>

            {createdAdjustment && (
              <div style={{ marginTop: "24px" }}>
                <h2>2. Posteo</h2>
                <div className="metric-grid">
                  <Card className="metric-card">
                    <span>Nota</span>
                    <strong>{createdAdjustment.adjustmentNumber}</strong>
                    <small><Badge tone={statusTone(createdAdjustment.status)}>{statusLabel(createdAdjustment.status)}</Badge></small>
                  </Card>
                  <Card className="metric-card">
                    <span>Monto</span>
                    <strong>${formatNumber(createdAdjustment.amount)}</strong>
                    <small>{typeLabel(createdAdjustment.adjustmentType)}</small>
                  </Card>
                </div>

                {createdAdjustment.adjustmentType === "CREDIT_NOTE" && (
                  <form className="settings-form" onSubmit={handleAddApplication}>
                    <div className="runtime-field">
                      <span>Documento CxP abierto</span>
                      <Select value={selectedDocumentId} onChange={(event) => setSelectedDocumentId(event.target.value)} disabled={saving || createdAdjustment.status !== "DRAFT"}>
                        {openDocuments.map((document) => (
                          <option key={String(document.id)} value={String(document.id)}>
                            {String(document.code)} - Balance ${formatNumber(document.remainingAmount)}
                          </option>
                        ))}
                      </Select>
                      <small><a href="/accounts-payable/documents">Ver Documentos CxP</a></small>
                    </div>

                    <div className="runtime-field">
                      <span>Monto aplicado</span>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.01"
                        max={Number(selectedDocument?.remainingAmount ?? createdAdjustment.unappliedAmount)}
                        value={appliedAmount || ""}
                        onChange={(event) => setAppliedAmount(Number(event.target.value))}
                        disabled={saving || createdAdjustment.status !== "DRAFT"}
                        required
                      />
                    </div>

                    <div className="runtime-field">
                      <span>Notas de aplicacion</span>
                      <Input value={applicationNotes} onChange={(event) => setApplicationNotes(event.target.value)} disabled={saving || createdAdjustment.status !== "DRAFT"} />
                    </div>

                    <div className="form-actions">
                      <Button disabled={!canApply || saving} type="submit">Aplicar monto</Button>
                    </div>
                  </form>
                )}

                <div className="form-actions">
                  <Button disabled={!canPost || saving} onClick={handlePostAdjustment} type="button">Postear nota</Button>
                  <a href="/accounts-payable/payments">Ver Pagos</a>
                </div>

                {createdAdjustment.applications.length > 0 && (
                  <div className="ui-table-wrap" style={{ marginTop: "16px" }}>
                    <table className="ui-table">
                      <thead>
                        <tr><th>Documento</th><th>Aplicado</th><th>Balance doc.</th><th>Estado doc.</th></tr>
                      </thead>
                      <tbody>
                        {createdAdjustment.applications.map((application) => (
                          <tr key={application.id}>
                            <td>{application.documentNumber}</td>
                            <td>${formatNumber(application.appliedAmount)}</td>
                            <td>${formatNumber(application.documentRemainingAmount)}</td>
                            <td><Badge tone={statusTone(application.documentStatus)}>{statusLabel(application.documentStatus)}</Badge></td>
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
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead><tr><th>Documento</th><th>Balance</th><th>Estado</th></tr></thead>
                  <tbody>
                    {openDocuments.slice(0, 8).map((document) => (
                      <tr key={String(document.id)}>
                        <td>{String(document.code)}</td>
                        <td>${formatNumber(document.remainingAmount)}</td>
                        <td><Badge tone={statusTone(document.status as string)}>{statusLabel(document.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="ui-card">
              <h2>Notas recientes</h2>
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead><tr><th>Nota</th><th>Tipo</th><th>Monto</th><th>Estado</th></tr></thead>
                  <tbody>
                    {adjustmentsList.map((adjustment) => (
                      <tr key={String(adjustment.id)}>
                        <td>{String(adjustment.code)}</td>
                          <td>{sourceTypeLabel(adjustment.adjustmentType)}</td>
                        <td>${formatNumber(adjustment.amount)}</td>
                          <td><Badge tone={statusTone(adjustment.status as string)}>{statusLabel(adjustment.status)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ marginTop: "14px" }}><a href="/master-data/supplier-adjustments">Consulta read-only de notas</a></p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
