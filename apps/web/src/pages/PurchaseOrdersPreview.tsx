import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea, FormField, FormSection } from "../components/ui/index.js";
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
import { statusLabel } from "../utils/displayLabels.js";

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
      setFeedback({ tone: "success", message: `Orden ${order.purchaseOrderNumber} creada en borrador.` });
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
              Órdenes de compra
            </Button>
            <Button onClick={() => navigate("/master-data/suppliers")} type="button" variant="secondary">
              Proveedores
            </Button>
          </div>
        }
        description="Registra y administra solicitudes de compra enviadas a tus proveedores."
        eyebrow="Compras"
        title="Órdenes de compra"
      />

      {loading ? <LoadingState label="Conectando con compras..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No se pudieron cargar proveedores, artículos y almacenes desde la API." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Nueva orden de compra</h2>
              <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>Prepara los artículos y condiciones de la orden.</p>
            </div>
            <Badge tone="blue">Borrador</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreate}>
            <FormSection title="1. Información de la orden" description="Fecha de entrega solicitada e identificación interna.">
              <div className="grid-2">
                <FormField label="Fecha esperada">
                  <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
                </FormField>
                <FormField label="Referencia / NCF">
                  <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="OC operativa" />
                </FormField>
              </div>
              <FormField label="Notas / Comentarios">
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle interno o justificación..." />
              </FormField>
            </FormSection>

            <FormSection title="2. Proveedor y condiciones" description="Especifica la entidad que suministrará los artículos.">
              <FormField label="Proveedor" required>
                <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} required>
                  {suppliers.map((supplier) => (
                    <option key={supplier.value} value={supplier.value}>
                      {supplier.code ? `${supplier.code} - ${supplier.label}` : supplier.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </FormSection>

            <FormSection title="3. Artículos solicitados" description="Especifica el artículo, almacén de destino y valores de compra.">
              <FormField label="Artículo" required>
                <Select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                  {items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.code ? `${item.code} - ${item.label}` : item.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Almacén destino" required>
                <Select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.value} value={warehouse.value}>
                      {warehouse.code ? `${warehouse.code} - ${warehouse.label}` : warehouse.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <div className="grid-2">
                <FormField label="Cantidad" required>
                  <Input min="0.000001" step="0.000001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
                </FormField>
                <FormField label="Costo unitario" required>
                  <Input min="0" step="0.000001" type="number" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} required />
                </FormField>
              </div>
            </FormSection>

            <div style={{ marginTop: "16px" }}>
              <Button disabled={saving || !apiConnected || !supplierId || !itemId || !warehouseId || quantity <= 0} type="submit" variant="primary">
                {saving ? "Creando..." : "Crear orden de compra"}
              </Button>
            </div>
          </form>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="panel-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>5. Revisión y Aprobación</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>Aprobar o cancelar no genera asientos contables ni entradas físicas.</p>
              </div>
              <Badge tone={statusTone(createdOrder?.status)}>{createdOrder ? statusLabel(createdOrder.status) : "Sin orden"}</Badge>
            </div>

            {createdOrder ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: "16px", border: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
                  <div><span style={{ color: "var(--muted)" }}>Número de Orden:</span> <strong>{createdOrder.purchaseOrderNumber}</strong></div>
                  <div><span style={{ color: "var(--muted)" }}>Proveedor:</span> <strong>{createdOrder.supplierName}</strong></div>
                  {createdOrder.reference && <div><span style={{ color: "var(--muted)" }}>Referencia:</span> <strong>{createdOrder.reference}</strong></div>}
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "12px" }}>4. Totales</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.9rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.05rem", fontWeight: 700 }}>
                      <span>Total de la orden</span>
                      <strong>{formatNumber(createdOrder.totalAmount)}</strong>
                    </div>
                  </div>
                </div>

                <div className="operation-summary" style={{ borderTop: "1px solid var(--border)", paddingTop: "16px", display: "flex", gap: "12px" }}>
                  <Button disabled={saving || !canApprove} onClick={handleApprove} type="button" variant="primary" style={{ flex: 1 }}>
                    6. Aprobar Orden
                  </Button>
                  <Button disabled={saving || !canCancel} onClick={handleCancel} type="button" variant="danger" style={{ flex: 1 }}>
                    6. Cancelar Orden
                  </Button>
                </div>
              </div>
            ) : (
              <Alert tone="warning">Crea una orden para habilitar las opciones de revisión y aprobación.</Alert>
            )}
          </div>

          <div style={{ marginTop: "24px" }}>
            <Alert tone="info" title="Información de Adquisición">
              {supplierLabel ? `Se solicitará al proveedor ${supplierLabel}` : "Selecciona un proveedor"} para adquirir {formatNumber(quantity)} unidad(es) de {itemLabel || "un artículo"} destinadas al almacén {warehouseLabel || "destino"}.
            </Alert>
          </div>
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Órdenes de compra recientes</h2>
          <Table
            columns={["Orden", "Proveedor", "Estado", "Total"]}
            emptyText="No hay órdenes de compra registradas."
            rows={orders.map((order) => [
              String(order.purchaseOrderNumber ?? order.code ?? ""),
              String(order.supplierName ?? order.name ?? ""),
              <div style={{ textAlign: "center", width: "100%" }}><Badge tone={statusTone(String(order.status ?? ""))}>{statusLabel(order.status)}</Badge></div>,
              <div style={{ textAlign: "right", width: "100%", fontWeight: "600" }}>{formatNumber(recordNumber(order, "totalAmount"))}</div>
            ])}
          />
        </Card>
        <Card>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Líneas de la orden recientes</h2>
          <Table
            columns={["Orden", "Artículo", "Almacén", "Cantidad"]}
            emptyText="No existen líneas en este documento."
            rows={lines.map((line) => [
              String(line.purchaseOrderNumber ?? line.code ?? ""),
              String(line.itemCode ?? line.name ?? ""),
              <div style={{ textAlign: "center", width: "100%" }}>{line.warehouseCode ?? ""}</div>,
              <div style={{ textAlign: "right", width: "100%" }}>{formatNumber(recordNumber(line, "quantity"))}</div>
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
