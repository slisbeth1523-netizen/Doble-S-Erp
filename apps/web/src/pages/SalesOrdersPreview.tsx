import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addSalesOrderLine,
  cancelSalesOrder,
  createSalesOrder,
  createSalesOrderFromQuotation,
  deleteSalesOrderLine,
  listSalesOrders,
  loadSalesOrderOptions,
  loadSalesOrderSnapshots,
  optionLabel,
  recordNumber,
  transitionSalesOrder,
  updateSalesOrderLine,
  type SalesOrder,
  type SalesOrderLine,
  type SalesOrderStatus
} from "../services/salesOrdersClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const statusLabels: Record<SalesOrderStatus, string> = {
  DRAFT: "Borrador",
  SUBMITTED: "Sometido",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  CANCELLED: "Cancelado",
  CLOSED: "Cerrado"
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

  if (status === "REJECTED" || status === "CANCELLED") {
    return "red";
  }

  if (status === "SUBMITTED") {
    return "blue";
  }

  return "amber";
}

function statusLabel(status?: string) {
  return statusLabels[status as SalesOrderStatus] ?? "Sin pedido";
}

function defaultDeliveryDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function SalesOrdersPreview() {
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [items, setItems] = useState<LookupOption[]>([]);
  const [units, setUnits] = useState<LookupOption[]>([]);
  const [warehouses, setWarehouses] = useState<LookupOption[]>([]);
  const [approvedQuotations, setApprovedQuotations] = useState<CatalogRecord[]>([]);
  const [snapshots, setSnapshots] = useState<{ orders: CatalogRecord[]; lines: CatalogRecord[] }>({
    orders: [],
    lines: []
  });
  const [records, setRecords] = useState<SalesOrder[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [requestedDeliveryDate, setRequestedDeliveryDate] = useState(defaultDeliveryDate);
  const [currencyCode, setCurrencyCode] = useState("DOP");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceQuotationId, setSourceQuotationId] = useState("");
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [itemId, setItemId] = useState("");
  const [unitOfMeasureId, setUnitOfMeasureId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  const [editingLine, setEditingLine] = useState<SalesOrderLine | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apiConnected = customers.length > 0 && items.length > 0 && units.length > 0;
  const editable = order?.status === "DRAFT";
  const selectedCustomer = useMemo(() => optionLabel(customers, customerId), [customerId, customers]);

  async function refreshSnapshots() {
    const [snapshot, list] = await Promise.all([
      loadSalesOrderSnapshots(),
      listSalesOrders({ search, status, page: 1, pageSize: 10 })
    ]);
    setSnapshots(snapshot);
    setRecords(list.records);
  }

  function resetLineForm() {
    setEditingLine(null);
    setDescription("");
    setQuantity(1);
    setUnitPrice(0);
    setDiscountPercent(0);
    setTaxPercent(18);
    setWarehouseId(warehouses[0]?.value ?? "");
  }

  useEffect(() => {
    let active = true;

    Promise.all([loadSalesOrderOptions(), loadSalesOrderSnapshots(), listSalesOrders({ page: 1, pageSize: 10 })])
      .then(([options, snapshot, list]) => {
        if (!active) {
          return;
        }

        setCustomers(options.customers);
        setItems(options.items);
        setUnits(options.units);
        setWarehouses(options.warehouses);
        setApprovedQuotations(options.approvedQuotations);
        setSnapshots(snapshot);
        setRecords(list.records);
        setCustomerId(options.customers[0]?.value ?? "");
        setItemId(options.items[0]?.value ?? "");
        setUnitOfMeasureId(options.units[0]?.value ?? "");
        setWarehouseId(options.warehouses[0]?.value ?? "");
        setSourceQuotationId(String(options.approvedQuotations[0]?.id ?? ""));
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

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const list = await listSalesOrders({ search, status, page: 1, pageSize: 10 });
      setRecords(list.records);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo consultar pedidos." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const result = await createSalesOrder({
        customerId,
        requestedDeliveryDate: requestedDeliveryDate ? new Date(requestedDeliveryDate).toISOString() : null,
        currencyCode,
        exchangeRate,
        reference: reference || null,
        notes: notes || null
      });
      setOrder(result);
      setFeedback({ tone: "success", message: `Pedido ${result.orderNumber} creado en borrador.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear el pedido." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateFromQuotation() {
    if (!sourceQuotationId) {
      setFeedback({ tone: "warning", message: "Selecciona una cotizacion aprobada." });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await createSalesOrderFromQuotation(sourceQuotationId);
      setOrder(result);
      setFeedback({ tone: "success", message: `Pedido ${result.orderNumber} creado desde cotizacion ${result.sourceQuotationNumber}.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo convertir la cotizacion." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!order || !editable) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        itemId,
        unitOfMeasureId,
        warehouseId: warehouseId || null,
        description: description || undefined,
        quantity,
        unitPrice,
        discountPercent,
        taxPercent,
        notes: "Linea registrada desde UI de pedidos"
      };
      const result = editingLine
        ? await updateSalesOrderLine(order.id, editingLine.id, payload)
        : await addSalesOrderLine(order.id, payload);
      setOrder(result);
      resetLineForm();
      setFeedback({ tone: "success", message: "Linea guardada y totales recalculados." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLine(line: SalesOrderLine) {
    if (!order || !editable || !window.confirm("Quieres eliminar esta linea?")) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await deleteSalesOrderLine(order.id, line.id);
      setOrder(result);
      setFeedback({ tone: "success", message: "Linea eliminada y totales recalculados." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo eliminar la linea." });
    } finally {
      setSaving(false);
    }
  }

  function editLine(line: SalesOrderLine) {
    setEditingLine(line);
    setItemId(line.itemId);
    setUnitOfMeasureId(line.unitOfMeasureId);
    setWarehouseId(line.warehouseId ?? "");
    setDescription(line.description);
    setQuantity(line.quantity);
    setUnitPrice(line.unitPrice);
    setDiscountPercent(line.discountPercent);
    setTaxPercent(line.taxPercent);
  }

  async function handleTransition(action: "submit" | "approve" | "reject") {
    if (!order) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await transitionSalesOrder(order.id, action);
      setOrder(result);
      setFeedback({ tone: "success", message: `Pedido ${statusLabel(result.status).toLowerCase()}.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cambiar el estado." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!order) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await cancelSalesOrder(order.id, cancelReason || "Cancelado desde UI de pedidos");
      setOrder(result);
      setFeedback({ tone: "success", message: "Pedido cancelado." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cancelar el pedido." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando pedidos de venta..." />;
  }

  if (!apiConnected && !feedback) {
    return <ErrorState message="No hay datos suficientes para probar pedidos. Revisa la API local y el seed demo." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        actions={
          <>
            <Button onClick={() => navigate("/master-data/sales-orders")} type="button" variant="secondary">
              Consulta pedidos
            </Button>
            <Button onClick={() => navigate("/master-data/sales-quotation-lines")} type="button" variant="secondary">
              Lineas cotizadas
            </Button>
          </>
        }
        description="Gestiona pedidos de venta en borrador, conversion desde cotizaciones aprobadas y aprobacion sin afectar inventario ni CxC."
        eyebrow="Ventas"
        title="Pedidos"
      />

      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <section className="dashboard-grid dashboard-grid-4">
        <Card>
          <span className="metric-label">API</span>
          <strong className="metric-value">{apiConnected ? "Conectada" : "Sin datos"}</strong>
          <span className="metric-helper">Catalogos y pedidos runtime</span>
        </Card>
        <Card>
          <span className="metric-label">Pedidos</span>
          <strong className="metric-value">{records.length}</strong>
          <span className="metric-helper">Pagina actual</span>
        </Card>
        <Card>
          <span className="metric-label">Pedido activo</span>
          <strong className="metric-value">{order?.orderNumber ?? "-"}</strong>
          <span className="metric-helper">{statusLabel(order?.status)}</span>
        </Card>
        <Card>
          <span className="metric-label">Total</span>
          <strong className="metric-value">{formatNumber(order?.totalAmount)}</strong>
          <span className="metric-helper">{order?.currencyCode ?? "DOP"}</span>
        </Card>
      </section>

      <div className="content-grid two-columns">
        <Card>
          <h2>Crear pedido directo</h2>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>
              Cliente
              <Select required value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
                {customers.map((customer) => (
                  <option key={customer.value} value={customer.value}>
                    {customer.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Entrega solicitada
              <Input type="datetime-local" value={requestedDeliveryDate} onChange={(event) => setRequestedDeliveryDate(event.target.value)} />
            </label>
            <label>
              Moneda
              <Input maxLength={3} value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} />
            </label>
            <label>
              Tasa
              <Input min="0.000001" step="0.000001" type="number" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
            </label>
            <label>
              Referencia
              <Input value={reference} onChange={(event) => setReference(event.target.value)} />
            </label>
            <label>
              Notas
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <Button disabled={saving || !customerId} type="submit">
              Crear pedido
            </Button>
          </form>
          <p className="muted">Cliente seleccionado: {selectedCustomer}</p>
        </Card>

        <Card>
          <h2>Crear desde cotizacion aprobada</h2>
          <div className="form-grid">
            <label>
              Cotizacion
              <Select value={sourceQuotationId} onChange={(event) => setSourceQuotationId(event.target.value)}>
                <option value="">Selecciona una cotizacion</option>
                {approvedQuotations.map((quotation) => (
                  <option key={String(quotation.id)} value={String(quotation.id)}>
                    {String(quotation.quotationNumber ?? quotation.code)} - {String(quotation.customerName ?? quotation.name)}
                  </option>
                ))}
              </Select>
            </label>
            <Button disabled={saving || !sourceQuotationId} onClick={handleCreateFromQuotation} type="button">
              Convertir a pedido
            </Button>
          </div>
          <p className="muted">La conversion copia lineas y totales, y marca la cotizacion como convertida en una sola operacion.</p>
        </Card>
      </div>

      <Card>
        <h2>Pedido activo</h2>
        <div className="toolbar-row">
          <Badge tone={statusTone(order?.status)}>{statusLabel(order?.status)}</Badge>
          {order?.sourceQuotationNumber ? <span className="muted">Origen: {order.sourceQuotationNumber}</span> : null}
          <span className="muted">Lineas: {order?.lineCount ?? 0}</span>
          <span className="muted">Subtotal: {formatNumber(order?.subtotalAmount)}</span>
          <span className="muted">Impuesto: {formatNumber(order?.taxAmount)}</span>
          <strong>Total: {formatNumber(order?.totalAmount)}</strong>
        </div>
        <div className="toolbar-row">
          <Button disabled={saving || order?.status !== "DRAFT"} onClick={() => handleTransition("submit")} type="button">
            Someter
          </Button>
          <Button disabled={saving || order?.status !== "SUBMITTED"} onClick={() => handleTransition("approve")} type="button">
            Aprobar
          </Button>
          <Button disabled={saving || order?.status !== "SUBMITTED"} onClick={() => handleTransition("reject")} type="button" variant="secondary">
            Rechazar
          </Button>
          <Input placeholder="Motivo de cancelacion" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          <Button disabled={saving || (order?.status !== "DRAFT" && order?.status !== "SUBMITTED")} onClick={handleCancel} type="button" variant="danger">
            Cancelar
          </Button>
          <Button disabled={order?.status !== "APPROVED"} onClick={() => navigate("/sales/reservations")} type="button" variant="secondary">
            Reservar
          </Button>
        </div>

        {order ? (
          <form className="form-grid" onSubmit={handleLineSubmit}>
            <label>
              Articulo
              <Select disabled={!editable} required value={itemId} onChange={(event) => setItemId(event.target.value)}>
                {items.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Unidad
              <Select disabled={!editable} required value={unitOfMeasureId} onChange={(event) => setUnitOfMeasureId(event.target.value)}>
                {units.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Almacen opcional
              <Select disabled={!editable} value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}>
                <option value="">Sin almacen</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.value} value={warehouse.value}>
                    {warehouse.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Descripcion
              <Input disabled={!editable} value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Cantidad
              <Input disabled={!editable} min="0.000001" step="0.000001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <label>
              Precio
              <Input disabled={!editable} min="0" step="0.01" type="number" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} />
            </label>
            <label>
              Desc. %
              <Input disabled={!editable} max="100" min="0" step="0.01" type="number" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} />
            </label>
            <label>
              Imp. %
              <Input disabled={!editable} max="100" min="0" step="0.01" type="number" value={taxPercent} onChange={(event) => setTaxPercent(Number(event.target.value))} />
            </label>
            <Button disabled={saving || !editable} type="submit">
              {editingLine ? "Actualizar linea" : "Agregar linea"}
            </Button>
            {editingLine ? (
              <Button onClick={resetLineForm} type="button" variant="secondary">
                Cancelar edicion
              </Button>
            ) : null}
          </form>
        ) : (
          <p className="muted">Crea o selecciona un pedido para agregar lineas.</p>
        )}

        <Table
          columns={["Linea", "Articulo", "Almacen", "Cantidad", "Reservado", "Pendiente", "Disponible", "Precio", "Total", "Acciones"]}
          rows={(order?.lines ?? []).map((line) => [
            line.lineNumber,
            `${line.itemCode} - ${line.description}`,
            line.warehouseCode ?? "-",
            formatNumber(line.quantity),
            formatNumber(line.reservedQuantity),
            formatNumber(line.pendingReservationQuantity ?? line.quantity),
            formatNumber(line.availableQuantity),
            formatNumber(line.unitPrice),
            formatNumber(line.lineTotal),
            <div className="toolbar-row" key={line.id}>
              <Button disabled={!editable} onClick={() => editLine(line)} type="button" variant="secondary">
                Editar
              </Button>
              <Button disabled={!editable} onClick={() => handleDeleteLine(line)} type="button" variant="danger">
                Eliminar
              </Button>
            </div>
          ])}
          emptyText="El pedido activo no tiene lineas."
        />
      </Card>

      <Card>
        <form className="toolbar-row" onSubmit={handleSearch}>
          <Input placeholder="Buscar pedido o cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Button disabled={saving} type="submit">
            Consultar
          </Button>
        </form>
        <Table
          columns={["Pedido", "Cliente", "Estado", "Origen", "Lineas", "Total", "Acciones"]}
          rows={records.map((record) => [
            record.orderNumber,
            record.customerName,
            <Badge key={`${record.id}-status`} tone={statusTone(record.status)}>{statusLabel(record.status)}</Badge>,
            record.sourceQuotationNumber ?? "-",
            record.lineCount,
            formatNumber(record.totalAmount),
            <Button key={record.id} onClick={() => setOrder(record)} type="button" variant="secondary">
              Seleccionar
            </Button>
          ])}
          emptyText="No hay pedidos con esos filtros."
        />
      </Card>

      <div className="content-grid two-columns">
        <Card>
          <h2>Consulta read-only</h2>
          <Table
            columns={["Pedido", "Cliente", "Estado", "Total"]}
            rows={snapshots.orders.map((snapshot) => [
              String(snapshot.orderNumber ?? snapshot.code),
              String(snapshot.customerName ?? snapshot.name),
              statusLabel(String(snapshot.status)),
              formatNumber(recordNumber(snapshot, "totalAmount"))
            ])}
          />
        </Card>
        <Card>
          <h2>Lineas recientes</h2>
          <Table
            columns={["Pedido", "Articulo", "Cantidad", "Total"]}
            rows={snapshots.lines.map((line) => [
              String(line.orderNumber ?? line.code),
              String(line.description ?? line.itemDescription),
              formatNumber(recordNumber(line, "quantity")),
              formatNumber(recordNumber(line, "lineTotal"))
            ])}
          />
        </Card>
      </div>
    </div>
  );
}
