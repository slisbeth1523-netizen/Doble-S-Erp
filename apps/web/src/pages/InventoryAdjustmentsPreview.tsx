import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
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
      setFeedback({ tone: "success", message: `Ajuste ${adjustment.movementNumber} creado en DRAFT.` });
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
        description="Crea ajustes básicos y postealos con el motor existente de movimientos."
        eyebrow="Inventario"
        title="Ajustes"
      />

      {loading ? <LoadingState label="Conectando con inventario..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No se pudieron cargar articulos y almacenes desde la API." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Crear ajuste</h2>
              <p>Una linea por operacion para validar el flujo base.</p>
            </div>
            <Badge tone="blue">DRAFT</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreate}>
            <label>
              <span>Tipo</span>
              <Select value={movementType} onChange={(event) => setMovementType(event.target.value as InventoryMovementType)}>
                <option value="ADJUSTMENT_IN">Entrada</option>
                <option value="ADJUSTMENT_OUT">Salida</option>
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
              <span>Almacen</span>
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
              <span>Referencia</span>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ajuste operativo" />
            </label>
            <label>
              <span>Notas</span>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle interno" />
            </label>
            <Button disabled={saving || !apiConnected || !itemId || !warehouseId || quantity <= 0} type="submit">
              Crear ajuste
            </Button>
          </form>
        </Card>

        <Card>
          <div className="panel-heading">
            <div>
              <h2>Posteo</h2>
              <p>El stock solo cambia al postear el movimiento.</p>
            </div>
            <Badge tone={createdAdjustment?.status === "POSTED" ? "green" : "amber"}>
              {createdAdjustment?.status ?? "Sin ajuste"}
            </Badge>
          </div>
          {createdAdjustment ? (
            <div className="operation-summary">
              <strong>{createdAdjustment.movementNumber}</strong>
              <span>{createdAdjustment.movementType}</span>
              <span>Cantidad: {formatNumber(createdAdjustment.totalQuantity)}</span>
              <span>Costo total: {formatNumber(createdAdjustment.totalCost)}</span>
              <Button disabled={saving || !canPost} onClick={handlePost} type="button">
                Postear ajuste
              </Button>
            </div>
          ) : (
            <div className="operation-summary">
              <Alert tone="warning">Crea un ajuste para habilitar el posteo.</Alert>
              <Button disabled onClick={handlePost} type="button">
                Postear ajuste
              </Button>
            </div>
          )}
          {selectedStock ? (
            <Alert tone="info" title="Existencia seleccionada">
              {String(selectedStock.itemCode)} en {String(selectedStock.warehouseCode)}: {formatNumber(selectedStock.quantityOnHand)} unidades.
            </Alert>
          ) : null}
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <h2>Existencias</h2>
          <Table
            columns={["Articulo", "Almacen", "Existencia", "Disponible"]}
            rows={stocks.map((stock) => [
              String(stock.itemCode ?? stock.code ?? ""),
              String(stock.warehouseCode ?? stock.name ?? ""),
              formatNumber(recordNumber(stock, "quantityOnHand")),
              formatNumber(recordNumber(stock, "quantityAvailable"))
            ])}
          />
        </Card>
        <Card>
          <h2>Movimientos recientes</h2>
          <Table
            columns={["Movimiento", "Tipo", "Estado", "Cantidad"]}
            rows={movements.map((movement) => [
              String(movement.movementNumber ?? movement.code ?? ""),
              String(movement.movementType ?? ""),
              <Badge tone={movement.status === "POSTED" ? "green" : "amber"}>{String(movement.status ?? "")}</Badge>,
              formatNumber(recordNumber(movement, "totalQuantity"))
            ])}
          />
        </Card>
      </section>
    </div>
  );
}
