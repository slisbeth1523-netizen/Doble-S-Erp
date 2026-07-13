import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table } from "../components/ui/index.js";
import {
  getSalesOrderReservationLines,
  listApprovedSalesOrders,
  listInventoryReservations,
  listItemAvailability,
  orderLabel,
  releaseInventoryReservation,
  reserveSalesOrderLine,
  type InventoryReservation,
  type ItemAvailability,
  type SalesOrderReservationLine
} from "../services/inventoryReservationsClient.js";
import type { SalesOrder } from "../services/salesOrdersClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const reservationStatusLabels: Record<string, string> = {
  ACTIVE: "Activa",
  PARTIALLY_RELEASED: "Parcialmente liberada",
  RELEASED: "Liberada",
  CONSUMED: "Consumida",
  CANCELLED: "Cancelada"
};

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function statusTone(status?: string) {
  if (status === "ACTIVE") return "green";
  if (status === "PARTIALLY_RELEASED") return "amber";
  if (status === "RELEASED") return "blue";
  return "neutral";
}

export function SalesReservationsPreview() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [lines, setLines] = useState<SalesOrderReservationLine[]>([]);
  const [reservations, setReservations] = useState<InventoryReservation[]>([]);
  const [availability, setAvailability] = useState<ItemAvailability[]>([]);
  const [search, setSearch] = useState("");
  const [reserveLineId, setReserveLineId] = useState("");
  const [reserveQuantity, setReserveQuantity] = useState(1);
  const [releaseReservationId, setReleaseReservationId] = useState("");
  const [releaseQuantity, setReleaseQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const selectedLine = useMemo(
    () => lines.find((line) => line.salesOrderLineId === reserveLineId),
    [lines, reserveLineId]
  );
  const selectedReservation = useMemo(
    () => reservations.find((reservation) => reservation.id === releaseReservationId),
    [reservations, releaseReservationId]
  );

  async function refresh(orderId = selectedOrderId, currentSearch = search) {
    const [reservationList, availabilityList] = await Promise.all([
      listInventoryReservations({ search: currentSearch, page: 1, pageSize: 12 }),
      listItemAvailability({ search: currentSearch, page: 1, pageSize: 12 })
    ]);
    setReservations(reservationList.records);
    setAvailability(availabilityList.records);

    if (orderId) {
      const nextLines = await getSalesOrderReservationLines(orderId);
      setLines(nextLines);
      setReserveLineId(nextLines.find((line) => line.pendingReservationQuantity > 0 && line.warehouseId)?.salesOrderLineId ?? "");
    }
  }

  useEffect(() => {
    let active = true;

    Promise.all([listApprovedSalesOrders(), listInventoryReservations({ page: 1, pageSize: 12 }), listItemAvailability({ page: 1, pageSize: 12 })])
      .then(async ([orderList, reservationList, availabilityList]) => {
        if (!active) return;

        setOrders(orderList);
        setReservations(reservationList.records);
        setAvailability(availabilityList.records);
        const firstOrderId = orderList[0]?.id ?? "";
        setSelectedOrderId(firstOrderId);
        if (firstOrderId) {
          const orderLines = await getSalesOrderReservationLines(firstOrderId);
          if (!active) return;
          setLines(orderLines);
          setReserveLineId(orderLines.find((line) => line.pendingReservationQuantity > 0 && line.warehouseId)?.salesOrderLineId ?? "");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cargar reservas." });
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
      setLines([]);
      setReserveLineId("");
      return;
    }
    try {
      const nextLines = await getSalesOrderReservationLines(orderId);
      setLines(nextLines);
      setReserveLineId(nextLines.find((line) => line.pendingReservationQuantity > 0 && line.warehouseId)?.salesOrderLineId ?? "");
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudieron consultar lineas." });
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

  async function handleReserve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrderId || !selectedLine) {
      setFeedback({ tone: "warning", message: "Selecciona una linea reservable." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const result = await reserveSalesOrderLine(selectedOrderId, selectedLine.salesOrderLineId, {
        quantity: reserveQuantity,
        reference: `UI-RES-${Date.now()}`,
        notes: "Reserva creada desde UI"
      });
      setFeedback({ tone: "success", message: `Reserva ${result.orderNumber} creada por ${formatNumber(result.activeQuantity)}.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo reservar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReservation) {
      setFeedback({ tone: "warning", message: "Selecciona una reserva activa." });
      return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      const result = await releaseInventoryReservation(selectedReservation.id, {
        quantity: releaseQuantity,
        reason: "Liberacion desde UI"
      });
      setFeedback({ tone: "success", message: `Reserva ${reservationStatusLabels[result.status] ?? result.status}.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo liberar." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando reservas..." />;
  }

  if (!feedback && orders.length === 0) {
    return <ErrorState message="No hay pedidos aprobados disponibles para reservar." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Reserva disponibilidad comercial por pedido aprobado sin reducir existencia fisica ni crear movimientos."
        eyebrow="Ventas"
        title="Reservas"
      />

      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <section className="dashboard-grid dashboard-grid-3">
        <Card>
          <span className="metric-label">Pedidos aprobados</span>
          <strong className="metric-value">{orders.length}</strong>
          <span className="metric-helper">Disponibles para reserva</span>
        </Card>
        <Card>
          <span className="metric-label">Reservas activas</span>
          <strong className="metric-value">{reservations.filter((reservation) => reservation.activeQuantity > 0).length}</strong>
          <span className="metric-helper">Pagina actual</span>
        </Card>
        <Card>
          <span className="metric-label">Disponible visible</span>
          <strong className="metric-value">{formatNumber(availability.reduce((total, row) => total + row.availableQuantity, 0))}</strong>
          <span className="metric-helper">Segun filtro actual</span>
        </Card>
      </section>

      <Card>
        <form className="toolbar-row" onSubmit={handleSearch}>
          <Input placeholder="Buscar articulo, almacen o pedido" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button disabled={saving} type="submit">Consultar</Button>
        </form>
      </Card>

      <div className="content-grid two-columns">
        <Card>
          <h2>Crear reserva</h2>
          <form className="form-grid" onSubmit={handleReserve}>
            <label>
              Pedido aprobado
              <Select value={selectedOrderId} onChange={(event) => handleOrderChange(event.target.value)}>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{orderLabel(order)}</option>
                ))}
              </Select>
            </label>
            <label>
              Linea
              <Select value={reserveLineId} onChange={(event) => setReserveLineId(event.target.value)}>
                <option value="">Selecciona una linea</option>
                {lines.map((line) => (
                  <option disabled={!line.warehouseId || line.pendingReservationQuantity <= 0} key={line.salesOrderLineId} value={line.salesOrderLineId}>
                    {line.lineNumber} - {line.itemCode} - pendiente {formatNumber(line.pendingReservationQuantity)} - disp. {formatNumber(line.availableQuantity)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Cantidad
              <Input min="0.0001" step="0.0001" type="number" value={reserveQuantity} onChange={(event) => setReserveQuantity(Number(event.target.value))} />
            </label>
            <Button disabled={saving || !selectedLine} type="submit">Reservar</Button>
          </form>
          <Table
            columns={["Linea", "Articulo", "Almacen", "Pedido", "Reservado", "Pendiente", "Disponible"]}
            rows={lines.map((line) => [
              line.lineNumber,
              line.itemCode,
              line.warehouseCode ?? "Sin almacen",
              formatNumber(line.orderedQuantity),
              formatNumber(line.reservedQuantity),
              formatNumber(line.pendingReservationQuantity),
              formatNumber(line.availableQuantity)
            ])}
          />
        </Card>

        <Card>
          <h2>Liberar reserva</h2>
          <form className="form-grid" onSubmit={handleRelease}>
            <label>
              Reserva
              <Select value={releaseReservationId} onChange={(event) => setReleaseReservationId(event.target.value)}>
                <option value="">Selecciona una reserva</option>
                {reservations.map((reservation) => (
                  <option disabled={reservation.activeQuantity <= 0} key={reservation.id} value={reservation.id}>
                    {reservation.orderNumber} - {reservation.itemCode} - activa {formatNumber(reservation.activeQuantity)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Cantidad
              <Input min="0.0001" step="0.0001" type="number" value={releaseQuantity} onChange={(event) => setReleaseQuantity(Number(event.target.value))} />
            </label>
            <Button disabled={saving || !selectedReservation} type="submit" variant="secondary">Liberar</Button>
          </form>
          <Table
            columns={["Pedido", "Articulo", "Almacen", "Activa", "Estado"]}
            rows={reservations.map((reservation) => [
              reservation.orderNumber,
              reservation.itemCode,
              reservation.warehouseCode,
              formatNumber(reservation.activeQuantity),
              <Badge key={reservation.id} tone={statusTone(reservation.status)}>{reservationStatusLabels[reservation.status] ?? reservation.status}</Badge>
            ])}
          />
        </Card>
      </div>

      <Card>
        <h2>Disponibilidad</h2>
        <Table
          columns={["Articulo", "Almacen", "Existencia fisica", "Reservado", "Disponible"]}
          rows={availability.map((row) => [
            `${row.itemCode} - ${row.itemDescription}`,
            row.warehouseCode,
            formatNumber(row.onHandQuantity),
            formatNumber(row.reservedQuantity),
            formatNumber(row.availableQuantity)
          ])}
        />
      </Card>
    </div>
  );
}
