import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addPhysicalCountLine,
  completePhysicalCount,
  createPhysicalCount,
  createPhysicalCountAdjustment,
  loadInventoryOptions,
  loadInventorySnapshots,
  optionLabel,
  recordNumber,
  type InventoryAdjustment,
  type PhysicalCount,
  type PhysicalCountLine
} from "../services/inventoryOperationsClient.js";

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

export function InventoryPhysicalCountsPreview() {
  const [items, setItems] = useState<LookupOption[]>([]);
  const [warehouses, setWarehouses] = useState<LookupOption[]>([]);
  const [stocks, setStocks] = useState<CatalogRecord[]>([]);
  const [movements, setMovements] = useState<CatalogRecord[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [itemId, setItemId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [countedQuantity, setCountedQuantity] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [lineNotes, setLineNotes] = useState("");
  const [physicalCount, setPhysicalCount] = useState<PhysicalCount | null>(null);
  const [lines, setLines] = useState<PhysicalCountLine[]>([]);
  const [generatedAdjustment, setGeneratedAdjustment] = useState<InventoryAdjustment | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apiConnected = items.length > 0 && warehouses.length > 0;
  const selectedWarehouseLabel = useMemo(() => optionLabel(warehouses, warehouseId), [warehouseId, warehouses]);
  const selectedItemLabel = useMemo(() => optionLabel(items, itemId), [itemId, items]);
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

  useEffect(() => {
    if (selectedStock && !physicalCount) {
      setCountedQuantity(recordNumber(selectedStock, "quantityOnHand"));
      setUnitCost(recordNumber(selectedStock, "averageCost"));
    }
  }, [physicalCount, selectedStock]);

  async function handleCreateCount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    setGeneratedAdjustment(null);
    setLines([]);

    try {
      const count = await createPhysicalCount({
        warehouseId,
        reference: reference || null,
        notes: notes || null
      });
      setPhysicalCount(count);
      setFeedback({ tone: "success", message: `Conteo ${count.countNumber} creado en DRAFT.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear el conteo." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!physicalCount) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const line = await addPhysicalCountLine(physicalCount.id, {
        itemId,
        countedQuantity,
        unitCost,
        notes: lineNotes || null
      });
      setLines((current) => [...current, line]);
      setFeedback({ tone: "success", message: `Linea ${line.lineNumber} agregada al conteo.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo agregar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteCount() {
    if (!physicalCount) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const completed = await completePhysicalCount(physicalCount.id);
      setPhysicalCount(completed);
      setFeedback({ tone: "success", message: `Conteo ${completed.countNumber} completado.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo completar el conteo." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAdjustment() {
    if (!physicalCount) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await createPhysicalCountAdjustment(physicalCount.id);
      setPhysicalCount(result.physicalCount);
      setGeneratedAdjustment(result.adjustment);
      setFeedback({
        tone: "success",
        message: `Ajuste ${result.adjustment.movementNumber} generado en DRAFT desde conteo.`
      });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo generar el ajuste." });
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
        description="Crea un conteo, registra lineas, completalo y genera el ajuste resultante en borrador."
        eyebrow="Inventario"
        title="Conteos fisicos"
      />

      {loading ? <LoadingState label="Conectando con inventario..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No se pudieron cargar articulos y almacenes desde la API." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Crear conteo</h2>
              <p>Selecciona almacen y abre un conteo fisico en DRAFT.</p>
            </div>
            <Badge tone={physicalCount ? "green" : "blue"}>{physicalCount?.status ?? "Nuevo"}</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreateCount}>
            <label>
              <span>Almacen</span>
              <Select disabled={Boolean(physicalCount)} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} required>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.value} value={warehouse.value}>
                    {warehouse.code ? `${warehouse.code} - ${warehouse.label}` : warehouse.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Referencia</span>
              <Input disabled={Boolean(physicalCount)} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Conteo operativo" />
            </label>
            <label>
              <span>Notas</span>
              <Textarea disabled={Boolean(physicalCount)} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Detalle interno" />
            </label>
            <Button disabled={saving || !apiConnected || !warehouseId || Boolean(physicalCount)} type="submit">
              Crear conteo
            </Button>
          </form>
        </Card>

        <Card>
          <div className="panel-heading">
            <div>
              <h2>Linea de conteo</h2>
              <p>Registra la cantidad contada para un articulo.</p>
            </div>
            <Badge tone="blue">{selectedWarehouseLabel}</Badge>
          </div>
          <form className="operation-form" onSubmit={handleAddLine}>
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
            <div className="operation-form-row">
              <label>
                <span>Cantidad contada</span>
                <Input min="0" step="0.000001" type="number" value={countedQuantity} onChange={(event) => setCountedQuantity(Number(event.target.value))} />
              </label>
              <label>
                <span>Costo</span>
                <Input min="0" step="0.000001" type="number" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} />
              </label>
            </div>
            <label>
              <span>Notas linea</span>
              <Input value={lineNotes} onChange={(event) => setLineNotes(event.target.value)} placeholder="Conteo operativo" />
            </label>
            <Button disabled={saving || physicalCount?.status !== "DRAFT" || !itemId} type="submit">
              Agregar linea
            </Button>
          </form>
          {selectedStock ? (
            <Alert tone="info" title="Snapshot esperado">
              {selectedItemLabel}: {formatNumber(selectedStock.quantityOnHand)} unidades en existencia.
            </Alert>
          ) : null}
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Conteo activo</h2>
              <p>Completa el conteo antes de generar el ajuste.</p>
            </div>
            <Badge tone={physicalCount?.status === "ADJUSTMENT_CREATED" ? "green" : "amber"}>
              {physicalCount?.status ?? "Sin conteo"}
            </Badge>
          </div>
          {physicalCount ? (
            <div className="operation-summary">
              <strong>{physicalCount.countNumber}</strong>
              <span>Almacen: {selectedWarehouseLabel}</span>
              <span>Lineas: {physicalCount.lineCount || lines.length}</span>
              <span>Diferencia: {formatNumber(physicalCount.totalDifferenceQuantity)}</span>
              <div className="operation-button-row">
                <Button disabled={saving || physicalCount.status !== "DRAFT" || lines.length < 1} onClick={handleCompleteCount} type="button">
                  Completar conteo
                </Button>
                <Button disabled={saving || physicalCount.status !== "COMPLETED"} onClick={handleCreateAdjustment} type="button">
                  Generar ajuste DRAFT
                </Button>
              </div>
            </div>
          ) : (
            <div className="operation-summary">
              <Alert tone="warning">Crea un conteo para habilitar el flujo.</Alert>
              <div className="operation-button-row">
                <Button disabled onClick={handleCompleteCount} type="button">
                  Completar conteo
                </Button>
                <Button disabled onClick={handleCreateAdjustment} type="button">
                  Generar ajuste DRAFT
                </Button>
              </div>
            </div>
          )}
          {generatedAdjustment ? (
            <Alert tone="success" title="Ajuste generado">
              {generatedAdjustment.movementNumber} quedo en {generatedAdjustment.status}.
            </Alert>
          ) : null}
        </Card>

        <Card>
          <h2>Lineas capturadas</h2>
          <Table
            columns={["Linea", "Articulo", "Snapshot", "Contado", "Diferencia"]}
            rows={lines.map((line) => [
              line.lineNumber,
              selectedItemLabel,
              formatNumber(line.snapshotQuantity),
              formatNumber(line.countedQuantity),
              formatNumber(line.differenceQuantity)
            ])}
          />
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
