import { type FormEvent, useEffect, useState } from "react";

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
import { fetchCatalogLookup } from "../../modules/runtime-ui/services/metadataClient.js";
import type { LookupOption } from "../../modules/runtime-ui/types/runtime-ui.types.js";
import { getCashFlow, type CashFlowLine, type CashFlowQuery, type CashFlowSummary } from "../../services/cashFlowClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultFilters: CashFlowQuery = {
  dateFrom: "2025-02-01",
  dateTo: "2025-02-28",
  compareDateFrom: "",
  compareDateTo: "",
  costCenterId: "",
  sourceModule: "",
  currencyCode: "",
  search: ""
};

const emptySummary: CashFlowSummary = {
  operatingCashFlow: 0,
  operatingCashFlowBase: 0,
  investingCashFlow: 0,
  investingCashFlowBase: 0,
  financingCashFlow: 0,
  financingCashFlowBase: 0,
  netChange: 0,
  netChangeBase: 0,
  beginningCash: 0,
  beginningCashBase: 0,
  endingCash: 0,
  endingCashBase: 0,
  hasMultipleCurrencies: false,
  currencyTotals: [],
  movementCount: 0
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function summaryAmount(summary: CashFlowSummary, original: keyof CashFlowSummary, base: keyof CashFlowSummary) {
  return summary.hasMultipleCurrencies ? money(summary[base] as number) : money(summary[original] as number | null);
}

function cleanQuery(filters: CashFlowQuery) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as CashFlowQuery;
}

