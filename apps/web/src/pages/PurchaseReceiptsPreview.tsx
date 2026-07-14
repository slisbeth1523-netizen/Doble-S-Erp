import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea, FormField, FormSection } from "../components/ui/index.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addPurchaseReceiptLine,
  completePurchaseReceipt,
  createPurchaseReceipt,
  getPurchaseOrder,
  listApprovedPurchaseOrders,
  loadPurchaseReceiptSnapshots,
  recordNumber,
  type PurchaseReceipt
} from "../services/purchaseReceiptsClient.js";
import { statusLabel } from "../utils/displayLabels.js";
import type { PurchaseOrder, PurchaseOrderLine } from "../services/purchaseOrdersClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function statusTone(status?: string) {
  return status === "POSTED" ? "green" : "amber";
}

export function PurchaseReceiptsPreview() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [selectedLineId, setSelectedLineId] = useState("");
  const [receiptDate, setReceiptDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [quantityReceived, setQuantityReceived] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [createdReceipt, setCreatedReceipt] = useState<PurchaseReceipt | null>(null);
  const [receipts, setReceipts] = useState<CatalogRecord[]>([]);
  const [lines, setLines] = useState<CatalogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedLine = useMemo(
    () => selectedOrder?.lines?.find((line) => line.id === selectedLineId),
    [selectedLineId, selectedOrder]
  );
  const apiConnected = orders.length > 0;
  const canAddLine = Boolean(createdReceipt && selectedLineId && quantityReceived > 0 && createdReceipt.status === "DRAFT");
  const canPost = Boolean(createdReceipt && createdReceipt.status === "DRAFT" && createdReceipt.lineCount > 0);

  async function refreshSnapshots() {
    const snapshot = await loadPurchaseReceiptSnapshots();
    setReceipts(snapshot.receipts);
    setLines(snapshot.lines);
  }

  async function loadOrder(orderId: string) {
    const order = await getPurchaseOrder(orderId);
    setSelectedOrder(order);
    const firstLine = order.lines?.[0] as PurchaseOrderLine | undefined;
    setSelectedLineId(firstLine?.id ?? "");
    setQuantityReceived(Number(firstLine?.quantity ?? 1));
    setUnitCost(Number(firstLine?.unitCost ?? 0));
  }

  useEffect(() => {
    let active = true;

    Promise.all([listApprovedPurchaseOrders(), loadPurchaseReceiptSnapshots()])
      .then(async ([approvedOrders, snapshot]) => {
        if (!active) {
          return;
        }

        setOrders(approvedOrders);
        setReceipts(snapshot.receipts);
        setLines(snapshot.lines);

        const firstOrder = approvedOrders[0];
        if (firstOrder) {
          await loadOrder(firstOrder.id);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo conectar la API." });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleOrderChange(orderId: string) {
    setFeedback(null);
    setCreatedReceipt(null);
    await loadOrder(orderId);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const receipt = await createPurchaseReceipt({
        purchaseOrderId: selectedOrder.id,
        receiptDate: receiptDate ? new Date(receiptDate).toISOString() : null,
        reference: reference || null,
        notes: notes || null
      });
      setCreatedReceipt(receipt);
      setFeedback({ tone: "success", message: `Recepción ${receipt.purchaseReceiptNumber} creada en borrador.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la recepción." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine() {
    if (!createdReceipt || !selectedLine) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const receipt = await addPurchaseReceiptLine(createdReceipt.id, {
        purchaseOrderLineId: selectedLine.id,
        quantityReceived,
        unitCost,
        notes: "Linea recibida desde UI minima"
      });
      setCreatedReceipt(receipt);
      setFeedback({ tone: "success", message: "Línea agregada a la recepción." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo agregar la línea." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePost() {
    if (!createdReceipt) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const receipt = await completePurchaseReceipt(createdReceipt.id);
      setCreatedReceipt(receipt);
      setFeedback({ tone: "success", message: `Recepción posteada con movimiento ${receipt.movementNumber ?? ""}.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear la recepción." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack inventory-operations-page">
      <PageHeader
        actions={
          <div className="runtime-page-actions">
            <Badge tone={apiConnected ? "green" : "amber"}>{apiConnected ? "API conectada" : "Sin órdenes aprobadas"}</Badge>
            <Button onClick={() => navigate("/purchasing/purchase-orders")} type="button" variant="secondary">
              Órdenes de compra
            </Button>
            <Button onClick={() => navigate("/master-data/purchase-receipts")} type="button" variant="secondary">
              Consulta recepciones
            </Button>
            <Button onClick={() => navigate("/master-data/inventory-stocks")} type="button" variant="secondary">
              Existencias
            </Button>
            <Button onClick={() => navigate("/master-data/inventory-ledger")} type="button" variant="secondary">
              Kardex
            </Button>
          </div>
        }
        description="Registra la recepción física de artículos asociados a órdenes de compra."
        eyebrow="Compras"
        title="Recepciones de compra"
      />

      {loading ? <LoadingState label="Conectando con compras..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No hay órdenes aprobadas disponibles para recibir." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Nueva recepción</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>Prepara el documento de recepción para ingresar stock.</p>
            </div>
            <Badge tone="blue">Borrador</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreate}>
            <FormSection title="1. Seleccionar orden" description="Elige una orden de compra previamente aprobada.">
              <FormField label="Orden aprobada" required>
                <Select value={selectedOrder?.id ?? ""} onChange={(event) => void handleOrderChange(event.target.value)} required>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.purchaseOrderNumber} - {order.supplierName}
                    </option>
                  ))}
                </Select>
              </FormField>
            </FormSection>

            <FormSection title="2. Revisar proveedor y almacén" description="Información pre-cargada del proveedor y destino de la orden.">
              {selectedOrder ? (
                <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: "12px 16px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                  <div><span style={{ color: "var(--muted)" }}>Proveedor:</span> <strong>{selectedOrder.supplierName}</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Almacén destino principal:</span> <strong>{selectedOrder.lines?.[0]?.warehouseCode || "No especificado"}</strong></div>
                </div>
              ) : (
                <Alert tone="warning">Selecciona una orden de compra para previsualizar los detalles.</Alert>
              )}
            </FormSection>

            <FormSection title="3. Detalles de recepción" description="Establece la fecha física de llegada y la referencia.">
              <FormField label="Fecha de recepción">
                <Input type="datetime-local" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
              </FormField>
              <FormField label="Referencia / Conduce">
                <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="REC-001 conduce" />
              </FormField>
              <FormField label="Notas">
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalles de la entrega física o transportista..." />
              </FormField>
            </FormSection>

            <div style={{ marginTop: "16px" }}>
              <Button disabled={saving || !apiConnected || !selectedOrder} type="submit" variant="primary">
                {saving ? "Creando..." : "Crear recepción borrador"}
              </Button>
            </div>
          </form>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="panel-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Líneas y Procesamiento</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>Agrega las unidades físicas que están ingresando al almacén.</p>
              </div>
              <Badge tone={statusTone(createdReceipt?.status)}>{createdReceipt ? statusLabel(createdReceipt.status) : "Sin recepción"}</Badge>
            </div>

            <div className="operation-form">
              <FormSection title="4. Confirmar artículos pendientes & cantidades" description="Elige la línea de la orden e ingresa la cantidad recibida.">
                <FormField label="Línea de la orden" required>
                  <Select value={selectedLineId} onChange={(event) => setSelectedLineId(event.target.value)} required>
                    {(selectedOrder?.lines ?? []).map((line) => (
                      <option key={line.id} value={line.id}>
                        {line.itemCode} - {line.warehouseCode} - Ordenada: {formatNumber(line.quantity)}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <div className="grid-2">
                  <FormField label="Cantidad recibida" required>
                    <Input min="0.000001" step="0.000001" type="number" value={quantityReceived} onChange={(event) => setQuantityReceived(Number(event.target.value))} required />
                  </FormField>
                  <FormField label="Costo unitario" required>
                    <Input min="0" step="0.000001" type="number" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} required />
                  </FormField>
                </div>
                <div style={{ marginTop: "8px" }}>
                  <Button disabled={saving || !canAddLine} onClick={handleAddLine} type="button" variant="secondary" style={{ width: "100%" }}>
                    Agregar línea a recepción
                  </Button>
                </div>
              </FormSection>

              {createdReceipt ? (
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", marginTop: "16px" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "12px" }}>5. Revisar diferencias / Resumen</h3>
                  <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: "16px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
                    <div><span style={{ color: "var(--muted)" }}>Número de Recepción:</span> <strong>{createdReceipt.purchaseReceiptNumber}</strong></div>
                    <div><span style={{ color: "var(--muted)" }}>Cantidad de líneas cargadas:</span> <strong>{createdReceipt.lineCount}</strong></div>
                    <div><span style={{ color: "var(--muted)" }}>Total unidades recibidas:</span> <strong>{formatNumber(createdReceipt.totalQuantityReceived)}</strong></div>
                  </div>

                  <div style={{ marginTop: "20px" }}>
                    <Button disabled={saving || !canPost} onClick={handlePost} type="button" variant="primary" style={{ width: "100%" }}>
                      6. Completar y postear recepción
                    </Button>
                  </div>
                </div>
              ) : (
                <Alert tone="warning">Crea una recepción para habilitar la carga de líneas e ingreso al inventario.</Alert>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Recepciones de compra recientes</h2>
          <Table
            columns={["Recepción", "Orden", "Estado", "Cantidad"]}
            emptyText="No hay recepciones de compra registradas."
            rows={receipts.map((receipt) => [
              String(receipt.purchaseReceiptNumber ?? receipt.code ?? ""),
              String(receipt.purchaseOrderNumber ?? ""),
              <div style={{ textAlign: "center", width: "100%" }}><Badge tone={statusTone(String(receipt.status ?? ""))}>{statusLabel(receipt.status)}</Badge></div>,
              <div style={{ textAlign: "right", width: "100%", fontWeight: "600" }}>{formatNumber(recordNumber(receipt, "totalQuantityReceived"))}</div>
            ])}
          />
        </Card>
        <Card>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Líneas de la recepción recientes</h2>
          <Table
            columns={["Recepción", "Artículo", "Almacén", "Cantidad"]}
            emptyText="No existen líneas en este documento."
            rows={lines.map((line) => [
              String(line.purchaseReceiptNumber ?? line.code ?? ""),
              String(line.itemCode ?? line.name ?? ""),
              <div style={{ textAlign: "center", width: "100%" }}>{line.warehouseCode ?? ""}</div>,
              <div style={{ textAlign: "right", width: "100%" }}>{formatNumber(recordNumber(line, "quantityReceived"))}</div>
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
