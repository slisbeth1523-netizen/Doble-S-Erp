import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
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
    minimumFractionDigits: 0
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
      setFeedback({ tone: "success", message: `Recepcion ${receipt.purchaseReceiptNumber} creada en DRAFT.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la recepcion." });
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
      setFeedback({ tone: "success", message: "Linea agregada a la recepcion." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo agregar la linea." });
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
      setFeedback({ tone: "success", message: `Recepcion posteada con movimiento ${receipt.movementNumber ?? ""}.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear la recepcion." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack inventory-operations-page">
      <PageHeader
        actions={
          <div className="runtime-page-actions">
            <Badge tone={apiConnected ? "green" : "amber"}>{apiConnected ? "API conectada" : "Sin ordenes aprobadas"}</Badge>
            <Button onClick={() => navigate("/purchasing/purchase-orders")} type="button" variant="secondary">
              Ordenes
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
        description="Recibe compras aprobadas y postea la entrada por el motor de inventario."
        eyebrow="Compras"
        title="Recepciones"
      />

      {loading ? <LoadingState label="Conectando con compras..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No hay ordenes aprobadas disponibles para recibir." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Crear recepcion</h2>
              <p>Selecciona una orden aprobada y prepara el documento.</p>
            </div>
            <Badge tone="blue">DRAFT</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreate}>
            <label>
              <span>Orden aprobada</span>
              <Select value={selectedOrder?.id ?? ""} onChange={(event) => void handleOrderChange(event.target.value)} required>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.purchaseOrderNumber} - {order.supplierName}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Fecha de recepcion</span>
              <Input type="datetime-local" value={receiptDate} onChange={(event) => setReceiptDate(event.target.value)} />
            </label>
            <label>
              <span>Referencia</span>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="REC operativa" />
            </label>
            <label>
              <span>Notas</span>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle interno" />
            </label>
            <Button disabled={saving || !apiConnected || !selectedOrder} type="submit">
              Crear recepcion
            </Button>
          </form>
        </Card>

        <Card>
          <div className="panel-heading">
            <div>
              <h2>Linea y posteo</h2>
              <p>La entrada actualiza existencias y kardex al completar.</p>
            </div>
            <Badge tone={statusTone(createdReceipt?.status)}>{createdReceipt?.status ?? "Sin recepcion"}</Badge>
          </div>
          <div className="operation-form">
            <label>
              <span>Linea de orden</span>
              <Select value={selectedLineId} onChange={(event) => setSelectedLineId(event.target.value)} required>
                {(selectedOrder?.lines ?? []).map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.itemCode} - {line.warehouseCode} - {formatNumber(line.quantity)}
                  </option>
                ))}
              </Select>
            </label>
            <div className="operation-form-row">
              <label>
                <span>Cantidad recibida</span>
                <Input min="0.000001" step="0.000001" type="number" value={quantityReceived} onChange={(event) => setQuantityReceived(Number(event.target.value))} />
              </label>
              <label>
                <span>Costo</span>
                <Input min="0" step="0.000001" type="number" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} />
              </label>
            </div>
            <Button disabled={saving || !canAddLine} onClick={handleAddLine} type="button">
              Agregar linea
            </Button>
            <Button disabled={saving || !canPost} onClick={handlePost} type="button">
              Completar y postear
            </Button>
          </div>
          {createdReceipt ? (
            <Alert tone="info" title={createdReceipt.purchaseReceiptNumber}>
              {createdReceipt.lineCount} linea(s), {formatNumber(createdReceipt.totalQuantityReceived)} recibidas.
            </Alert>
          ) : null}
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <h2>Recepciones recientes</h2>
          <Table
            columns={["Recepcion", "Orden", "Estado", "Cantidad"]}
            rows={receipts.map((receipt) => [
              String(receipt.purchaseReceiptNumber ?? receipt.code ?? ""),
              String(receipt.purchaseOrderNumber ?? ""),
              <Badge tone={statusTone(String(receipt.status ?? ""))}>{String(receipt.status ?? "")}</Badge>,
              formatNumber(recordNumber(receipt, "totalQuantityReceived"))
            ])}
          />
        </Card>
        <Card>
          <h2>Lineas recientes</h2>
          <Table
            columns={["Recepcion", "Articulo", "Almacen", "Cantidad"]}
            rows={lines.map((line) => [
              String(line.purchaseReceiptNumber ?? line.code ?? ""),
              String(line.itemCode ?? line.name ?? ""),
              String(line.warehouseCode ?? ""),
              formatNumber(recordNumber(line, "quantityReceived"))
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
