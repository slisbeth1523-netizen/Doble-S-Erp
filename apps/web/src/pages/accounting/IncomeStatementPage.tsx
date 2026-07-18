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
import {
  getIncomeStatement,
  type IncomeStatementLine,
  type IncomeStatementQuery,
  type IncomeStatementSummary
} from "../../services/incomeStatementClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultFilters: IncomeStatementQuery = {
  accountingPeriodId: "",
  costCenterId: "",
  sourceModule: "",
  currencyCode: "",
  dateFrom: "2025-02-01",
  dateTo: "2025-02-28",
  compareDateFrom: "",
  compareDateTo: "",
  search: ""
};

const emptySummary: IncomeStatementSummary = {
  totalRevenue: 0,
  totalRevenueBase: 0,
  costs: 0,
  costsBase: 0,
  grossProfit: 0,
  grossProfitBase: 0,
  operatingExpenses: 0,
  operatingExpensesBase: 0,
  operatingIncome: 0,
  operatingIncomeBase: 0,
  otherIncome: 0,
  otherIncomeBase: 0,
  otherExpenses: 0,
  otherExpensesBase: 0,
  profitBeforeTax: 0,
  profitBeforeTaxBase: 0,
  netIncome: 0,
  netIncomeBase: 0,
  hasMultipleCurrencies: false,
  currencyTotals: [],
  movementCount: 0
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function summaryAmount(summary: IncomeStatementSummary, original: keyof IncomeStatementSummary, base: keyof IncomeStatementSummary) {
  return summary.hasMultipleCurrencies ? money(summary[base] as number) : money(summary[original] as number | null);
}

function cleanQuery(filters: IncomeStatementQuery) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as IncomeStatementQuery;
}

