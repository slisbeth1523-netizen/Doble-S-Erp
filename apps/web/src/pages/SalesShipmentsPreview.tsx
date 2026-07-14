import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table } from "../components/ui/index.js";
import {
  addSalesShipmentLine,
  createSalesShipment,
  getSalesOrderShipmentLines,
  listActiveReservations,
  listApprovedOrdersForShipments,
  listSalesShipments,
  orderLabel,
  postSalesShipment,
  type SalesOrderShipmentLine,
  type SalesShipment
} from "../services/salesShipmentsClient.js";
import type { InventoryReservation } from "../services/inventoryReservationsClient.js";
import type { SalesOrder } from "../services/salesOrdersClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const shipmentStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Posteado",
  CANCELLED: "Cancelado"
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
  return `ui-shipment-post-${crypto.randomUUID()}`;
}

export function SalesShipmentsPreview() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [shipments, setShipments] = useState<SalesShipment[]>([]);
  const [orderLines, setOrderLines] = useState<SalesOrderShipmentLine[]>([]);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [search, setSearch] = useState("");
  const [postKey, setPostKey] = useState(nextIdempotencyKey);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => shipment.id === selectedShipmentId),
    [shipments, selectedShipmentId]
  );
  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedReservationId),
    [reservations, selectedReservationId]
  );

  async function refresh(orderId = selectedOrderId, currentSearch = search) {
    const [shipmentList, reservationList] = await Promise.all([
      listSalesShipments({ search: currentSearch, page: 1, pageSize: 12 }),
      listActiveReservations(orderId || undefined)
    ]);
    setShipments(shipmentList.records);
    setReservations(reservationList);
    setSelectedShipmentId((current) => current || (shipmentList.records.find((shipment) => shipment.status === "DRAFT")?.id ?? ""));
    setSelectedReservationId(reservationList[0]?.id ?? "");

    if (orderId) {
      setOrderLines(await getSalesOrderShipmentLines(orderId));
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([listApprovedOrdersForShipments(), listSalesShipments({ page: 1, pageSize: 12 })])
      .then(async ([orderList, shipmentList]) => {
        if (!active) return;
        setOrders(orderList);
        setShipments(shipmentList.records);
        const firstOrderId = orderList[0]?.id ?? "";
        setSelectedOrderId(firstOrderId);
        setSelectedShipmentId(shipmentList.records.find((shipment) => shipment.status === "DRAFT")?.id ?? "");
        if (firstOrderId) {
          const [lineList, reservationList] = await Promise.all([
            getSalesOrderShipmentLines(firstOrderId),
            listActiveReservations(firstOrderId)
          ]);
          if (!active) return;
          setOrderLines(lineList);
          setReservations(reservationList);
          setSelectedReservationId(reservationList[0]?.id ?? "");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cargar despachos." });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleOrderChange(orderId: string) {
    setSelectedOrderId(orderId);
    setFeedback(null);
    if (!orderId) {
      setOrderLines([]);
      setReservations([]);
      return;
    }
    try {
      const [lineList, reservationList] = await Promise.all([
        getSalesOrderShipmentLines(orderId),
        listActiveReservations(orderId)
      ]);
      setOrderLines(lineList);
      setReservations(reservationList);
      setSelectedReservationId(reservationList[0]?.id ?? "");
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo consultar el pedido." });
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo filtrar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrderId) {
      setFeedback({ tone: "warning", message: "Selecciona un pedido aprobado." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const shipment = await createSalesShipment({
        salesOrderId: selectedOrderId,
        reference: `UI-DSP-${Date.now()}`,
        notes: "Despacho creado desde UI"
      });
      setSelectedShipmentId(shipment.id);
      setFeedback({ tone: "success", message: `Despacho ${shipment.shipmentNumber} creado en borrador.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear el despacho." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedShipment || !selectedReservation) {
      setFeedback({ tone: "warning", message: "Selecciona un despacho borrador y una reserva activa." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await addSalesShipmentLine(selectedShipment.id, {
        salesOrderLineId: selectedReservation.salesOrderLineId,
        inventoryReservationId: selectedReservation.id,
        quantity,
        notes: "Linea agregada desde UI"
      });
      setFeedback({ tone: "success", message: `Linea agregada a ${result.shipmentNumber}.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo agregar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePostShipment() {
    if (!selectedShipment) {
      setFeedback({ tone: "warning", message: "Selecciona un despacho para postear." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await postSalesShipment(selectedShipment.id, postKey);
      setPostKey(nextIdempotencyKey());
      setFeedback({ tone: "success", message: `Despacho ${result.shipmentNumber} posteado. Movimiento ${result.movementNumber ?? "-"}.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear el despacho." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando despachos..." />;
  }

  if (!feedback && orders.length === 0) {
    return <ErrorState message="No hay pedidos aprobados disponibles para despachar." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Despacha pedidos aprobados consumiendo reservas y actualizando inventario mediante el motor existente."
        eyebrow="Ventas"
        title="Despachos"
      />

      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <section className="dashboard-grid dashboard-grid-3">
        <Card>
          <span className="metric-label">Pedidos aprobados</span>
          <strong className="metric-value">{orders.length}</strong>
          <span className="metric-helper">Disponibles para despacho</span>
        </Card>
        <Card>
          <span className="metric-label">Despachos visibles</span>
          <strong className="metric-value">{shipments.length}</strong>
          <span className="metric-helper">Pagina actual</span>
        </Card>
        <Card>
          <span className="metric-label">Pendiente visible</span>
          <strong className="metric-value">{formatNumber(orderLines.reduce((total, line) => total + line.pendingShipmentQuantity, 0))}</strong>
          <span className="metric-helper">Segun pedido seleccionado</span>
        </Card>
      </section>

      <Card>
        <form className="toolbar-row" onSubmit={handleSearch}>
          <Input placeholder="Buscar despacho, pedido o cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button disabled={saving} type="submit">Consultar</Button>
        </form>
      </Card>

      <div className="content-grid two-columns">
        <Card>
          <h2>Crear despacho</h2>
          <form className="form-grid" onSubmit={handleCreateShipment}>
            <label>
              Pedido aprobado
              <Select value={selectedOrderId} onChange={(event) => handleOrderChange(event.target.value)}>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{orderLabel(order)}</option>
                ))}
              </Select>
            </label>
            <Button disabled={saving || !selectedOrderId} type="submit">Crear borrador</Button>
          </form>
          <Table
            columns={["Linea", "Articulo", "Almacen", "Pedido", "Despachado", "Pendiente", "Reserva activa"]}
            rows={orderLines.map((line) => [
              line.lineNumber,
              line.itemCode,
              line.warehouseCode ?? "Sin almacen",
              formatNumber(line.orderedQuantity),
              formatNumber(line.previouslyShippedQuantity),
              formatNumber(line.pendingShipmentQuantity),
              formatNumber(line.activeReservationQuantity)
            ])}
          />
        </Card>

        <Card>
          <h2>Agregar y postear</h2>
          <form className="form-grid" onSubmit={handleAddLine}>
            <label>
              Despacho borrador
              <Select value={selectedShipmentId} onChange={(event) => setSelectedShipmentId(event.target.value)}>
                <option value="">Selecciona un despacho</option>
                {shipments.map((shipment) => (
                  <option disabled={shipment.status !== "DRAFT"} key={shipment.id} value={shipment.id}>
                    {shipment.shipmentNumber} - {shipment.orderNumber} - {shipmentStatusLabels[shipment.status] ?? shipment.status}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Reserva activa
              <Select value={selectedReservationId} onChange={(event) => setSelectedReservationId(event.target.value)}>
                <option value="">Selecciona una reserva</option>
                {reservations.map((reservation) => (
                  <option key={reservation.id} value={reservation.id}>
                    {reservation.orderNumber} - {reservation.itemCode} - activa {formatNumber(reservation.activeQuantity)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Cantidad
              <Input min="0.0001" step="0.0001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <div className="toolbar-row">
              <Button disabled={saving || !selectedShipment || !selectedReservation} type="submit">Agregar linea</Button>
              <Button disabled={saving || !selectedShipment || selectedShipment.status !== "DRAFT"} onClick={handlePostShipment} type="button" variant="secondary">
                Postear
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <h2>Despachos</h2>
        <Table
          columns={["Despacho", "Pedido", "Cliente", "Cantidad", "Movimiento", "Estado"]}
          rows={shipments.map((shipment) => [
            shipment.shipmentNumber,
            shipment.orderNumber,
            shipment.customerName,
            formatNumber(shipment.totalQuantity),
            shipment.movementNumber ?? "-",
            <Badge key={shipment.id} tone={statusTone(shipment.status)}>{shipmentStatusLabels[shipment.status] ?? shipment.status}</Badge>
          ])}
        />
      </Card>

      <Card>
        <h2>Lineas del despacho seleccionado</h2>
        <Table
          columns={["Linea", "Articulo", "Almacen", "Cantidad"]}
          rows={(selectedShipment?.lines ?? []).map((line) => [
            line.lineNumber,
            `${line.itemCode} - ${line.itemDescription}`,
            line.warehouseCode,
            formatNumber(line.quantity)
          ])}
        />
      </Card>
    </div>
  );
}
