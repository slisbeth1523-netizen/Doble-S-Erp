import { type FormEvent, useState } from "react";

import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterBar,
  FormField,
  Input,
  LoadingState,
  PageHeader,
  Select,
  Table
} from "../../components/ui/index.js";
import {
  previewAccountingPosting,
  type PostingPreview,
  type PostingRequest
} from "../../services/accountingPostingClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultRequest: PostingRequest = {
  sourceModule: "ACCOUNTS_RECEIVABLE",
  documentId: "",
  postingDate: "2025-02-28",
  reference: "",
  notes: ""
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function cleanPayload(payload: PostingRequest) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined && value !== "")
  ) as PostingRequest;
}

export function AccountingPostingEnginePage() {
  const [payload, setPayload] = useState<PostingRequest>(defaultRequest);
  const [preview, setPreview] = useState<PostingPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadPreview(nextPayload = payload) {
    if (!nextPayload.documentId) {
      setFeedback({ tone: "warning", message: "Indica el identificador del documento para previsualizar el asiento." });
      return;
    }

    try {
      setLoading(true);
      const result = await previewAccountingPosting(cleanPayload(nextPayload));
      setPreview(result);
      setFeedback({ tone: "success", message: "Previsualizacion generada con API conectada." });
    } catch (error) {
      setPreview(null);
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo generar la previsualizacion contable."
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loadPreview(payload);
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Motor Contable"
        description="Consulta de previsualizacion para asientos automaticos por documento fuente."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/journal-entries">
              Asientos contables
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/general-ledger">
              Libro Mayor
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/posting-rules">
              Reglas Contables
            </a>
          </div>
        }
      />

      {feedback ? (
        <Alert tone={feedback.tone} title={feedback.tone === "error" ? "Atencion" : undefined}>
          {feedback.message}
        </Alert>
      ) : null}

      <Card>
        <form onSubmit={handleSubmit}>
          <FilterBar>
            <FormField label="Modulo fuente">
              <Select
                disabled={loading}
                value={payload.sourceModule}
                onChange={(event) => setPayload((current) => ({ ...current, sourceModule: event.target.value }))}
              >
                <option value="ACCOUNTS_RECEIVABLE">Cuentas por cobrar</option>
                <option value="ACCOUNTS_PAYABLE">Cuentas por pagar</option>
                <option value="SALES_INVOICE">Factura de venta</option>
                <option value="SUPPLIER_INVOICE">Factura proveedor</option>
              </Select>
            </FormField>
            <FormField label="Documento">
              <Input
                disabled={loading}
                value={payload.documentId}
                onChange={(event) => setPayload((current) => ({ ...current, documentId: event.target.value }))}
                placeholder="UUID del documento"
              />
            </FormField>
            <FormField label="Fecha asiento">
              <Input
                disabled={loading}
                type="date"
                value={payload.postingDate}
                onChange={(event) => setPayload((current) => ({ ...current, postingDate: event.target.value }))}
              />
            </FormField>
            <FormField label="Referencia">
              <Input
                disabled={loading}
                value={payload.reference}
                onChange={(event) => setPayload((current) => ({ ...current, reference: event.target.value }))}
                placeholder="Opcional"
              />
            </FormField>
            <Button disabled={loading} type="submit" variant="secondary">
              Previsualizar
            </Button>
          </FilterBar>
        </form>
      </Card>

      {loading ? (
        <LoadingState label="Resolviendo asiento automatico..." />
      ) : feedback?.tone === "error" ? (
        <ErrorState title="No se pudo resolver" message={feedback.message} />
      ) : !preview ? (
        <EmptyState title="Sin previsualizacion" description="Selecciona un modulo e indica un documento fuente." />
      ) : (
        <>
          <div className="stats-grid">
            <Card>
              <span className="metric-label">Documento</span>
              <strong className="metric-value">{preview.documentNumber}</strong>
              <span className="muted-text">{preview.sourceDocumentType}</span>
            </Card>
            <Card>
              <span className="metric-label">Debito</span>
              <strong className="metric-value">{money(preview.totalDebit)}</strong>
              <span className="muted-text">Base {money(preview.totalDebitBase)}</span>
            </Card>
            <Card>
              <span className="metric-label">Credito</span>
              <strong className="metric-value">{money(preview.totalCredit)}</strong>
              <span className="muted-text">Base {money(preview.totalCreditBase)}</span>
            </Card>
            <Card>
              <span className="metric-label">Diferencia</span>
              <strong className="metric-value">{money(preview.difference)}</strong>
              <span className="muted-text">Moneda {preview.currencyCode}</span>
            </Card>
          </div>

          <Card>
            <Table
              columns={["Linea", "Lado", "Cuenta", "Descripcion", "Debito", "Credito", "Base debito", "Base credito"]}
              rows={preview.lines.map((line) => [
                String(line.lineNumber),
                line.side === "DEBIT" ? "Debito" : "Credito",
                `${line.accountCode} ${line.accountName}`,
                line.description,
                money(line.debitAmount),
                money(line.creditAmount),
                money(line.debitBaseAmount),
                money(line.creditBaseAmount)
              ])}
            />
          </Card>
        </>
      )}
    </div>
  );
}
