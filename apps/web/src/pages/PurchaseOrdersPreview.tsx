import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  loadPurchaseOrderOptions,
  loadPurchaseOrderSnapshots,
  optionLabel,
  recordNumber,
  type PurchaseOrder
} from "../services/purchaseOrdersClient.js";

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
  if (status === "APPROVED") {
    return "green";
  }

  if (status === "CANCELLED") {
    return "red";
  }

  return "amber";
}

export function PurchaseOrdersPreview() {
  const [suppliers, setSuppliers] = useState<LookupOption[]>([]);
  const [items, setItems] = useState<LookupOption[]>([]);
  const [warehouses, setWarehouses] = useState<LookupOption[]>([]);
  const [orders, setOrders] = useState<CatalogRecord[]>([]);
  const [lines, setLines] = useState<CatalogRecord[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [expectedDate, setExpectedDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [createdOrder, setCreatedOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apiConnected = suppliers.length > 0 && items.length > 0 && warehouses.length > 0;
  const supplierLabel = useMemo(() => optionLabel(suppliers, supplierId), [supplierId, suppliers]);
  const itemLabel = useMemo(() => optionLabel(items, itemId), [itemId, items]);
  const warehouseLabel = useMemo(() => optionLabel(warehouses, warehouseId), [warehouseId, warehouses]);
  const canApprove = createdOrder?.status === "DRAFT";
  const canCancel = createdOrder?.status === "DRAFT" || createdOrder?.status === "APPROVED";

  async function refreshSnapshots() {
    const snapshot = await loadPurchaseOrderSnapshots();
    setOrders(snapshot.orders);
    setLines(snapshot.lines);
  }

  useEffect(() => {
    let active = true;

    Promise.all([loadPurchaseOrderOptions(), loadPurchaseOrderSnapshots()])
      .then(([options, snapshot]) => {
        if (!active) {
          return;
        }

        setSuppliers(options.suppliers);
        setItems(options.items);
        setWarehouses(options.warehouses);
        setOrders(snapshot.orders);
        setLines(snapshot.lines);
        setSupplierId(options.suppliers[0]?.value ?? "");
        setItemId(options.items[0]?.value ?? "");
        setWarehouseId(options.warehouses[0]?.value ?? "");
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const order = await createPurchaseOrder({
        supplierId,
        expectedDate: expectedDate || null,
        reference: reference || null,
        notes: notes || null,
        lines: [
          {
            itemId,
            warehouseId,
            quantity,
            unitCost,
            expectedDate: expectedDate || null,
            notes: "Linea creada desde UI minima"
          }
        ]
      });
      setCreatedOrder(order);
      setFeedback({ tone: "success", message: `Orden ${order.purchaseOrderNumber} creada en DRAFT.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la orden." });
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    if (!createdOrder) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const order = await approvePurchaseOrder(createdOrder.id);
      setCreatedOrder(order);
      setFeedback({ tone: "success", message: `Orden ${order.purchaseOrderNumber} aprobada.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo aprobar la orden." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!createdOrder) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const order = await cancelPurchaseOrder(createdOrder.id, "Cancelada desde UI minima");
      setCreatedOrder(order);
      setFeedback({ tone: "success", message: `Orden ${order.purchaseOrderNumber} cancelada.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cancelar la orden." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack inventory-operations-page">
      <PageHeader
        actions={
          <div className="runtime-page-actions">
            <Badge tone={apiConnected ? "green" : "amber"}>{apiConnected ? "API conectada" : "Conectando API"}</Badge>
            <Button onClick={() => navigate("/master-data/purchase-orders")} type="button" variant="secondary">
              Ordenes
            </Button>
            <Button onClick={() => navigate("/master-data/suppliers")} type="button" variant="secondary">
              Proveedores
            </Button>
          </div>
        }
        description="Crea, aprueba o cancela ordenes sin afectar inventario."
        eyebrow="Compras"
        title="Ordenes de compra"
      />

      {loading ? <LoadingState label="Conectando con compras..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No se pudieron cargar proveedores, articulos y almacenes desde la API." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Crear orden</h2>
              <p>Una linea por operacion para validar la fundacion.</p>
            </div>
            <Badge tone="blue">DRAFT</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreate}>
            <label>
              <span>Proveedor</span>
              <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
                {suppliers.map((supplier) => (
                  <option key={supplier.value} value={supplier.value}>
                    {supplier.code ? `${supplier.code} - ${supplier.label}` : supplier.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Articulo</span>
              <Select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                {items.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.code ? `${item.code} - ${item.label}` : item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Almacen destino</span>
              <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.value} value={warehouse.value}>
                    {warehouse.code ? `${warehouse.code} - ${warehouse.label}` : warehouse.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="operation-form-row">
              <label>
                <span>Cantidad</span>
                <Input min="0.000001" step="0.000001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
              </label>
              <label>
                <span>Costo</span>
                <Input min="0" step="0.000001" type="number" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} />
              </label>
            </div>
            <label>
              <span>Fecha esperada</span>
              <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
            </label>
            <label>
              <span>Referencia</span>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="OC operativa" />
            </label>
            <label>
              <span>Notas</span>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle interno" />
            </label>
            <Button disabled={saving || !apiConnected || !supplierId || !itemId || !warehouseId || quantity <= 0} type="submit">
              Crear orden
            </Button>
          </form>
        </Card>

        <Card>
          <div className="panel-heading">
            <div>
              <h2>Ciclo de orden</h2>
              <p>Aprobar o cancelar no crea recepciones ni movimientos.</p>
            </div>
            <Badge tone={statusTone(createdOrder?.status)}>{createdOrder?.status ?? "Sin orden"}</Badge>
          </div>
          {createdOrder ? (
            <div className="operation-summary">
              <strong>{createdOrder.purchaseOrderNumber}</strong>
              <span>Proveedor: {createdOrder.supplierName}</span>
              <span>Total: {formatNumber(createdOrder.totalAmount)}</span>
              <Button disabled={saving || !canApprove} onClick={handleApprove} type="button">
                Aprobar
              </Button>
              <Button disabled={saving || !canCancel} onClick={handleCancel} type="button" variant="danger">
                Cancelar
              </Button>
            </div>
          ) : (
            <Alert tone="warning">Crea una orden para habilitar acciones.</Alert>
          )}
          <Alert tone="info" title="Sin impacto de inventario">
            {supplierLabel} comprara {formatNumber(quantity)} de {itemLabel} para {warehouseLabel}.
          </Alert>
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <h2>Ordenes recientes</h2>
          <Table
            columns={["Orden", "Proveedor", "Estado", "Total"]}
            rows={orders.map((order) => [
              String(order.purchaseOrderNumber ?? order.code ?? ""),
              String(order.supplierName ?? order.name ?? ""),
              <Badge tone={statusTone(String(order.status ?? ""))}>{String(order.status ?? "")}</Badge>,
              formatNumber(recordNumber(order, "totalAmount"))
            ])}
          />
        </Card>
        <Card>
          <h2>Lineas recientes</h2>
          <Table
            columns={["Orden", "Articulo", "Almacen", "Cantidad"]}
            rows={lines.map((line) => [
              String(line.purchaseOrderNumber ?? line.code ?? ""),
              String(line.itemCode ?? line.name ?? ""),
              String(line.warehouseCode ?? ""),
              formatNumber(recordNumber(line, "quantity"))
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
