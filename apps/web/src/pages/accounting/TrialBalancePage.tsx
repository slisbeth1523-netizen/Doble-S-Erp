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
  listTrialBalance,
  type TrialBalanceAccount,
  type TrialBalanceQuery,
  type TrialBalanceSummary
} from "../../services/trialBalanceClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultFilters: TrialBalanceQuery = {
  accountingPeriodId: "",
  costCenterId: "",
  sourceModule: "",
  currencyCode: "",
  dateFrom: "2025-02-01",
  dateTo: "2025-02-28",
  search: "",
  page: 1,
  pageSize: 25
};

const emptySummary: TrialBalanceSummary = {
  totalDebits: 0,
  totalCredits: 0,
  totalDebitsBase: 0,
  totalCreditsBase: 0,
  difference: 0,
  differenceBase: 0,
  isBalanced: true,
  accountCount: 0,
  movementCount: 0,
  hasMultipleCurrencies: false,
  currencyTotals: []
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function summaryAmount(summary: TrialBalanceSummary, original: keyof TrialBalanceSummary, base: keyof TrialBalanceSummary) {
  return summary.hasMultipleCurrencies ? money(summary[base] as number) : money(summary[original] as number | null);
}

function cleanQuery(filters: TrialBalanceQuery) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as TrialBalanceQuery;
}

export function TrialBalancePage() {
  const [filters, setFilters] = useState<TrialBalanceQuery>(defaultFilters);
  const [costCenters, setCostCenters] = useState<LookupOption[]>([]);
  const [periods, setPeriods] = useState<LookupOption[]>([]);
  const [records, setRecords] = useState<TrialBalanceAccount[]>([]);
  const [summary, setSummary] = useState<TrialBalanceSummary>(emptySummary);
  const [totalItems, setTotalItems] = useState(0);
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

  async function loadBalance(nextFilters = filters) {
    if (nextFilters.dateFrom && nextFilters.dateTo && nextFilters.dateTo < nextFilters.dateFrom) {
      setFeedback({ tone: "warning", message: "La fecha hasta no puede ser menor que la fecha desde." });
      return;
    }

    try {
      setLoading(true);
      const result = await listTrialBalance(cleanQuery(nextFilters));
      setRecords(result.records);
      setSummary(result.summary);
      setTotalItems(result.totalItems);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo consultar el Balance de Comprobacion."
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
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    loadBalance(nextFilters);
  }

  function goToPage(page: number) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    loadBalance(nextFilters);
  }

  const currentPage = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const hasNextPage = currentPage * pageSize < totalItems;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Balance de Comprobacion"
        description="Consulta read-only derivada del Libro Mayor y asientos posteados."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/general-ledger">
              Libro Mayor
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/journal-entries">
              Asientos contables
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
          <span className="metric-label">Debitos</span>
          <strong className="metric-value">{summaryAmount(summary, "totalDebits", "totalDebitsBase")}</strong>
          <span className="muted-text">{summary.hasMultipleCurrencies ? "Consolidado base" : `Base ${money(summary.totalDebitsBase)}`}</span>
        </Card>
        <Card>
          <span className="metric-label">Creditos</span>
          <strong className="metric-value">{summaryAmount(summary, "totalCredits", "totalCreditsBase")}</strong>
          <span className="muted-text">{summary.hasMultipleCurrencies ? "Consolidado base" : `Base ${money(summary.totalCreditsBase)}`}</span>
        </Card>
        <Card>
          <span className="metric-label">Diferencia</span>
          <strong className="metric-value">{summaryAmount(summary, "difference", "differenceBase")}</strong>
          <span className="muted-text">{summary.isBalanced ? "Cuadrado" : "Con diferencia"}</span>
        </Card>
        <Card>
          <span className="metric-label">Cuentas</span>
          <strong className="metric-value">{summary.accountCount}</strong>
          <span className="muted-text">{summary.movementCount} movimientos</span>
        </Card>
      </div>

      {summary.hasMultipleCurrencies ? (
        <Alert tone="warning">La consulta tiene varias monedas; los importes originales se muestran separados y el resumen consolidado usa valores base.</Alert>
      ) : null}

      {summary.currencyTotals.length > 0 ? (
        <Card>
          <Table
            columns={["Moneda", "Debitos", "Creditos", "Diferencia", "Movimientos"]}
            rows={summary.currencyTotals.map((currency) => [
              currency.currencyCode,
              money(currency.totalDebits),
              money(currency.totalCredits),
              money(currency.difference),
              String(currency.movementCount)
            ])}
          />
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Cargando Balance de Comprobacion..." />
      ) : feedback?.tone === "error" ? (
        <ErrorState title="API no disponible" message={feedback.message} />
      ) : records.length === 0 ? (
        <EmptyState title="Sin saldos" description="No hay cuentas con saldos o movimientos para los filtros indicados." />
      ) : (
        <Card>
          <Table
            columns={["Cuenta", "Nombre", "Saldo inicial", "Debito periodo", "Credito periodo", "Movimiento neto", "Saldo final", "Debe final", "Haber final"]}
            rows={records.map((record) => [
              <a key={record.accountId} href={`/accounting/general-ledger?accountId=${record.accountId}`}>
                {record.accountCode}
              </a>,
              record.accountName,
              record.hasMultipleCurrencies ? money(record.openingBaseBalance) : money(record.openingBalance),
              record.hasMultipleCurrencies ? money(record.periodDebitBase) : money(record.periodDebit),
              record.hasMultipleCurrencies ? money(record.periodCreditBase) : money(record.periodCredit),
              record.hasMultipleCurrencies ? money(record.netBaseMovement) : money(record.netMovement),
              record.hasMultipleCurrencies ? money(record.endingBaseBalance) : money(record.endingBalance),
              record.hasMultipleCurrencies ? money(record.endingDebitBase) : money(record.endingDebit),
              record.hasMultipleCurrencies ? money(record.endingCreditBase) : money(record.endingCredit)
            ])}
          />
          <div className="table-actions">
            <Button disabled={currentPage <= 1 || loading} onClick={() => goToPage(currentPage - 1)} type="button" variant="secondary">
              Anterior
            </Button>
            <span className="muted-text">
              Pagina {currentPage} / {totalItems} cuentas
            </span>
            <Button disabled={!hasNextPage || loading} onClick={() => goToPage(currentPage + 1)} type="button" variant="secondary">
              Siguiente
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