export function IncomeStatementPage() {
  const [filters, setFilters] = useState<IncomeStatementQuery>(defaultFilters);
  const [costCenters, setCostCenters] = useState<LookupOption[]>([]);
  const [periods, setPeriods] = useState<LookupOption[]>([]);
  const [records, setRecords] = useState<IncomeStatementLine[]>([]);
  const [summary, setSummary] = useState<IncomeStatementSummary>(emptySummary);
  const [loading, setLoading] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadReferences() {
    try {
      setReferencesLoading(true);
      const [costCenterResult, periodResult] = await Promise.all([
        fetchCatalogLookup("cost-centers", { pageSize: 100 }),
        fetchCatalogLookup("accounting-periods", { pageSize: 100 })
      ]);
      setCostCenters(costCenterResult.filter((costCenter) => costCenter.isActive !== false));
      setPeriods(periodResult.filter((period) => period.isActive !== false));
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar periodos o centros."
      });
    } finally {
      setReferencesLoading(false);
    }
  }

  async function loadStatement(nextFilters = filters) {
    if (nextFilters.dateFrom && nextFilters.dateTo && nextFilters.dateTo < nextFilters.dateFrom) {
      setFeedback({ tone: "warning", message: "La fecha hasta no puede ser menor que la fecha desde." });
      return;
    }
    if (nextFilters.compareDateFrom && nextFilters.compareDateTo && nextFilters.compareDateTo < nextFilters.compareDateFrom) {
      setFeedback({ tone: "warning", message: "La fecha comparativa hasta no puede ser menor que la fecha desde." });
      return;
    }

    try {
      setLoading(true);
      const result = await getIncomeStatement(cleanQuery(nextFilters));
      setRecords(result.records);
      setSummary(result.summary);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo consultar el Estado de Resultados."
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
      loadStatement(filters);
    }
  }, [referencesLoading]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loadStatement(filters);
  }

  const hasComparison = Boolean(summary.comparison);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Estado de Resultados"
        description="Consulta read-only de ingresos, costos y gastos desde asientos posteados."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/trial-balance">
              Balance de Comprobacion
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/general-ledger">
              Libro Mayor
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
            <FormField label="Periodo">
              <Select
                disabled={referencesLoading || loading}
                value={filters.accountingPeriodId}
                onChange={(event) => setFilters((current) => ({ ...current, accountingPeriodId: event.target.value }))}
              >
                <option value="">Todos</option>
                {periods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </Select>
            </FormField>
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
          <span className="metric-label">Ingresos Totales</span>
          <strong className="metric-value">{summaryAmount(summary, "totalRevenue", "totalRevenueBase")}</strong>
          <span className="muted-text">{summary.hasMultipleCurrencies ? "Consolidado base" : `Base ${money(summary.totalRevenueBase)}`}</span>
        </Card>
        <Card>
          <span className="metric-label">Utilidad Bruta</span>
          <strong className="metric-value">{summaryAmount(summary, "grossProfit", "grossProfitBase")}</strong>
          <span className="muted-text">Costos {money(summary.costsBase)} base</span>
        </Card>
        <Card>
          <span className="metric-label">Utilidad Operativa</span>
          <strong className="metric-value">{summaryAmount(summary, "operatingIncome", "operatingIncomeBase")}</strong>
          <span className="muted-text">Gastos {money(summary.operatingExpensesBase)} base</span>
        </Card>
        <Card>
          <span className="metric-label">Utilidad Neta</span>
          <strong className="metric-value">{summaryAmount(summary, "netIncome", "netIncomeBase")}</strong>
          <span className="muted-text">{hasComparison ? `Variacion ${money(summary.comparison?.varianceNetIncomeBase)}` : `${summary.movementCount} movimientos`}</span>
        </Card>
      </div>

      {summary.hasMultipleCurrencies ? (
        <Alert tone="warning">La consulta tiene varias monedas; los importes originales se muestran separados y el resumen consolidado usa valores base.</Alert>
      ) : null}

      <Card>
        <Table
          columns={["Concepto", "Actual", "Comparativo", "Variacion"]}
          rows={[
            ["Ingresos Totales", summaryAmount(summary, "totalRevenue", "totalRevenueBase"), hasComparison ? money(summary.comparison?.totalRevenueBase) : "-", hasComparison ? money((summary.totalRevenueBase ?? 0) - (summary.comparison?.totalRevenueBase ?? 0)) : "-"],
            ["Costos", summaryAmount(summary, "costs", "costsBase"), hasComparison ? money(summary.comparison?.costsBase) : "-", hasComparison ? money((summary.costsBase ?? 0) - (summary.comparison?.costsBase ?? 0)) : "-"],
            ["Utilidad Bruta", summaryAmount(summary, "grossProfit", "grossProfitBase"), hasComparison ? money(summary.comparison?.grossProfitBase) : "-", hasComparison ? money((summary.grossProfitBase ?? 0) - (summary.comparison?.grossProfitBase ?? 0)) : "-"],
            ["Gastos Operativos", summaryAmount(summary, "operatingExpenses", "operatingExpensesBase"), hasComparison ? money(summary.comparison?.operatingExpensesBase) : "-", hasComparison ? money((summary.operatingExpensesBase ?? 0) - (summary.comparison?.operatingExpensesBase ?? 0)) : "-"],
            ["Utilidad Operativa", summaryAmount(summary, "operatingIncome", "operatingIncomeBase"), hasComparison ? money(summary.comparison?.operatingIncomeBase) : "-", hasComparison ? money((summary.operatingIncomeBase ?? 0) - (summary.comparison?.operatingIncomeBase ?? 0)) : "-"],
            ["Otros ingresos", summaryAmount(summary, "otherIncome", "otherIncomeBase"), hasComparison ? money(summary.comparison?.otherIncomeBase) : "-", hasComparison ? money((summary.otherIncomeBase ?? 0) - (summary.comparison?.otherIncomeBase ?? 0)) : "-"],
            ["Otros gastos", summaryAmount(summary, "otherExpenses", "otherExpensesBase"), hasComparison ? money(summary.comparison?.otherExpensesBase) : "-", hasComparison ? money((summary.otherExpensesBase ?? 0) - (summary.comparison?.otherExpensesBase ?? 0)) : "-"],
            ["Utilidad antes de impuestos", summaryAmount(summary, "profitBeforeTax", "profitBeforeTaxBase"), hasComparison ? money(summary.comparison?.profitBeforeTaxBase) : "-", hasComparison ? money((summary.profitBeforeTaxBase ?? 0) - (summary.comparison?.profitBeforeTaxBase ?? 0)) : "-"],
            ["Utilidad Neta", summaryAmount(summary, "netIncome", "netIncomeBase"), hasComparison ? money(summary.comparison?.netIncomeBase) : "-", hasComparison ? money(summary.comparison?.varianceNetIncomeBase) : "-"]
          ]}
        />
      </Card>

      {summary.currencyTotals.length > 0 ? (
        <Card>
          <Table
            columns={["Moneda", "Ingresos", "Costos", "Gastos", "Otros", "Utilidad neta", "Movimientos"]}
            rows={summary.currencyTotals.map((currency) => [
              currency.currencyCode,
              money(currency.totalRevenue),
              money(currency.costs),
              money(currency.operatingExpenses),
              money((currency.otherIncome ?? 0) - (currency.otherExpenses ?? 0)),
              money(currency.netIncome),
              String(currency.movementCount)
            ])}
          />
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Cargando Estado de Resultados..." />
      ) : feedback?.tone === "error" ? (
        <ErrorState title="API no disponible" message={feedback.message} />
      ) : records.length === 0 ? (
        <EmptyState title="Sin movimientos" description="No hay cuentas de resultados para los filtros indicados." />
      ) : (
        <Card>
          <Table
            columns={["Seccion", "Cuenta", "Nombre", "Actual", "Base", "Comparativo", "Variacion"]}
            rows={records.map((record) => [
              record.sectionLabel,
              <a key={record.accountId} href={`/accounting/general-ledger?accountId=${record.accountId}`}>
                {record.accountCode}
              </a>,
              record.accountName,
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