export function CashFlowPage() {
  const [filters, setFilters] = useState<CashFlowQuery>(defaultFilters);
  const [costCenters, setCostCenters] = useState<LookupOption[]>([]);
  const [records, setRecords] = useState<CashFlowLine[]>([]);
  const [summary, setSummary] = useState<CashFlowSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadReferences() {
    try {
      setReferencesLoading(true);
      const costCenterResult = await fetchCatalogLookup("cost-centers", { pageSize: 100 });
      setCostCenters(costCenterResult.filter((costCenter) => costCenter.isActive !== false));
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar centros de costo."
      });
    } finally {
      setReferencesLoading(false);
    }
  }

  async function loadCashFlow(nextFilters = filters) {
    if (nextFilters.dateFrom && nextFilters.dateTo && nextFilters.dateFrom > nextFilters.dateTo) {
      setFeedback({ tone: "warning", message: "La fecha desde no puede ser mayor que la fecha hasta." });
      return;
    }
    if (nextFilters.compareDateFrom && nextFilters.compareDateTo && nextFilters.compareDateFrom > nextFilters.compareDateTo) {
      setFeedback({ tone: "warning", message: "El periodo comparativo tiene fechas invalidas." });
      return;
    }

    try {
      setLoading(true);
      const result = await getCashFlow(cleanQuery(nextFilters));
      setRecords(result.records);
      setSummary(result.summary);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo consultar el Flujo de Efectivo."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferences();
  }, []);

  useEffect(() => {
    if (!referencesLoading) {
      loadCashFlow(filters);
    }
  }, [referencesLoading]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loadCashFlow(filters);
  }

  const hasComparison = Boolean(summary.comparison);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Flujo de Efectivo"
        description="Consulta read-only por metodo indirecto con actividades de operacion, inversion y financiamiento."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/balance-sheet">
              Balance General
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/income-statement">
              Estado de Resultados
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
            <FormField label="Desde">
              <Input
                disabled={loading}
                type="date"
                value={filters.dateFrom}
                onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              />
            </FormField>
            <FormField label="Hasta">
              <Input
                disabled={loading}
                type="date"
                value={filters.dateTo}
                onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              />
            </FormField>
            <FormField label="Comparar desde">
              <Input
                disabled={loading}
                type="date"
                value={filters.compareDateFrom}
                onChange={(event) => setFilters((current) => ({ ...current, compareDateFrom: event.target.value }))}
              />
            </FormField>
            <FormField label="Comparar hasta">
              <Input
                disabled={loading}
                type="date"
                value={filters.compareDateTo}
                onChange={(event) => setFilters((current) => ({ ...current, compareDateTo: event.target.value }))}
              />
            </FormField>
            <FormField label="Centro de costo">
              <Select
                disabled={referencesLoading || loading}
                value={filters.costCenterId}
                onChange={(event) => setFilters((current) => ({ ...current, costCenterId: event.target.value }))}
              >
                <option value="">Todos</option>
                {costCenters.map((costCenter) => (
                  <option key={costCenter.value} value={costCenter.value}>
                    {costCenter.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Moneda">
              <Input
                disabled={loading}
                value={filters.currencyCode}
                onChange={(event) => setFilters((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
                placeholder="DOP"
              />
            </FormField>
            <FormField label="Buscar">
              <Input
                disabled={loading}
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Cuenta o referencia"
              />
            </FormField>
            <Button disabled={loading || referencesLoading} type="submit" variant="secondary">
              Consultar
            </Button>
          </FilterBar>
        </form>
      </Card>

      <div className="stats-grid">
        <Card>
          <span className="metric-label">Flujo operativo</span>
          <strong className="metric-value">{summaryAmount(summary, "operatingCashFlow", "operatingCashFlowBase")}</strong>
          <span className="muted-text">{summary.hasMultipleCurrencies ? "Consolidado base" : `Base ${money(summary.operatingCashFlowBase)}`}</span>
        </Card>
        <Card>
          <span className="metric-label">Flujo inversion</span>
          <strong className="metric-value">{summaryAmount(summary, "investingCashFlow", "investingCashFlowBase")}</strong>
          <span className="muted-text">Base {money(summary.investingCashFlowBase)}</span>
        </Card>
        <Card>
          <span className="metric-label">Flujo financiamiento</span>
          <strong className="metric-value">{summaryAmount(summary, "financingCashFlow", "financingCashFlowBase")}</strong>
          <span className="muted-text">Base {money(summary.financingCashFlowBase)}</span>
        </Card>
        <Card>
          <span className="metric-label">Variacion neta</span>
          <strong className="metric-value">{summaryAmount(summary, "netChange", "netChangeBase")}</strong>
          <span className="muted-text">Efectivo final {money(summary.endingCashBase)} base</span>
        </Card>
      </div>

      {summary.hasMultipleCurrencies ? (
        <Alert tone="warning">La consulta tiene varias monedas; los importes originales se muestran por moneda y el resumen consolidado usa valores base.</Alert>
      ) : null}

      <Card>
        <Table
          columns={["Concepto", "Actual", "Comparativo", "Variacion"]}
          rows={[
            ["Flujo operativo", summaryAmount(summary, "operatingCashFlow", "operatingCashFlowBase"), hasComparison ? money(summary.comparison?.operatingCashFlowBase) : "-", hasComparison ? money((summary.operatingCashFlowBase ?? 0) - (summary.comparison?.operatingCashFlowBase ?? 0)) : "-"],
            ["Flujo inversion", summaryAmount(summary, "investingCashFlow", "investingCashFlowBase"), hasComparison ? money(summary.comparison?.investingCashFlowBase) : "-", hasComparison ? money((summary.investingCashFlowBase ?? 0) - (summary.comparison?.investingCashFlowBase ?? 0)) : "-"],
            ["Flujo financiamiento", summaryAmount(summary, "financingCashFlow", "financingCashFlowBase"), hasComparison ? money(summary.comparison?.financingCashFlowBase) : "-", hasComparison ? money((summary.financingCashFlowBase ?? 0) - (summary.comparison?.financingCashFlowBase ?? 0)) : "-"],
            ["Variacion neta", summaryAmount(summary, "netChange", "netChangeBase"), hasComparison ? money(summary.comparison?.netChangeBase) : "-", hasComparison ? money(summary.comparison?.varianceNetChangeBase) : "-"],
            ["Efectivo inicial", summaryAmount(summary, "beginningCash", "beginningCashBase"), hasComparison ? money(summary.comparison?.beginningCashBase) : "-", hasComparison ? money((summary.beginningCashBase ?? 0) - (summary.comparison?.beginningCashBase ?? 0)) : "-"],
            ["Efectivo final", summaryAmount(summary, "endingCash", "endingCashBase"), hasComparison ? money(summary.comparison?.endingCashBase) : "-", hasComparison ? money((summary.endingCashBase ?? 0) - (summary.comparison?.endingCashBase ?? 0)) : "-"]
          ]}
        />
      </Card>

      {summary.currencyTotals.length > 0 ? (
        <Card>
          <Table
            columns={["Moneda", "Operacion", "Inversion", "Financiamiento", "Variacion", "Inicial", "Final", "Movimientos"]}
            rows={summary.currencyTotals.map((currency) => [
              currency.currencyCode,
              money(currency.operatingCashFlow),
              money(currency.investingCashFlow),
              money(currency.financingCashFlow),
              money(currency.netChange),
              money(currency.beginningCash),
              money(currency.endingCash),
              String(currency.movementCount)
            ])}
          />
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Cargando Flujo de Efectivo..." />
      ) : feedback?.tone === "error" ? (
        <ErrorState title="API no disponible" message={feedback.message} />
      ) : records.length === 0 ? (
        <EmptyState title="Sin movimientos" description="No hay movimientos para los filtros indicados." />
      ) : (
        <Card>
          <Table
            columns={["Actividad", "Concepto", "Actual", "Base", "Comparativo", "Variacion"]}
            rows={records.map((record) => [
              record.sectionLabel,
              record.label,
              record.hasMultipleCurrencies ? "-" : money(record.amount),
              money(record.baseAmount),
              hasComparison ? money(record.comparisonBaseAmount) : "-",
              hasComparison ? money(record.varianceBase) : "-"
            ])}
          />
        </Card>
      )}
    </div>
  );
}
