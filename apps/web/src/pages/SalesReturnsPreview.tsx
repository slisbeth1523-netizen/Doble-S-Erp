import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, Input, LoadingState, PageHeader, Select, Table } from "../components/ui/index.js";
import {
  addSalesReturnLine,
  createSalesReturn,
  deleteSalesReturnLine,
  getShipmentReturnableLines,
  listSalesReturns,
  postSalesReturn,
  updateSalesReturnLine,
  type SalesReturn,
  type SalesReturnableLine
} from "../services/salesReturnsClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Posteada",
  CANCELLED: "Cancelada"
};

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function statusTone(status?: string) {
  if (status === "POSTED") return "green";
  if (status === "DRAFT") return "amber";
  return "neutral";
}

function nextIdempotencyKey() {
  return `ui-sales-return-post-${crypto.randomUUID()}`;
}

export function SalesReturnsPreview() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [returnableLines, setReturnableLines] = useState<SalesReturnableLine[]>([]);
  const [selectedReturnId, setSelectedReturnId] = useState("");
  const [shipmentId, setShipmentId] = useState("");
  const [selectedShipmentLineId, setSelectedShipmentLineId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  const [postKey, setPostKey] = useState(nextIdempotencyKey);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedReturn = useMemo(
    () => returns.find((salesReturn) => salesReturn.id === selectedReturnId),
    [returns, selectedReturnId]
  );
  const selectedReturnableLine = useMemo(
    () => returnableLines.find((line) => line.salesShipmentLineId === selectedShipmentLineId),
    [returnableLines, selectedShipmentLineId]
  );

  async function refresh(currentSearch = search) {
    const result = await listSalesReturns({ search: currentSearch, page: 1, pageSize: 12 });
    setReturns(result.records);
    setSelectedReturnId((current) => current || (result.records.find((item) => item.status === "DRAFT")?.id ?? result.records[0]?.id ?? ""));
  }

  useEffect(() => {
    let active = true;
    listSalesReturns({ page: 1, pageSize: 12 })
      .then((result) => {
        if (!active) return;
        setReturns(result.records);
        setSelectedReturnId(result.records.find((item) => item.status === "DRAFT")?.id ?? result.records[0]?.id ?? "");
      })
      .catch((error: unknown) => {
        if (active) setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cargar devoluciones." });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await refresh(search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo filtrar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadReturnableLines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipmentId) {
      setFeedback({ tone: "warning", message: "Indica el ID de un despacho posteado." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const lines = await getShipmentReturnableLines(shipmentId);
      setReturnableLines(lines);
      setSelectedShipmentLineId(lines.find((line) => line.returnableQuantity > 0)?.salesShipmentLineId ?? "");
      setFeedback({ tone: "success", message: `Lineas consultadas: ${lines.length}.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudieron consultar las lineas." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateReturn() {
    if (!shipmentId) {
      setFeedback({ tone: "warning", message: "Indica el despacho para crear la devolucion." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await createSalesReturn({
        salesShipmentId: shipmentId,
        reason: reason || "Devolucion creada desde UI",
        reference: `UI-DEV-${Date.now()}`
      });
      setSelectedReturnId(result.id);
      setFeedback({ tone: "success", message: `Devolucion ${result.returnNumber} creada en borrador.` });
      await refresh(search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la devolucion." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReturn || !selectedReturnableLine) {
      setFeedback({ tone: "warning", message: "Selecciona una devolucion borrador y una linea pendiente." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await addSalesReturnLine(selectedReturn.id, {
        salesShipmentLineId: selectedReturnableLine.salesShipmentLineId,
        salesInvoiceLineId: selectedReturnableLine.salesInvoiceLineId ?? null,
        quantity,
        reason: reason || "Devolucion desde UI"
      });
      setFeedback({ tone: "success", message: `Linea agregada a ${result.returnNumber}.` });
      await refresh(search);
      if (shipmentId) setReturnableLines(await getShipmentReturnableLines(shipmentId));
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo agregar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateLine(lineId: string, currentQuantity: number) {
    const nextQuantity = Number(window.prompt("Nueva cantidad", String(currentQuantity)));
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0 || !selectedReturn) return;
    setSaving(true);
    setFeedback(null);
    try {
      await updateSalesReturnLine(selectedReturn.id, lineId, { quantity: nextQuantity });
      setFeedback({ tone: "success", message: "Linea actualizada." });
      await refresh(search);
      if (shipmentId) setReturnableLines(await getShipmentReturnableLines(shipmentId));
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo actualizar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLine(lineId: string) {
    if (!selectedReturn) return;
    setSaving(true);
    setFeedback(null);
    try {
      await deleteSalesReturnLine(selectedReturn.id, lineId);
      setFeedback({ tone: "success", message: "Linea eliminada." });
      await refresh(search);
      if (shipmentId) setReturnableLines(await getShipmentReturnableLines(shipmentId));
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo eliminar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePostReturn() {
    if (!selectedReturn) {
      setFeedback({ tone: "warning", message: "Selecciona una devolucion para postear." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await postSalesReturn(selectedReturn.id, postKey);
      setPostKey(nextIdempotencyKey());
      setFeedback({
        tone: "success",
        message: `Devolucion ${result.returnNumber} posteada. Movimiento ${result.movementNumber ?? "-"}.`
      });
      await refresh(search);
      if (shipmentId) setReturnableLines(await getShipmentReturnableLines(shipmentId));
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear la devolucion." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando devoluciones..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Crea devoluciones contra despachos posteados; al postear reingresa inventario y Kardex sin modificar CxC."
        eyebrow="Ventas"
        title="Devoluciones"
      />

      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <section className="dashboard-grid dashboard-grid-3">
        <Card>
          <span className="metric-label">Devoluciones visibles</span>
          <strong className="metric-value">{returns.length}</strong>
          <span className="metric-helper">Pagina actual</span>
        </Card>
        <Card>
          <span className="metric-label">Lineas retornables</span>
          <strong className="metric-value">{returnableLines.length}</strong>
          <span className="metric-helper">Segun despacho consultado</span>
        </Card>
        <Card>
          <span className="metric-label">Pendiente visible</span>
          <strong className="metric-value">{formatNumber(returnableLines.reduce((total, line) => total + line.returnableQuantity, 0))}</strong>
          <span className="metric-helper">Cantidad disponible</span>
        </Card>
      </section>

      <Card>
        <form className="toolbar-row" onSubmit={handleSearch}>
          <Input placeholder="Buscar devolucion, despacho, factura o cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button disabled={saving} type="submit">Consultar</Button>
        </form>
      </Card>

      <div className="content-grid two-columns">
        <Card>
          <h2>Crear desde despacho</h2>
          <form className="form-grid" onSubmit={handleLoadReturnableLines}>
            <label>
              ID del despacho posteado
              <Input value={shipmentId} onChange={(event) => setShipmentId(event.target.value)} placeholder="UUID del despacho" />
            </label>
            <label>
              Motivo
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo de devolucion" />
            </label>
            <div className="toolbar-row">
              <Button disabled={saving || !shipmentId} type="submit">Consultar lineas</Button>
              <Button disabled={saving || !shipmentId} onClick={handleCreateReturn} type="button" variant="secondary">Crear borrador</Button>
            </div>
          </form>
          <Table
            columns={["Despacho", "Linea", "Articulo", "Despachado", "Devuelto", "Pendiente"]}
            rows={returnableLines.map((line) => [
              line.shipmentNumber,
              line.lineNumber,
              line.itemCode,
              formatNumber(line.shippedQuantity),
              formatNumber(line.previouslyReturnedQuantity),
              formatNumber(line.returnableQuantity)
            ])}
          />
        </Card>

        <Card>
          <h2>Agregar y postear</h2>
          <form className="form-grid" onSubmit={handleAddLine}>
            <label>
              Devolucion borrador
              <Select value={selectedReturnId} onChange={(event) => setSelectedReturnId(event.target.value)}>
                <option value="">Selecciona una devolucion</option>
                {returns.map((salesReturn) => (
                  <option disabled={salesReturn.status !== "DRAFT"} key={salesReturn.id} value={salesReturn.id}>
                    {salesReturn.returnNumber} - {salesReturn.shipmentNumber} - {statusLabels[salesReturn.status] ?? salesReturn.status}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Linea pendiente
              <Select value={selectedShipmentLineId} onChange={(event) => setSelectedShipmentLineId(event.target.value)}>
                <option value="">Selecciona una linea</option>
                {returnableLines.map((line) => (
                  <option disabled={line.returnableQuantity <= 0} key={line.salesShipmentLineId} value={line.salesShipmentLineId}>
                    {line.itemCode} - pendiente {formatNumber(line.returnableQuantity)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Cantidad
              <Input min="0.0001" step="0.0001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <div className="toolbar-row">
              <Button disabled={saving || !selectedReturn || !selectedReturnableLine} type="submit">Agregar linea</Button>
              <Button disabled={saving || !selectedReturn || selectedReturn.status !== "DRAFT"} onClick={handlePostReturn} type="button" variant="secondary">
                Postear
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <h2>Devoluciones</h2>
        <Table
          columns={["Devolucion", "Despacho", "Factura", "Cliente", "Cantidad", "Movimiento", "Estado"]}
          rows={returns.map((salesReturn) => [
            salesReturn.returnNumber,
            salesReturn.shipmentNumber,
            salesReturn.invoiceNumber ?? "-",
            salesReturn.customerName,
            formatNumber(salesReturn.totalQuantity),
            salesReturn.movementNumber ?? "-",
            <Badge key={salesReturn.id} tone={statusTone(salesReturn.status)}>{statusLabels[salesReturn.status] ?? salesReturn.status}</Badge>
          ])}
        />
      </Card>

      <Card>
        <h2>Lineas de la devolucion seleccionada</h2>
        <Table
          columns={["Linea", "Articulo", "Almacen", "Cantidad", "Acciones"]}
          rows={(selectedReturn?.lines ?? []).map((line) => [
            line.lineNumber,
            `${line.itemCode} - ${line.itemDescription}`,
            line.warehouseCode,
            formatNumber(line.quantity),
            selectedReturn?.status === "DRAFT" ? (
              <span className="toolbar-row" key={line.id}>
                <Button disabled={saving} onClick={() => handleUpdateLine(line.id, line.quantity)} type="button" variant="secondary">Editar</Button>
                <Button disabled={saving} onClick={() => handleDeleteLine(line.id)} type="button" variant="danger">Eliminar</Button>
              </span>
            ) : "-"
          ])}
        />
      </Card>
    </div>
  );
}
