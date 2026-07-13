import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select, Table, Textarea } from "../components/ui/index.js";
import type { CatalogRecord, LookupOption } from "../modules/runtime-ui/types/runtime-ui.types.js";
import {
  addSalesQuotationLine,
  createSalesQuotation,
  deleteSalesQuotationLine,
  listSalesQuotations,
  loadSalesQuotationOptions,
  loadSalesQuotationSnapshots,
  optionLabel,
  recordNumber,
  transitionSalesQuotation,
  updateSalesQuotationLine,
  type SalesQuotation,
  type SalesQuotationLine,
  type SalesQuotationStatus
} from "../services/salesQuotationsClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const statusLabels: Record<SalesQuotationStatus, string> = {
  DRAFT: "Borrador",
  SENT: "Enviada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  EXPIRED: "Vencida",
  CONVERTED: "Convertida"
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

  if (status === "REJECTED" || status === "EXPIRED") {
    return "red";
  }

  if (status === "SENT") {
    return "blue";
  }

  return "amber";
}

function statusLabel(status?: string) {
  return statusLabels[status as SalesQuotationStatus] ?? "Sin cotizacion";
}

function defaultValidUntil() {
  return new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function SalesQuotationsPreview() {
  const [customers, setCustomers] = useState<LookupOption[]>([]);
  const [items, setItems] = useState<LookupOption[]>([]);
  const [units, setUnits] = useState<LookupOption[]>([]);
  const [snapshots, setSnapshots] = useState<{ quotations: CatalogRecord[]; lines: CatalogRecord[] }>({
    quotations: [],
    lines: []
  });
  const [records, setRecords] = useState<SalesQuotation[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [currencyCode, setCurrencyCode] = useState("DOP");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [quotation, setQuotation] = useState<SalesQuotation | null>(null);
  const [itemId, setItemId] = useState("");
  const [unitOfMeasureId, setUnitOfMeasureId] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(18);
  const [editingLine, setEditingLine] = useState<SalesQuotationLine | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apiConnected = customers.length > 0 && items.length > 0 && units.length > 0;
  const editable = quotation?.status === "DRAFT";
  const selectedCustomer = useMemo(() => optionLabel(customers, customerId), [customerId, customers]);

  async function refreshSnapshots() {
    const [snapshot, list] = await Promise.all([
      loadSalesQuotationSnapshots(),
      listSalesQuotations({ search, status, page: 1, pageSize: 10 })
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
  }

  useEffect(() => {
    let active = true;

    Promise.all([loadSalesQuotationOptions(), loadSalesQuotationSnapshots(), listSalesQuotations({ page: 1, pageSize: 10 })])
      .then(([options, snapshot, list]) => {
        if (!active) {
          return;
        }

        setCustomers(options.customers);
        setItems(options.items);
        setUnits(options.units);
        setSnapshots(snapshot);
        setRecords(list.records);
        setCustomerId(options.customers[0]?.value ?? "");
        setItemId(options.items[0]?.value ?? "");
        setUnitOfMeasureId(options.units[0]?.value ?? "");
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
      const list = await listSalesQuotations({ search, status, page: 1, pageSize: 10 });
      setRecords(list.records);
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo consultar cotizaciones." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const result = await createSalesQuotation({
        customerId,
        validUntil: new Date(validUntil).toISOString(),
        currencyCode,
        exchangeRate,
        reference: reference || null,
        notes: notes || null
      });
      setQuotation(result);
      setFeedback({ tone: "success", message: `Cotizacion ${result.quotationNumber} creada en borrador.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la cotizacion." });
    } finally {
      setSaving(false);
    }
  }

  async function handleLineSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quotation || !editable) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const payload = {
        itemId,
        unitOfMeasureId,
        description: description || undefined,
        quantity,
        unitPrice,
        discountPercent,
        taxPercent,
        notes: "Linea registrada desde UI de cotizaciones"
      };
      const result = editingLine
        ? await updateSalesQuotationLine(quotation.id, editingLine.id, payload)
        : await addSalesQuotationLine(quotation.id, payload);
      setQuotation(result);
      resetLineForm();
      setFeedback({ tone: "success", message: "Linea guardada y totales recalculados." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar la linea." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteLine(line: SalesQuotationLine) {
    if (!quotation || !editable || !window.confirm("Quieres eliminar esta linea?")) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await deleteSalesQuotationLine(quotation.id, line.id);
      setQuotation(result);
      setFeedback({ tone: "success", message: "Linea eliminada y totales recalculados." });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo eliminar la linea." });
    } finally {
      setSaving(false);
    }
  }

  function editLine(line: SalesQuotationLine) {
    setEditingLine(line);
    setItemId(line.itemId);
    setUnitOfMeasureId(line.unitOfMeasureId);
    setDescription(line.description);
    setQuantity(line.quantity);
    setUnitPrice(line.unitPrice);
    setDiscountPercent(line.discountPercent);
    setTaxPercent(line.taxPercent);
  }

  async function handleTransition(action: "send" | "approve" | "reject" | "expire", label: string) {
    if (!quotation || !window.confirm(`Confirmas ${label.toLowerCase()} esta cotizacion?`)) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const result = await transitionSalesQuotation(quotation.id, action);
      setQuotation(result);
      setFeedback({ tone: "success", message: `Cotizacion ${label.toLowerCase()} correctamente.` });
      await refreshSnapshots();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : `No se pudo ${label.toLowerCase()}.` });
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
            <Button onClick={() => navigate("/master-data/sales-quotations")} type="button" variant="secondary">
              Consulta
            </Button>
            <Button onClick={() => navigate("/master-data/customers")} type="button" variant="secondary">
              Clientes
            </Button>
          </div>
        }
        description="Crea cotizaciones, ajusta lineas y controla estados sin afectar inventario ni cuentas por cobrar."
        eyebrow="Ventas"
        title="Cotizaciones"
      />

      {loading ? <LoadingState label="Conectando con ventas..." /> : null}
      {feedback ? <Alert tone={feedback.tone}>{feedback.message}</Alert> : null}
      {!loading && !apiConnected ? <ErrorState message="No se pudieron cargar clientes, articulos y unidades desde la API." /> : null}

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Crear cotizacion</h2>
              <p>El numero se genera automaticamente y los totales empiezan en cero.</p>
            </div>
            <Badge tone="blue">Borrador</Badge>
          </div>
          <form className="operation-form" onSubmit={handleCreate}>
            <label>
              <span>Cliente</span>
              <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
                {customers.map((customer) => (
                  <option key={customer.value} value={customer.value}>
                    {customer.code ? `${customer.code} - ${customer.label}` : customer.label}
                  </option>
                ))}
              </Select>
            </label>
            <div className="operation-form-row">
              <label>
                <span>Vigente hasta</span>
                <Input type="datetime-local" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} required />
              </label>
              <label>
                <span>Moneda</span>
                <Input maxLength={3} value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value.toUpperCase())} />
              </label>
            </div>
            <label>
              <span>Tasa</span>
              <Input min="0.000001" step="0.000001" type="number" value={exchangeRate} onChange={(event) => setExchangeRate(Number(event.target.value))} />
            </label>
            <label>
              <span>Referencia</span>
              <Input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Cotizacion inicial" />
            </label>
            <label>
              <span>Notas</span>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Notas internas" />
            </label>
            <Button disabled={saving || !apiConnected || !customerId || !validUntil || exchangeRate <= 0} type="submit">
              Crear cotizacion
            </Button>
          </form>
        </Card>

        <Card>
          <div className="panel-heading">
            <div>
              <h2>Detalle</h2>
              <p>{quotation ? `${quotation.quotationNumber} para ${quotation.customerName}` : "Selecciona o crea una cotizacion."}</p>
            </div>
            <Badge tone={statusTone(quotation?.status)}>{statusLabel(quotation?.status)}</Badge>
          </div>
          <div className="operation-summary">
            <span>Subtotal: {formatNumber(quotation?.subtotalAmount)}</span>
            <span>Descuento: {formatNumber(quotation?.discountAmount)}</span>
            <span>Impuesto: {formatNumber(quotation?.taxAmount)}</span>
            <strong>Total: {formatNumber(quotation?.totalAmount)}</strong>
            <div className="runtime-page-actions">
              <Button disabled={saving || quotation?.status !== "DRAFT"} onClick={() => handleTransition("send", "Enviar")} type="button">
                Enviar
              </Button>
              <Button disabled={saving || quotation?.status !== "SENT"} onClick={() => handleTransition("approve", "Aprobar")} type="button">
                Aprobar
              </Button>
              <Button disabled={saving || quotation?.status !== "SENT"} onClick={() => handleTransition("reject", "Rechazar")} type="button" variant="danger">
                Rechazar
              </Button>
              <Button disabled={saving || !quotation || (quotation.status !== "DRAFT" && quotation.status !== "SENT")} onClick={() => handleTransition("expire", "Expirar")} type="button" variant="secondary">
                Expirar
              </Button>
            </div>
          </div>
          <Alert tone="info">Cliente seleccionado: {selectedCustomer}. Las cotizaciones no crean facturas, CxC ni movimientos de inventario.</Alert>
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>{editingLine ? "Editar linea" : "Agregar linea"}</h2>
              <p>Los importes se calculan en backend al guardar.</p>
            </div>
            <Badge tone={editable ? "green" : "amber"}>{editable ? "Editable" : "Solo consulta"}</Badge>
          </div>
          <form className="operation-form" onSubmit={handleLineSubmit}>
            <label>
              <span>Articulo</span>
              <Select disabled={!editable} value={itemId} onChange={(event) => setItemId(event.target.value)} required>
                {items.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.code ? `${item.code} - ${item.label}` : item.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Unidad</span>
              <Select disabled={!editable} value={unitOfMeasureId} onChange={(event) => setUnitOfMeasureId(event.target.value)} required>
                {units.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.code ? `${unit.code} - ${unit.label}` : unit.label}
                  </option>
                ))}
              </Select>
            </label>
            <label>
              <span>Descripcion</span>
              <Input disabled={!editable} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Usa la descripcion del articulo si se deja vacio" />
            </label>
            <div className="operation-form-row">
              <label>
                <span>Cantidad</span>
                <Input disabled={!editable} min="0.0001" step="0.0001" type="number" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
              </label>
              <label>
                <span>Precio</span>
                <Input disabled={!editable} min="0" step="0.0001" type="number" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} />
              </label>
            </div>
            <div className="operation-form-row">
              <label>
                <span>Descuento %</span>
                <Input disabled={!editable} min="0" max="100" step="0.0001" type="number" value={discountPercent} onChange={(event) => setDiscountPercent(Number(event.target.value))} />
              </label>
              <label>
                <span>Impuesto %</span>
                <Input disabled={!editable} min="0" max="100" step="0.0001" type="number" value={taxPercent} onChange={(event) => setTaxPercent(Number(event.target.value))} />
              </label>
            </div>
            <div className="runtime-page-actions">
              <Button disabled={saving || !quotation || !editable || !itemId || !unitOfMeasureId || quantity <= 0} type="submit">
                {editingLine ? "Guardar linea" : "Agregar linea"}
              </Button>
              <Button disabled={!editingLine} onClick={resetLineForm} type="button" variant="secondary">
                Limpiar
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <h2>Lineas de la cotizacion</h2>
          <Table
            columns={["Linea", "Articulo", "Cant.", "Precio", "Total", "Accion"]}
            rows={(quotation?.lines ?? []).map((line) => [
              String(line.lineNumber),
              line.description,
              formatNumber(line.quantity),
              formatNumber(line.unitPrice),
              formatNumber(line.lineTotal),
              <div className="runtime-page-actions" key={line.id}>
                <Button disabled={!editable} onClick={() => editLine(line)} type="button" variant="secondary">
                  Editar
                </Button>
                <Button disabled={!editable} onClick={() => handleDeleteLine(line)} type="button" variant="danger">
                  Eliminar
                </Button>
              </div>
            ])}
          />
        </Card>
      </section>

      <section className="inventory-operation-grid">
        <Card>
          <div className="panel-heading">
            <div>
              <h2>Cotizaciones</h2>
              <p>Busqueda operativa con filtros basicos.</p>
            </div>
          </div>
          <form className="operation-form" onSubmit={handleSearch}>
            <div className="operation-form-row">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar numero o cliente" />
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">Todos</option>
                <option value="DRAFT">Borrador</option>
                <option value="SENT">Enviada</option>
                <option value="APPROVED">Aprobada</option>
                <option value="REJECTED">Rechazada</option>
                <option value="EXPIRED">Vencida</option>
              </Select>
            </div>
            <Button disabled={saving} type="submit" variant="secondary">
              Filtrar
            </Button>
          </form>
          <Table
            columns={["Cotizacion", "Cliente", "Estado", "Total"]}
            rows={records.map((record) => [
              <button className="link-button" key={record.id} onClick={() => setQuotation(record)} type="button">
                {record.quotationNumber}
              </button>,
              record.customerName,
              <Badge tone={statusTone(record.status)}>{statusLabel(record.status)}</Badge>,
              formatNumber(record.totalAmount)
            ])}
          />
        </Card>

        <Card>
          <h2>Consulta runtime</h2>
          <Table
            columns={["Cotizacion", "Cliente", "Estado", "Total"]}
            rows={snapshots.quotations.map((record) => [
              String(record.quotationNumber ?? record.code ?? ""),
              String(record.customerName ?? record.name ?? ""),
              <Badge tone={statusTone(String(record.status ?? ""))}>{statusLabel(String(record.status ?? ""))}</Badge>,
              formatNumber(recordNumber(record, "totalAmount"))
            ])}
          />
          <Button onClick={() => navigate("/master-data/sales-quotation-lines")} type="button" variant="secondary">
            Ver lineas
          </Button>
        </Card>
      </section>
    </div>
  );
}
