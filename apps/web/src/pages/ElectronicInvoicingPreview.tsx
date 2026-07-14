import { type FormEvent, useEffect, useState } from "react";

import { Alert, Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select } from "../components/ui/index.js";
import {
  createSequence,
  emitEcf,
  getTaxConfig,
  listElectronicInvoices,
  listSequences,
  saveFullTaxConfig,
  type ElectronicInvoice,
  type ElectronicSequence
} from "../services/dgiiClient.js";
import { fetchCatalogItems } from "../modules/runtime-ui/services/metadataClient.js";
import type { CatalogRecord } from "../modules/runtime-ui/types/runtime-ui.types.js";
import { statusLabel } from "../utils/displayLabels.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const ecfTypeLabels: Record<string, string> = {
  E31: "e-31 Factura de crédito fiscal electrónica",
  E32: "e-32 Factura de consumo electrónica",
  E33: "e-33 Nota de débito electrónica",
  E34: "e-34 Nota de crédito electrónica",
  E41: "e-41 Comprobante electrónico de compras",
  E43: "e-43 Gastos menores electrónico",
  E44: "e-44 Regímenes especiales electrónico",
  E45: "e-45 Gubernamental electrónico",
  E46: "e-46 Exportaciones electrónico",
  E47: "e-47 Pagos al exterior electrónico"
};

