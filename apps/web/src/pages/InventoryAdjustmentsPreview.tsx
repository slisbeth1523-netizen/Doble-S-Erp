import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea, FormField, FormSection, FilterBar } from "../components/ui/index.js";
import {
  createInventoryAdjustment,
  loadInventoryOptions,
  loadInventorySnapshots,
  optionLabel,
  postInventoryMovement,
  recordNumber,
  type InventoryAdjustment,
  type InventoryMovementType
} from "../services/inventoryOperationsClient.js";
import { sourceTypeLabel, statusLabel } from "../utils/displayLabels.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";

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

export function InventoryAdjustmentsPreview() {
  const [items, setItems] = useState<LookupOption[]>([]);
  const [warehouses, setWarehouses] = useState<LookupOption[]>([]);
  const [stocks, setStocks] = useState<CatalogRecord[]>([]);
  const [movements, setMovements] = useState<CatalogRecord[]>([]);
  const [movementType, setMovementType] = useState<InventoryMovementType>("ADJUSTMENT_IN");
  const [itemId, setItemId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [createdAdjustment, setCreatedAdjustment] = useState<InventoryAdjustment | null>(null);
  const [postedAdjustment, setPostedAdjustment] = useState<InventoryAdjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apiConnected = items.length > 0 && warehouses.length > 0;
  const canPost = createdAdjustment?.status === "DRAFT" && !postedAdjustment;
  const selectedStock = useMemo(
    () =>
      stocks.find(
        (stock) =>
          stock.itemCode === items.find((item) => item.value === itemId)?.code &&
          stock.warehouseCode === warehouses.find((warehouse) => warehouse.value === warehouseId)?.code
      ),
    [itemId, items, stocks, warehouseId, warehouses]
  );

  async function refreshSnapshots() {
    const snapshot = await loadInventorySnapshots();
    setStocks(snapshot.stocks);
    setMovements(snapshot.movements);
  }

  useEffect(() => {
    let active = true;

    Promise.all([loadInventoryOptions(), loadInventorySnapshots()])
      .then(([options, snapshot]) => {
        if (!active) {
          return;
        }

        setItems(options.items);
        setWarehouses(options.warehouses);
        setStocks(snapshot.stocks);
        setMovements(snapshot.movements);
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
    setPostedAdjustment(null);

    try {
      const adjustment = await createInventoryAdjustment({
        movementType,
        reference: reference || null,
        notes: notes || null,
        lines: [
          {
            itemId,
            warehouseId,
            quantity,
            unitCost,
            notes: "Linea creada desde UI minima"
          }
        ]
      });
      setCreatedAdjustment(adjustment);
      setFeedback({ tone: "success", message: `Ajuste ${adjustment.movementNumber} creado en borrador.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear el ajuste." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePost() {
    if (!createdAdjustment) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const posted = await postInventoryMovement(createdAdjustment.id);
      setPostedAdjustment(posted);
      setCreatedAdjustment(posted);
      setFeedback({ tone: "success", message: `Ajuste ${posted.movementNumber} posteado.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear el ajuste." });
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
            <Button onClick={() => navigate("/master-data/inventory-stocks")} type="button" variant="secondary">
              Existencias
            </Button>
            <Button onClick={() => navigate("/master-data/inventory-movements")} type="button" variant="secondary">
              Movimientos
            </Button>
          </div>
        }
        description="Registra entradas y salidas para corregir las existencias físicas de tus artículos."
        eyebrow="Inventario"
        title="Ajustes de Inventario"
      />

      {loading ? <LoadingState label="Conectando con inventario..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No se pudieron cargar articulos y almacenes desde la API." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <form onSubmit={handleCreate}>
            <FormSection title="Crear Ajuste" description="Registra un ajuste de inventario (Borrador) para un artículo específico.">
              <FormField label="Tipo de ajuste" required>
                <Select value={movementType} onChange={(event) => setMovementType(event.target.value as InventoryMovementType)}>
                  <option value="ADJUSTMENT_IN">Entrada (+)</option>
                  <option value="ADJUSTMENT_OUT">Salida (-)</option>
                </Select>
              </FormField>

              <FormField label="Artículo" required>
                <Select value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                  {items.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.code ? `${item.code} - ${item.label}` : item.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Almacén" required>
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

              <FormField label="Referencia / NCF">
                <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ajuste operativo" />
              </FormField>

              <FormField label="Notas / Motivo">
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle interno o justificación..." />
              </FormField>

              <div style={{ marginTop: "8px" }}>
                <Button disabled={saving || !apiConnected || !itemId || !warehouseId || quantity <= 0} type="submit" variant="primary">
                  {saving ? "Creando..." : "Crear Ajuste Borrador"}
                </Button>
              </div>
            </FormSection>
          </form>
        </Card>

        <Card style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div className="panel-heading" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Posteo Definitivo</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>El stock físico solo cambiará al postear el movimiento.</p>
              </div>
              <Badge tone={createdAdjustment?.status === "POSTED" ? "green" : "amber"}>
                {createdAdjustment ? statusLabel(createdAdjustment.status) : "Sin ajuste"}
              </Badge>
            </div>

            {createdAdjustment ? (
              <div style={{ background: "var(--surface-muted)", borderRadius: "var(--radius-sm)", padding: "16px", border: "1px solid var(--border)", marginBottom: "20px", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.9rem" }}>
                <div><span style={{ color: "var(--muted)" }}>Número de Ajuste:</span> <strong>{createdAdjustment.movementNumber}</strong></div>
                <div><span style={{ color: "var(--muted)" }}>Tipo:</span> <strong>{createdAdjustment.movementType === "ADJUSTMENT_IN" ? "Entrada (+)" : "Salida (-)"}</strong></div>
                <div><span style={{ color: "var(--muted)" }}>Cantidad del Ajuste:</span> <strong>{formatNumber(createdAdjustment.totalQuantity)}</strong></div>
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "8px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>Costo Total:</span>
                  <strong style={{ fontSize: "1.1rem", color: "var(--primary)" }}>${formatNumber(createdAdjustment.totalCost)}</strong>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: "20px" }}>
                <Alert tone="warning">Crea un ajuste en borrador para habilitar el posteo definitivo.</Alert>
              </div>
            )}
          </div>

          <div>
            {createdAdjustment ? (
              <Button disabled={saving || !canPost} onClick={handlePost} type="button" variant="primary" style={{ width: "100%" }}>
                {saving ? "Posteando..." : "Postear y Aplicar Ajuste"}
              </Button>
            ) : (
              <Button disabled onClick={handlePost} type="button" variant="secondary" style={{ width: "100%" }}>
                Postear ajuste
              </Button>
            )}

            {selectedStock ? (
              <div style={{ marginTop: "16px" }}>
                <Alert tone="info" title="Existencia seleccionada">
                  {String(selectedStock.itemCode)} en {String(selectedStock.warehouseCode)}: {formatNumber(selectedStock.quantityOnHand)} unidades físicas.
                </Alert>
              </div>
            ) : null}
          </div>
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <h2 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: 700 }}>Existencias de Inventario</h2>
          {stocks.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", margin: "30px 0" }}>No hay existencias registradas.</p>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Artículo</th>
                    <th style={{ textAlign: "left" }}>Almacén</th>
                    <th style={{ textAlign: "right" }}>Existencia Física</th>
                    <th style={{ textAlign: "right" }}>Disponible</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "left" }}>{String(stock.itemCode ?? stock.code ?? "")}</td>
                      <td style={{ textAlign: "left" }}>{String(stock.warehouseCode ?? stock.name ?? "")}</td>
                      <td style={{ textAlign: "right", fontWeight: "600" }}>{formatNumber(recordNumber(stock, "quantityOnHand"))}</td>
                      <td style={{ textAlign: "right", fontWeight: "600" }}>{formatNumber(recordNumber(stock, "quantityAvailable"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 style={{ marginBottom: "16px", fontSize: "1.2rem", fontWeight: 700 }}>Movimientos Recientes</h2>
          {movements.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--muted)", margin: "30px 0" }}>No hay movimientos registrados.</p>
          ) : (
            <div className="ui-table-wrap">
              <table className="ui-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Movimiento</th>
                    <th style={{ textAlign: "center" }}>Tipo</th>
                    <th style={{ textAlign: "center" }}>Estado</th>
                    <th style={{ textAlign: "right" }}>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: "left" }}><strong>{String(movement.movementNumber ?? movement.code ?? "")}</strong></td>
                        <td style={{ textAlign: "center" }}>{sourceTypeLabel(movement.movementType)}</td>
                      <td style={{ textAlign: "center" }}>
                          <Badge tone={movement.status === "POSTED" ? "green" : "amber"}>{statusLabel(movement.status)}</Badge>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: "600" }}>{formatNumber(recordNumber(movement, "totalQuantity"))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}
