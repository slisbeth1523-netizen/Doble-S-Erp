import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table } from "../components/ui/index.js";
import {
  addSalesInvoiceLine,
  createSalesInvoice,
  getSalesInvoiceAccounting,
  getSalesOrderInvoicePendingLines,
  listOrdersForInvoices,
  listSalesInvoices,
  orderLabel,
  postSalesInvoice,
  previewSalesInvoiceAccounting,
  repostSalesInvoiceAccounting,
  reverseSalesInvoiceAccounting,
  type SalesInvoice,
  type SalesAccountingPreview,
  type SalesAccountingStatus,
  type SalesInvoicePendingLine
} from "../services/salesInvoicesClient.js";
import type { SalesOrder } from "../services/salesOrdersClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const invoiceStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  POSTED: "Posteada",
  CANCELLED: "Cancelada"
};

const accountingStatusLabels: Record<string, string> = {
  NOT_POSTED: "Sin contabilizar",
  POSTED: "Contabilizada",
  REVERSED: "Reversada",
  REPOSTED: "Recontabilizada"
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
  return `ui-sales-invoice-post-${crypto.randomUUID()}`;
}

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().slice(0, 10);
}

export function SalesInvoicesPreview() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [pendingLines, setPendingLines] = useState<SalesInvoicePendingLine[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedShipmentLineId, setSelectedShipmentLineId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [search, setSearch] = useState("");
  const [postKey, setPostKey] = useState(nextIdempotencyKey);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [accounting, setAccounting] = useState<SalesAccountingStatus | null>(null);
  const [accountingPreview, setAccountingPreview] = useState<SalesAccountingPreview | null>(null);

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedInvoiceId),
    [invoices, selectedInvoiceId]
  );
  const selectedPendingLine = useMemo(
    () => pendingLines.find((line) => line.salesShipmentLineId === selectedShipmentLineId),
    [pendingLines, selectedShipmentLineId]
  );

  async function refresh(orderId = selectedOrderId, currentSearch = search) {
    const [invoiceList, lineList] = await Promise.all([
      listSalesInvoices({ search: currentSearch, page: 1, pageSize: 12 }),
      orderId ? getSalesOrderInvoicePendingLines(orderId) : Promise.resolve([])
    ]);
    setInvoices(invoiceList.records);
    setPendingLines(lineList);
    setSelectedInvoiceId((current) => current || (invoiceList.records.find((invoice) => invoice.status === "DRAFT")?.id ?? ""));
    setSelectedShipmentLineId(lineList.find((line) => line.pendingInvoiceQuantity > 0)?.salesShipmentLineId ?? "");
  }

  async function refreshAccounting(invoiceId = selectedInvoiceId) {
    if (!invoiceId) {
      setAccounting(null);
      setAccountingPreview(null);
      return;
    }
    const result = await getSalesInvoiceAccounting(invoiceId);
    setAccounting(result);
  }

  useEffect(() => {
    let active = true;

    Promise.all([listOrdersForInvoices(), listSalesInvoices({ page: 1, pageSize: 12 })])
      .then(async ([orderList, invoiceList]) => {
        if (!active) return;
        setOrders(orderList);
        setInvoices(invoiceList.records);
        const firstOrderId = orderList[0]?.id ?? "";
        setSelectedOrderId(firstOrderId);
        setSelectedInvoiceId(invoiceList.records.find((invoice) => invoice.status === "DRAFT")?.id ?? "");
        if (firstOrderId) {
          const lineList = await getSalesOrderInvoicePendingLines(firstOrderId);
          if (!active) return;
          setPendingLines(lineList);
          setSelectedShipmentLineId(lineList.find((line) => line.pendingInvoiceQuantity > 0)?.salesShipmentLineId ?? "");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo cargar facturas." });
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
      setPendingLines([]);
      return;
    }
    try {
      const lineList = await getSalesOrderInvoicePendingLines(orderId);
      setPendingLines(lineList);
      setSelectedShipmentLineId(lineList.find((line) => line.pendingInvoiceQuantity > 0)?.salesShipmentLineId ?? "");
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

  async function handleCreateInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrderId) {
      setFeedback({ tone: "warning", message: "Selecciona un pedido con despachos pendientes de facturar." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const invoice = await createSalesInvoice({
        salesOrderId: selectedOrderId,
        dueDate,
        reference: `UI-FAC-${Date.now()}`,
        notes: "Factura creada desde UI"
      });
      setSelectedInvoiceId(invoice.id);
      setFeedback({ tone: "success", message: `Factura ${invoice.invoiceNumber} creada en borrador.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la factura." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAddLine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInvoice || !selectedPendingLine) {
      setFeedback({ tone: "warning", message: "Selecciona una factura borrador y una linea pendiente." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await addSalesInvoiceLine(selectedInvoice.id, {
        salesShipmentLineId: selectedPendingLine.salesShipmentLineId,
        quantity,
        notes: "Linea agregada desde UI"
      });
      setFeedback({ tone: "success", message: `Linea agregada a ${result.invoiceNumber}.` });
      await refresh(selectedOrderId, search);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo agregar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handlePostInvoice() {
    if (!selectedInvoice) {
      setFeedback({ tone: "warning", message: "Selecciona una factura para postear." });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const result = await postSalesInvoice(selectedInvoice.id, postKey);
      setPostKey(nextIdempotencyKey());
      setFeedback({
        tone: "success",
        message: `Factura ${result.invoiceNumber} posteada. Documento CxC ${result.accountsReceivableDocumentNumber ?? "-"}.`
      });
      await refresh(selectedOrderId, search);
      await refreshAccounting(result.id);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo postear la factura." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAccountingPreview() {
    if (!selectedInvoice) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await previewSalesInvoiceAccounting(selectedInvoice.id);
      setAccountingPreview(result);
      setFeedback({ tone: "success", message: `Preview contable listo para ${result.documentNumber}.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo generar el preview contable." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAccountingReverse() {
    if (!selectedInvoice) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await reverseSalesInvoiceAccounting(selectedInvoice.id);
      setAccounting(result.accounting);
      setFeedback({ tone: "success", message: `Asiento reversado: ${result.journalEntry.entryNumber}.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo reversar el asiento." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAccountingRepost() {
    if (!selectedInvoice) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await repostSalesInvoiceAccounting(selectedInvoice.id);
      setAccounting(result.accounting);
      setFeedback({ tone: "success", message: `Factura recontabilizada: ${result.journalEntry.entryNumber}.` });
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo recontabilizar." });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    if (!selectedInvoiceId) {
      setAccounting(null);
      setAccountingPreview(null);
      return;
    }
    getSalesInvoiceAccounting(selectedInvoiceId)
      .then((result) => {
        if (active) setAccounting(result);
      })
      .catch(() => {
        if (active) setAccounting(null);
      });
    setAccountingPreview(null);
    return () => {
      active = false;
    };
  }, [selectedInvoiceId]);

  if (loading) {
    return <LoadingState label="Cargando facturas..." />;
  }

  if (!feedback && orders.length === 0) {
    return <ErrorState message="No hay pedidos con despachos posteados pendientes de facturar." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        description="Factura despachos posteados y crea el documento de CxC al postear, sin afectar inventario."
        eyebrow="Ventas"
        title="Facturas"
      />

      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}

      <section className="dashboard-grid dashboard-grid-3">
        <Card>
          <span className="metric-label">Pedidos disponibles</span>
          <strong className="metric-value">{orders.length}</strong>
          <span className="metric-helper">Con despachos para revisar</span>
        </Card>
        <Card>
          <span className="metric-label">Facturas visibles</span>
          <strong className="metric-value">{invoices.length}</strong>
          <span className="metric-helper">Pagina actual</span>
        </Card>
        <Card>
          <span className="metric-label">Pendiente visible</span>
          <strong className="metric-value">{formatNumber(pendingLines.reduce((total, line) => total + line.pendingInvoiceQuantity, 0))}</strong>
          <span className="metric-helper">Segun pedido seleccionado</span>
        </Card>
      </section>

      <Card>
        <form className="toolbar-row" onSubmit={handleSearch}>
          <Input placeholder="Buscar factura, pedido o cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Button disabled={saving} type="submit">Consultar</Button>
        </form>
      </Card>

      <div className="content-grid two-columns">
        <Card>
          <h2>Crear factura</h2>
          <form className="form-grid" onSubmit={handleCreateInvoice}>
            <label>
              Pedido
              <Select value={selectedOrderId} onChange={(event) => handleOrderChange(event.target.value)}>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>{orderLabel(order)}</option>
                ))}
              </Select>
            </label>
            <label>
              Vencimiento
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </label>
            <Button disabled={saving || !selectedOrderId} type="submit">Crear borrador</Button>
          </form>
          <Table
            columns={["Despacho", "Linea", "Articulo", "Despachado", "Facturado", "Pendiente"]}
            rows={pendingLines.map((line) => [
              line.shipmentNumber,
              line.lineNumber,
              line.itemCode,
              formatNumber(line.shippedQuantity),
              formatNumber(line.previouslyInvoicedQuantity),
              formatNumber(line.pendingInvoiceQuantity)
            ])}
          />
        </Card>

        <Card>
          <h2>Agregar y postear</h2>
          <form className="form-grid" onSubmit={handleAddLine}>
            <label>
              Factura borrador
              <Select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
                <option value="">Selecciona una factura</option>
                {invoices.map((invoice) => (
                  <option disabled={invoice.status !== "DRAFT"} key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} - {invoice.orderNumber} - {invoiceStatusLabels[invoice.status] ?? invoice.status}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Linea pendiente
              <Select value={selectedShipmentLineId} onChange={(event) => setSelectedShipmentLineId(event.target.value)}>
                <option value="">Selecciona una linea</option>
                {pendingLines.map((line) => (
                  <option disabled={line.pendingInvoiceQuantity <= 0} key={line.salesShipmentLineId} value={line.salesShipmentLineId}>
                    {line.shipmentNumber} - {line.itemCode} - pendiente {formatNumber(line.pendingInvoiceQuantity)}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              Cantidad
              <Input min="0.0001" step="0.0001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
            </label>
            <div className="toolbar-row">
              <Button disabled={saving || !selectedInvoice || !selectedPendingLine} type="submit">Agregar linea</Button>
              <Button disabled={saving || !selectedInvoice || selectedInvoice.status !== "DRAFT"} onClick={handlePostInvoice} type="button" variant="secondary">
                Postear
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <h2>Facturas</h2>
        <Table
          columns={["Factura", "Pedido", "Cliente", "Cantidad", "Total", "Documento CxC", "Estado"]}
          rows={invoices.map((invoice) => [
            invoice.invoiceNumber,
            invoice.orderNumber,
            invoice.customerName,
            formatNumber(invoice.totalQuantity),
            formatNumber(invoice.totalAmount),
            invoice.accountsReceivableDocumentNumber ?? "-",
            <Badge key={invoice.id} tone={statusTone(invoice.status)}>{invoiceStatusLabels[invoice.status] ?? invoice.status}</Badge>
          ])}
        />
      </Card>

      <Card>
        <h2>Lineas de la factura seleccionada</h2>
        <Table
          columns={["Linea", "Despacho", "Articulo", "Cantidad", "Precio", "Total"]}
          rows={(selectedInvoice?.lines ?? []).map((line) => [
            line.lineNumber,
            line.shipmentNumber,
            `${line.itemCode} - ${line.itemDescription}`,
            formatNumber(line.quantity),
            formatNumber(line.unitPrice),
            formatNumber(line.lineTotal)
          ])}
        />
      </Card>

      <Card>
        <h2>Contabilidad</h2>
        <Table
          columns={["Estado Contable", "Numero de Asiento", "Fecha", "Usuario"]}
          rows={[
            [
              accountingStatusLabels[accounting?.accountingStatus ?? "NOT_POSTED"],
              accounting?.journalEntry?.entryNumber ?? "-",
              accounting?.journalEntry?.entryDate ? String(accounting.journalEntry.entryDate).slice(0, 10) : "-",
              accounting?.journalEntry?.createdBy ?? "-"
            ]
          ]}
        />
        <div className="toolbar-row">
          <Button disabled={saving || !selectedInvoice || selectedInvoice.status !== "POSTED"} onClick={handleAccountingPreview} type="button" variant="secondary">
            Preview
          </Button>
          <a className="ui-button ui-button-secondary" href="/accounting/journal-entries">
            Ver Asiento
          </a>
          <Button disabled={saving || !accounting?.journalEntry} onClick={handleAccountingReverse} type="button" variant="secondary">
            Reversar
          </Button>
          <Button disabled={saving || !accounting?.journalEntry} onClick={handleAccountingRepost} type="button" variant="secondary">
            Recontabilizar
          </Button>
        </div>
        {accountingPreview ? (
          <Table
            columns={["Linea", "Tipo", "Cuenta", "Debito", "Credito"]}
            rows={accountingPreview.lines.map((line) => [
              line.lineNumber,
              line.side === "DEBIT" ? "Debito" : "Credito",
              `${line.accountCode} - ${line.accountName}`,
              formatNumber(line.debitAmount),
              formatNumber(line.creditAmount)
            ])}
          />
        ) : null}
      </Card>
    </div>
  );
}