function formatNumber(value: unknown) {
  return Number(value ?? 0).toLocaleString("es-DO", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

function normalizeInvoiceType(value: string) {
  return value.startsWith("E") ? value : `E${value}`;
}

export function ElectronicInvoicingPreview() {
  const [rnc, setRnc] = useState("");
  const [fiscalName, setFiscalName] = useState("");
  const [environment, setEnvironment] = useState("TESTECF");
  const [certAlias, setCertAlias] = useState("");
  const [certData, setCertData] = useState("");
  const [certPassword, setCertPassword] = useState("");

  const [invoiceType, setInvoiceType] = useState("E31");
  const [rangeFrom, setRangeFrom] = useState(1);
  const [rangeTo, setRangeTo] = useState(1000);
  const [prefix, setPrefix] = useState("E31");
  const [expirationDate, setExpirationDate] = useState("");

  const [sequences, setSequences] = useState<ElectronicSequence[]>([]);
  const [emittedInvoices, setEmittedInvoices] = useState<ElectronicInvoice[]>([]);
  const [postedInvoices, setPostedInvoices] = useState<CatalogRecord[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedInvoiceType, setSelectedInvoiceType] = useState("E31");

  const [selectedInvoice, setSelectedInvoice] = useState<ElectronicInvoice | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadData() {
    try {
      const [taxConfig, seqList, emittedList, catalogInvoices] = await Promise.all([
        getTaxConfig(),
        listSequences(),
        listElectronicInvoices(),
        fetchCatalogItems("sales-invoices", { page: 1, pageSize: 50, sortBy: "invoiceDate", sortDirection: "desc" })
      ]);

      if (taxConfig) {
        setRnc(taxConfig.Rnc ?? "");
        setFiscalName(taxConfig.FiscalName ?? "");
        setEnvironment(taxConfig.Environment ?? "TESTECF");
        setCertAlias(taxConfig.CertificateAlias ?? "");
      }

      setSequences(seqList);
      setEmittedInvoices(emittedList);

      const posted = catalogInvoices.items.filter(
        (invoice) => invoice.status === "POSTED" && !emittedList.some((emitted) => emitted.sourceInvoiceId === invoice.id)
      );
      setPostedInvoices(posted);
      if (posted[0]) {
        setSelectedInvoiceId(String(posted[0].id));
      }
    } catch (error: unknown) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo cargar la facturación electrónica."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveConfig(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await saveFullTaxConfig({
        rnc: rnc.trim(),
        fiscalName: fiscalName.trim() || undefined,
        environment,
        certificateAlias: certAlias.trim() || undefined,
        certificateData: certData.trim() || undefined,
        certificatePassword: certPassword.trim() || undefined
      });
      setFeedback({ tone: "success", message: "Configuración fiscal guardada correctamente." });
      setCertData("");
      setCertPassword("");
      await loadData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo guardar la configuración fiscal." });
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSequence(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await createSequence({
        invoiceType,
        rangeFrom,
        rangeTo,
        prefix: prefix.trim(),
        expirationDate: expirationDate || undefined
      });
      setFeedback({ tone: "success", message: "Secuencia e-CF creada correctamente." });
      await loadData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo crear la secuencia e-CF." });
    } finally {
      setSaving(false);
    }
  }

  async function handleEmitEcf(event: FormEvent) {
    event.preventDefault();
    if (!selectedInvoiceId) return;
    setSaving(true);
    setFeedback(null);
    try {
      const result = await emitEcf(selectedInvoiceId, { invoiceType: selectedInvoiceType });
      setFeedback({
        tone: "success",
        message: `Comprobante ${result.ecfNumber} emitido correctamente. TrackId: ${result.trackId}`
      });
      await loadData();
    } catch (error: unknown) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo emitir el comprobante e-CF." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <LoadingState label="Cargando facturación electrónica..." />;
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="DGII"
        title="Facturación Electrónica e-CF"
        description="Emisión y trazabilidad de Comprobantes Fiscales Electrónicos para facturas de venta posteadas."
      />

      {feedback && (
        <Alert tone={feedback.tone}>
          <p>{feedback.message}</p>
        </Alert>
      )}

      <div className="content-grid">
        <div className="ui-card">
          <form onSubmit={handleSaveConfig} className="settings-form">
            <h2>1. Emisor electrónico</h2>
            <div className="runtime-field">
              <span>RNC del emisor <strong>*</strong></span>
              <Input required placeholder="101001234" value={rnc} onChange={(event) => setRnc(event.target.value)} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Razón social fiscal</span>
              <Input placeholder="Nombre fiscal del emisor" value={fiscalName} onChange={(event) => setFiscalName(event.target.value)} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Ambiente DGII</span>
              <Select value={environment} onChange={(event) => setEnvironment(event.target.value)} disabled={saving}>
                <option value="TESTECF">TesteCF</option>
                <option value="CERTECF">CerteCF</option>
                <option value="PRODUCCION">Producción</option>
              </Select>
            </div>
            <div className="runtime-field">
              <span>Alias del certificado</span>
              <Input placeholder="Certificado digital .p12 / .pfx" value={certAlias} onChange={(event) => setCertAlias(event.target.value)} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Certificado Base64</span>
              <Input type="password" placeholder="Opcional para pruebas locales" value={certData} onChange={(event) => setCertData(event.target.value)} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Contraseña del certificado</span>
              <Input type="password" placeholder="No se muestra ni se reutiliza en pantalla" value={certPassword} onChange={(event) => setCertPassword(event.target.value)} disabled={saving} />
            </div>
            <Button type="submit" disabled={saving || !rnc} variant="primary">
              Guardar configuración fiscal
            </Button>
          </form>
        </div>

        <div className="ui-card">
          <form onSubmit={handleCreateSequence} className="settings-form">
            <h2>2. Secuencias e-CF</h2>
            <div className="runtime-field">
              <span>Tipo de comprobante</span>
              <Select
                value={invoiceType}
                onChange={(event) => {
                  setInvoiceType(event.target.value);
                  setPrefix(event.target.value);
                }}
                disabled={saving}
              >
                {Object.entries(ecfTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="operation-form-row">
              <div className="runtime-field">
                <span>Desde</span>
                <Input type="number" required value={rangeFrom} onChange={(event) => setRangeFrom(Number(event.target.value))} disabled={saving} />
              </div>
              <div className="runtime-field">
                <span>Hasta</span>
                <Input type="number" required value={rangeTo} onChange={(event) => setRangeTo(Number(event.target.value))} disabled={saving} />
              </div>
            </div>
            <div className="runtime-field">
              <span>Prefijo</span>
              <Input required value={prefix} onChange={(event) => setPrefix(event.target.value)} disabled={saving} />
            </div>
            <div className="runtime-field">
              <span>Vencimiento de secuencia</span>
              <Input type="date" value={expirationDate} onChange={(event) => setExpirationDate(event.target.value)} disabled={saving} />
            </div>
            <Button type="submit" disabled={saving} variant="primary">
              Crear secuencia e-CF
            </Button>
          </form>
        </div>
      </div>

      <div className="content-grid">
        <div className="ui-card">
          <form onSubmit={handleEmitEcf} className="settings-form">
            <h2>3. Emitir e-CF</h2>
            {postedInvoices.length === 0 ? (
              <p style={{ color: "var(--muted)", margin: "16px 0" }}>
                No hay facturas de venta posteadas pendientes de e-CF.
              </p>
            ) : (
              <>
                <div className="runtime-field">
                  <span>Factura de venta posteada</span>
                  <Select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)} disabled={saving}>
                    {postedInvoices.map((invoice) => (
                      <option key={String(invoice.id)} value={String(invoice.id)}>
                        {String(invoice.code)} - {String(invoice.name)} (Total: ${formatNumber(invoice.totalAmount)})
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="runtime-field">
                  <span>Tipo e-CF</span>
                  <Select value={selectedInvoiceType} onChange={(event) => setSelectedInvoiceType(event.target.value)} disabled={saving}>
                    {Object.entries(ecfTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" disabled={saving || !selectedInvoiceId} variant="primary">
                  Generar y emitir e-CF
                </Button>
              </>
            )}
          </form>
        </div>

        <div className="ui-card">
          <h2>Secuencias activas</h2>
          {sequences.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: "16px 0" }}>No hay secuencias registradas.</p>
          ) : (
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Ambiente</th>
                  <th>Prefijo</th>
                  <th>Siguiente</th>
                  <th>Límite</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((sequence) => (
                  <tr key={sequence.id}>
                    <td><strong>{normalizeInvoiceType(sequence.invoiceType)}</strong></td>
                    <td>{sequence.environment}</td>
                    <td>{sequence.prefix}</td>
                    <td>{sequence.nextNumber}</td>
                    <td>{sequence.rangeTo}</td>
                    <td>
                      <Badge tone={sequence.isActive ? "green" : "red"}>
                        {sequence.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="ui-card">
        <h2>Historial de e-CF</h2>
        {emittedInvoices.length === 0 ? (
          <ErrorState message="No se han emitido comprobantes electrónicos todavía." />
        ) : (
          <div className="ui-table-wrap">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>e-CF</th>
                  <th>Tipo</th>
                  <th>Factura origen</th>
                  <th>TrackId</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {emittedInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td><strong>{invoice.ecfNumber}</strong></td>
                    <td>{normalizeInvoiceType(invoice.invoiceType)}</td>
                    <td>{invoice.sourceInvoiceNumber}</td>
                    <td><code style={{ fontSize: "0.8rem" }}>{invoice.trackId || "N/D"}</code></td>
                    <td><strong>${formatNumber(invoice.totalAmount)}</strong></td>
                    <td>
                      <Badge tone={invoice.status === "ACCEPTED" ? "green" : invoice.status === "REJECTED" ? "red" : "amber"}>
                        {statusLabel(invoice.status)}
                      </Badge>
                    </td>
                    <td>
                      <Button onClick={() => setSelectedInvoice(invoice)} variant="secondary">
                        Ver XML
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedInvoice && (
        <Card style={{ marginTop: "20px", border: "1px solid var(--primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
            <h2>Comprobante {selectedInvoice.ecfNumber}</h2>
            <Button onClick={() => setSelectedInvoice(null)} variant="secondary">
              Cerrar
            </Button>
          </div>

          <div className="operation-summary" style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "20px", marginTop: "12px" }}>
            <div>
              <div><strong>Compañía emisora:</strong> {selectedInvoice.companyName}</div>
              <div><strong>Tipo documento:</strong> {normalizeInvoiceType(selectedInvoice.invoiceType)}</div>
              <div><strong>Fecha emisión:</strong> {new Date(selectedInvoice.createdAt).toLocaleString("es-DO")}</div>
              <div><strong>Monto total:</strong> ${formatNumber(selectedInvoice.totalAmount)}</div>
              <div><strong>TrackId:</strong> <code>{selectedInvoice.trackId || "N/D"}</code></div>
              <div style={{ marginTop: "12px" }}>
                <strong>XML firmado / trazabilidad:</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--muted)", wordBreak: "break-all", background: "var(--surface-muted)", border: "1px solid var(--border)", padding: "8px", borderRadius: "var(--radius-sm)", maxHeight: "120px", overflowY: "auto" }}>
                  {selectedInvoice.signedXml.substring(0, 1600)}...
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <svg width="120" height="120" viewBox="0 0 24 24" style={{ background: "#ffffff", padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <rect x="0" y="0" width="6" height="6" fill="black" />
                <rect x="18" y="0" width="6" height="6" fill="black" />
                <rect x="0" y="18" width="6" height="6" fill="black" />
                <rect x="2" y="2" width="2" height="2" fill="white" />
                <rect x="20" y="2" width="2" height="2" fill="white" />
                <rect x="2" y="20" width="2" height="2" fill="white" />
                <rect x="9" y="2" width="4" height="4" fill="black" />
                <rect x="14" y="8" width="2" height="6" fill="black" />
                <rect x="8" y="12" width="4" height="2" fill="black" />
                <rect x="16" y="16" width="4" height="4" fill="black" />
              </svg>
              <small style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "4px" }}>
                Representación visual del e-CF
              </small>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
