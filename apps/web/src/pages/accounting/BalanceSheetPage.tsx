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
  getBalanceSheet,
  type BalanceSheetLine,
  type BalanceSheetQuery,
  type BalanceSheetSummary
} from "../../services/balanceSheetClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultFilters: BalanceSheetQuery = {
  asOfDate: "2025-02-28",
  compareAsOfDate: "",
  costCenterId: "",
  sourceModule: "",
  currencyCode: "",
  search: ""
};

const emptySummary: BalanceSheetSummary = {
  totalAssets: 0,
  totalAssetsBase: 0,
  totalLiabilities: 0,
  totalLiabilitiesBase: 0,
  totalEquity: 0,
  totalEquityBase: 0,
  currentYearResult: 0,
  currentYearResultBase: 0,
  difference: 0,
  differenceBase: 0,
  isBalanced: true,
  hasMultipleCurrencies: false,
  currencyTotals: [],
  movementCount: 0
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function summaryAmount(summary: BalanceSheetSummary, original: keyof BalanceSheetSummary, base: keyof BalanceSheetSummary) {
  return summary.hasMultipleCurrencies ? money(summary[base] as number) : money(summary[original] as number | null);
}

function cleanQuery(filters: BalanceSheetQuery) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as BalanceSheetQuery;
}

export function BalanceSheetPage() {
  const [filters, setFilters] = useState<BalanceSheetQuery>(defaultFilters);
  const [costCenters, setCostCenters] = useState<LookupOption[]>([]);
  const [records, setRecords] = useState<BalanceSheetLine[]>([]);
  const [summary, setSummary] = useState<BalanceSheetSummary>(emptySummary);
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

  async function loadBalance(nextFilters = filters) {
    if (nextFilters.compareAsOfDate && nextFilters.asOfDate && nextFilters.compareAsOfDate > nextFilters.asOfDate) {
      setFeedback({ tone: "warning", message: "La fecha comparativa no puede ser mayor que la fecha de corte." });
      return;
    }

    try {
      setLoading(true);
      const result = await getBalanceSheet(cleanQuery(nextFilters));
      setRecords(result.records);
      setSummary(result.summary);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo consultar el Balance General."
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
      loadBalance(filters);
    }
  }, [referencesLoading]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    loadBalance(filters);
  }

  const hasComparison = Boolean(summary.comparison);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Balance General"
        description="Consulta read-only de activos, pasivos y patrimonio con resultado del ejercicio."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/income-statement">
              Estado de Resultados
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/trial-balance">
              Balance de Comprobacion
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
            <FormField label="Fecha de corte">
              <Input
                disabled={loading}
                type="date"
                value={filters.asOfDate}
                onChange={(event) => setFilters((current) => ({ ...current, asOfDate: event.target.value }))}
              />
            </FormField>
            <FormField label="Comparar corte">
              <Input
                disabled={loading}
                type="date"
                value={filters.compareAsOfDate}
                onChange={(event) => setFilters((current) => ({ ...current, compareAsOfDate: event.target.value }))}
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
          <span className="metric-label">Activos</span>
          <strong className="metric-value">{summaryAmount(summary, "totalAssets", "totalAssetsBase")}</strong>
          <span className="muted-text">{summary.hasMultipleCurrencies ? "Consolidado base" : `Base ${money(summary.totalAssetsBase)}`}</span>
        </Card>
        <Card>
          <span className="metric-label">Pasivos</span>
          <strong className="metric-value">{summaryAmount(summary, "totalLiabilities", "totalLiabilitiesBase")}</strong>
          <span className="muted-text">Base {money(summary.totalLiabilitiesBase)}</span>
        </Card>
        <Card>
          <span className="metric-label">Patrimonio</span>
          <strong className="metric-value">{summaryAmount(summary, "totalEquity", "totalEquityBase")}</strong>
          <span className="muted-text">Resultado {money(summary.currentYearResultBase)} base</span>
        </Card>
        <Card>
          <span className="metric-label">Diferencia</span>
          <strong className="metric-value">{summaryAmount(summary, "difference", "differenceBase")}</strong>
          <span className="muted-text">{summary.isBalanced ? "Cuadrado" : "Con diferencia"}</span>
        </Card>
      </div>

      {summary.hasMultipleCurrencies ? (
        <Alert tone="warning">La consulta tiene varias monedas; los importes originales se muestran separados y el resumen consolidado usa valores base.</Alert>
      ) : null}

      <Card>
        <Table
          columns={["Concepto", "Actual", "Comparativo", "Variacion"]}
          rows={[
            ["Activos", summaryAmount(summary, "totalAssets", "totalAssetsBase"), hasComparison ? money(summary.comparison?.totalAssetsBase) : "-", hasComparison ? money((summary.totalAssetsBase ?? 0) - (summary.comparison?.totalAssetsBase ?? 0)) : "-"],
            ["Pasivos", summaryAmount(summary, "totalLiabilities", "totalLiabilitiesBase"), hasComparison ? money(summary.comparison?.totalLiabilitiesBase) : "-", hasComparison ? money((summary.totalLiabilitiesBase ?? 0) - (summary.comparison?.totalLiabilitiesBase ?? 0)) : "-"],
            ["Patrimonio", summaryAmount(summary, "totalEquity", "totalEquityBase"), hasComparison ? money(summary.comparison?.totalEquityBase) : "-", hasComparison ? money((summary.totalEquityBase ?? 0) - (summary.comparison?.totalEquityBase ?? 0)) : "-"],
            ["Resultado del ejercicio", summaryAmount(summary, "currentYearResult", "currentYearResultBase"), hasComparison ? money(summary.comparison?.currentYearResultBase) : "-", hasComparison ? money((summary.currentYearResultBase ?? 0) - (summary.comparison?.currentYearResultBase ?? 0)) : "-"],
            ["Diferencia", summaryAmount(summary, "difference", "differenceBase"), hasComparison ? money(summary.comparison?.differenceBase) : "-", hasComparison ? money((summary.differenceBase ?? 0) - (summary.comparison?.differenceBase ?? 0)) : "-"]
          ]}
        />
      </Card>

      {summary.currencyTotals.length > 0 ? (
        <Card>
          <Table
            columns={["Moneda", "Activos", "Pasivos", "Patrimonio", "Resultado", "Diferencia", "Movimientos"]}
            rows={summary.currencyTotals.map((currency) => [
              currency.currencyCode,
              money(currency.totalAssets),
              money(currency.totalLiabilities),
              money(currency.totalEquity),
              money(currency.currentYearResult),
              money(currency.difference),
              String(currency.movementCount)
            ])}
          />
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Cargando Balance General..." />
      ) : feedback?.tone === "error" ? (
        <ErrorState title="API no disponible" message={feedback.message} />
      ) : records.length === 0 ? (
        <EmptyState title="Sin saldos" description="No hay cuentas de balance para los filtros indicados." />
      ) : (
        <Card>
          <Table
            columns={["Grupo", "Cuenta", "Nombre", "Actual", "Base", "Comparativo", "Variacion"]}
            rows={records.map((record) => [
              record.sectionLabel,
              record.accountId ? (
                <a key={record.accountId} href={`/accounting/general-ledger?accountId=${record.accountId}`}>
                  {record.accountCode}
                </a>
              ) : (
                record.accountCode
              ),
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
