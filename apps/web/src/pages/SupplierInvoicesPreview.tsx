import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Textarea, FormField, FormSection } from "../components/ui/index.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addSupplierInvoiceLine,
  completeSupplierInvoice,
  createSupplierInvoice,
  getSupplierInvoice,
  listPostedPurchaseReceipts,
  loadSupplierInvoiceSnapshots,
  type SupplierInvoice
} from "../services/supplierInvoicesClient.js";
import { getPurchaseReceipt, type PurchaseReceipt, type PurchaseReceiptLine } from "../services/purchaseReceiptsClient.js";
import { statusLabel } from "../utils/displayLabels.js";

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
  return status === "POSTED" ? "green" : "amber";
}

export function SupplierInvoicesPreview() {
  const [receipts, setReceipts] = useState<CatalogRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);
  const [selectedLineId, setSelectedLineId] = useState("");
  
  // Header inputs
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // Line inputs
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [lineNotes, setLineNotes] = useState("");

  // States
  const [createdInvoice, setCreatedInvoice] = useState<SupplierInvoice | null>(null);
  const [invoicesList, setInvoicesList] = useState<CatalogRecord[]>([]);
  const [linesList, setLinesList] = useState<CatalogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedLine = useMemo(
    () => selectedReceipt?.lines?.find((line) => line.id === selectedLineId),
    [selectedLineId, selectedReceipt]
  );

  const apiConnected = receipts.length > 0;
  const canAddLine = Boolean(createdInvoice && selectedLineId && quantity > 0 && createdInvoice.status === "DRAFT");
  const canPost = Boolean(createdInvoice && createdInvoice.status === "DRAFT" && createdInvoice.lineCount > 0);

  async function refreshSnapshots() {
    const snapshot = await loadSupplierInvoiceSnapshots();
    setInvoicesList(snapshot.invoices);
    setLinesList(snapshot.lines);
  }

  async function loadReceipt(receiptId: string) {
    try {
      const receipt = await getPurchaseReceipt(receiptId);
      setSelectedReceipt(receipt);
      const firstLine = receipt.lines?.[0] as PurchaseReceiptLine | undefined;
      setSelectedLineId(firstLine?.id ?? "");
      setQuantity(Number(firstLine?.quantityReceived ?? 1));
      setUnitCost(Number(firstLine?.unitCost ?? 0));
      setTaxAmount(0);
    } catch (err: unknown) {
      setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Error al cargar recepción." });
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([listPostedPurchaseReceipts(), loadSupplierInvoiceSnapshots()])
      .then(async ([postedReceipts, snapshot]) => {
        if (!active) return;
        setReceipts(postedReceipts);
        setInvoicesList(snapshot.invoices);
        setLinesList(snapshot.lines);

        const firstReceipt = postedReceipts[0];
        if (firstReceipt) {
          await loadReceipt(String(firstReceipt.id));
        }
      })
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

  async function handleCreateInvoice(e: FormEvent) {
    e.preventDefault();
    if (!selectedReceipt || !invoiceNumber.trim()) return;

    setSaving(true);
    setFeedback(null);

    try {
      const invoice = await createSupplierInvoice({
        purchaseReceiptId: selectedReceipt.id,
        supplierInvoiceNumber: invoiceNumber.trim(),
        invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined
      });

      setCreatedInvoice(invoice);
      setFeedback({ tone: "success", message: `Factura ${invoice.supplierInvoiceNumber} creada en borrador.` });
      await refreshSnapshots();
    } catch (err: unknown) {
      setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Error al crear factura." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine(e: FormEvent) {
    e.preventDefault();
    if (!createdInvoice || !selectedLine) return;

    setSaving(true);
    setFeedback(null);

    try {
      const invoice = await addSupplierInvoiceLine(createdInvoice.id, {
        itemId: selectedLine.itemId,
        unitOfMeasureId: selectedLine.unitOfMeasureId,
        quantity,
        unitCost,
        taxAmount,
        notes: lineNotes.trim() || undefined
      });

      setCreatedInvoice(invoice);
      setFeedback({ tone: "success", message: "Línea agregada exitosamente." });
      setLineNotes("");
      await refreshSnapshots();
    } catch (err: unknown) {
      setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Error al agregar línea." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteInvoice() {
    if (!createdInvoice) return;

    setSaving(true);
    setFeedback(null);

    try {
      const invoice = await completeSupplierInvoice(createdInvoice.id);
      setCreatedInvoice(invoice);
      setFeedback({ tone: "success", message: `Factura ${invoice.supplierInvoiceNumber} registrada y aprobada. CxP generada.` });
      await refreshSnapshots();
    } catch (err: unknown) {
      setFeedback({ tone: "error", message: err instanceof Error ? err.message : "Error al aprobar factura." });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setCreatedInvoice(null);
    setInvoiceNumber("");
    setInvoiceDate("");
    setDueDate("");
    setReference("");
    setNotes("");
    setFeedback(null);
    if (receipts[0]) {
      loadReceipt(String(receipts[0].id));
    }
  }

  if (loading) {
    return <LoadingState label="Cargando facturas de proveedores..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Compras / Cuentas por pagar"
        title="Facturas de Proveedores (AP)"
        description="Registra facturas de proveedores y genera de forma automática sus correspondientes documentos pendientes en cuentas por pagar (CxP) a partir de recepciones físicas."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      {!apiConnected && (
        <ErrorState
          title="Sin recepciones posteadas"
          message="No existen recepciones de compra posteadas. Registra y completa una recepción de compra primero antes de facturarla."
        />
      )}

      {apiConnected && (
        <div className="content-grid">
          {/* Formulario Principal */}
          <div className="ui-card">
            {!createdInvoice ? (
              <form onSubmit={handleCreateInvoice} className="settings-form">
                <FormSection title="1. Crear Factura Proveedor (Borrador)">
                  <FormField label="Recepción física de compra base" error="" required={false}>
                    <Select
                      value={selectedReceipt?.id ?? ""}
                      onChange={(e) => loadReceipt(e.target.value)}
                      disabled={saving}
                    >
                      {receipts.map((r) => (
                        <option key={String(r.id)} value={String(r.id)}>
                          {String(r.code)} - {String(r.name)} (Total: ${formatNumber(r.totalAmount)})
                        </option>
                      ))}
                    </Select>
                    <small style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "4px", display: "block" }}>Selecciona la recepción física que respalda esta factura.</small>
                  </FormField>

                  <FormField label="Número de factura fiscal / proveedor" required>
                    <Input
                      type="text"
                      required
                      placeholder="E.g., FAC-2026-9912"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      disabled={saving}
                    />
                  </FormField>

                  <div className="grid-2">
                    <FormField label="Fecha factura">
                      <Input
                        type="datetime-local"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        disabled={saving}
                      />
                    </FormField>
                    <FormField label="Vencimiento">
                      <Input
                        type="datetime-local"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        disabled={saving}
                      />
                    </FormField>
                  </div>

                  <FormField label="Referencia / NCF">
                    <Input
                      type="text"
                      placeholder="E.g., B1100000102"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      disabled={saving}
                    />
                  </FormField>

                  <FormField label="Notas">
                    <Textarea
                      placeholder="Notas internas..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={saving}
                    />
                  </FormField>

                  <div style={{ marginTop: "8px" }}>
                    <Button type="submit" disabled={saving || !invoiceNumber.trim()} variant="primary">
                      {saving ? "Creando..." : "Crear Factura Borrador"}
                    </Button>
                  </div>
                </FormSection>
              </form>
            ) : (
              <div className="settings-form">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>Factura: {createdInvoice.supplierInvoiceNumber}</h2>
                  <Badge tone={statusTone(createdInvoice.status)}>{statusLabel(createdInvoice.status)}</Badge>
                </div>

                <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: "16px", border: "1px solid var(--border)", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
                    <div><span style={{ color: "var(--muted)" }}>Proveedor:</span> <strong>{createdInvoice.supplierName} ({createdInvoice.supplierCode})</strong></div>
                    <div><span style={{ color: "var(--muted)" }}>Recepción base:</span> <strong>{createdInvoice.purchaseReceiptNumber}</strong></div>
                    <div><span style={{ color: "var(--muted)" }}>Vence:</span> <strong>{new Date(createdInvoice.dueDate).toLocaleDateString("es-DO")}</strong></div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Monto total factura:</span>
                    <strong style={{ fontSize: "1.2rem", color: "var(--primary)" }}>${formatNumber(createdInvoice.totalAmount)}</strong>
                  </div>
                </div>

                {createdInvoice.status === "DRAFT" && (
                  <form onSubmit={handleAddLine} style={{ marginTop: "12px" }}>
                    <FormSection title="2. Agregar línea de factura">
                      <FormField label="Artículo recibido" error="" required={false}>
                        <Select
                          value={selectedLineId}
                          onChange={(e) => {
                            const id = e.target.value;
                            setSelectedLineId(id);
                            const line = selectedReceipt?.lines?.find((l) => l.id === id);
                            if (line) {
                              setQuantity(Number(line.quantityReceived));
                              setUnitCost(Number(line.unitCost));
                            }
                          }}
                          disabled={saving}
                        >
                          {selectedReceipt?.lines?.map((line) => (
                            <option key={line.id} value={line.id}>
                              {line.itemCode} - {line.itemDescription} (Recibido: {line.quantityReceived})
                            </option>
                          ))}
                        </Select>
                      </FormField>

                      <div className="grid-2">
                        <FormField label="Cantidad a facturar" required>
                          <Input
                            type="number"
                            step="any"
                            required
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            disabled={saving}
                          />
                        </FormField>
                        <FormField label="Costo unitario facturado" required>
                          <Input
                            type="number"
                            step="any"
                            required
                            value={unitCost}
                            onChange={(e) => setUnitCost(Number(e.target.value))}
                            disabled={saving}
                          />
                        </FormField>
                      </div>

                      <FormField label="Monto de impuesto (ITBIS)">
                        <Input
                          type="number"
                          step="any"
                          value={taxAmount}
                          onChange={(e) => setTaxAmount(Number(e.target.value))}
                          disabled={saving}
                        />
                      </FormField>

                      <FormField label="Comentarios línea">
                        <Input
                          type="text"
                          value={lineNotes}
                          onChange={(e) => setLineNotes(e.target.value)}
                          disabled={saving}
                        />
                      </FormField>

                      <div style={{ marginTop: "8px" }}>
                        <Button type="submit" disabled={!canAddLine || saving} variant="primary">
                          Agregar Línea
                        </Button>
                      </div>
                    </FormSection>
                  </form>
                )}

                <div style={{ display: "flex", gap: "12px", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
                  {createdInvoice.status === "DRAFT" && (
                    <Button onClick={handleCompleteInvoice} disabled={!canPost || saving} variant="primary">
                      Registrar y Aprobar Factura
                    </Button>
                  )}
                  <Button onClick={handleReset} variant="secondary">
                    Registrar nueva factura
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Visualizador de Factura Activa / Detalle de Líneas */}
          <div className="ui-card">
            <h2>Detalle de Líneas Facturadas</h2>
            {!createdInvoice || createdInvoice.lines.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--muted)", margin: "40px 0" }}>
                No hay líneas añadidas a esta factura todavía.
              </p>
            ) : (
              <div className="ui-table-wrap">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Lín</th>
                      <th style={{ textAlign: "left" }}>Artículo</th>
                      <th style={{ textAlign: "right" }}>Cantidad</th>
                      <th style={{ textAlign: "right" }}>Costo U.</th>
                      <th style={{ textAlign: "right" }}>Impuesto</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {createdInvoice.lines.map((line) => (
                      <tr key={String(line.id)}>
                        <td style={{ textAlign: "left" }}>{line.lineNumber}</td>
                        <td style={{ textAlign: "left" }}>
                          <strong>{line.itemCode}</strong>
                          <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{line.itemDescription}</div>
                        </td>
                        <td style={{ textAlign: "right" }}>{line.quantity}</td>
                        <td style={{ textAlign: "right" }}>${formatNumber(line.unitCost)}</td>
                        <td style={{ textAlign: "right" }}>${formatNumber(line.taxAmount)}</td>
                        <td style={{ textAlign: "right" }}><strong>${formatNumber(line.lineTotal)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Listados de Consulta Simplificados */}
      <div className="ui-card">
        <h2>Historial de Facturas de Proveedores (Registros en SQL Server)</h2>
        {invoicesList.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", margin: "30px 0" }}>
            No se han registrado facturas de proveedores todavía.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Factura</th>
                  <th style={{ textAlign: "left" }}>Recepción Base</th>
                  <th style={{ textAlign: "left" }}>Proveedor</th>
                  <th style={{ textAlign: "center" }}>Fecha</th>
                  <th style={{ textAlign: "right" }}>Monto Total</th>
                  <th style={{ textAlign: "center" }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {invoicesList.map((inv) => (
                  <tr
                    key={String(inv.id)}
                    onClick={async () => {
                      try {
                        const detail = await getSupplierInvoice(String(inv.id));
                        setCreatedInvoice(detail);
                        if (receipts.find((r) => String(r.id) === detail.purchaseReceiptId)) {
                          const rec = await getPurchaseReceipt(detail.purchaseReceiptId);
                          setSelectedReceipt(rec);
                        }
                        setFeedback(null);
                      } catch (err: unknown) {
                        setFeedback({ tone: "error", message: "No se pudo cargar el detalle." });
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <td style={{ textAlign: "left" }}><strong>{String(inv.code)}</strong></td>
                    <td style={{ textAlign: "left" }}>{String(inv.purchaseReceiptNumber)}</td>
                    <td style={{ textAlign: "left" }}>{String(inv.name)}</td>
                    <td style={{ textAlign: "center" }}>{inv.invoiceDate ? new Date(inv.invoiceDate as string).toLocaleDateString("es-DO") : ""}</td>
                    <td style={{ textAlign: "right" }}><strong>${formatNumber(inv.totalAmount)}</strong></td>
                    <td style={{ textAlign: "center" }}>
                      <Badge tone={statusTone(inv.status as string)}>{statusLabel(inv.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ui-card">
        <h2>Historial de Líneas de Facturas de Proveedores</h2>
        {linesList.length === 0 ? (
          <p style={{ textAlign: "center", color: "var(--muted)", margin: "30px 0" }}>
            No hay líneas de facturas registradas en la base de datos.
          </p>
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Factura</th>
                  <th style={{ textAlign: "left" }}>Lín</th>
                  <th style={{ textAlign: "left" }}>Artículo</th>
                  <th style={{ textAlign: "right" }}>Cantidad</th>
                  <th style={{ textAlign: "right" }}>Costo U.</th>
                  <th style={{ textAlign: "right" }}>Impuesto</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {linesList.map((line) => (
                  <tr key={String(line.id)}>
                    <td style={{ textAlign: "left" }}><strong>{String(line.code)}</strong></td>
                    <td style={{ textAlign: "left" }}>{String(line.lineNumber)}</td>
                    <td style={{ textAlign: "left" }}>{String(line.itemDescription)}</td>
                    <td style={{ textAlign: "right" }}>{String(line.quantity)}</td>
                    <td style={{ textAlign: "right" }}>${formatNumber(line.unitCost)}</td>
                    <td style={{ textAlign: "right" }}>${formatNumber(line.taxAmount)}</td>
                    <td style={{ textAlign: "right" }}><strong>${formatNumber(line.lineTotal)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
