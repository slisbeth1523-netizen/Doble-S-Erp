import { type FormEvent, useEffect, useMemo, useState } from "react";

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
import { listAccountingAccounts, type AccountingAccount } from "../../services/accountingAccountsClient.js";
import {
  listGeneralLedgerEntries,
  type GeneralLedgerEntry,
  type GeneralLedgerQuery,
  type GeneralLedgerSummary
} from "../../services/generalLedgerClient.js";

type Feedback = {
  tone: "success" | "warning" | "error";
  message: string;
};

const defaultFilters: GeneralLedgerQuery = {
  accountId: "",
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

const emptySummary: GeneralLedgerSummary = {
  openingBalance: 0,
  openingBaseBalance: 0,
  totalDebit: 0,
  totalCredit: 0,
  totalDebitBase: 0,
  totalCreditBase: 0,
  netMovement: 0,
  netBaseMovement: 0,
  closingBalance: 0,
  closingBaseBalance: 0,
  movementCount: 0,
  hasMultipleCurrencies: false,
  currencyTotals: []
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value ?? 0);
}

function summaryAmount(summary: GeneralLedgerSummary, original: keyof GeneralLedgerSummary, base: keyof GeneralLedgerSummary) {
  return summary.hasMultipleCurrencies ? money(summary[base] as number) : money(summary[original] as number | null);
}

function summaryHint(summary: GeneralLedgerSummary, base: keyof GeneralLedgerSummary) {
  return summary.hasMultipleCurrencies ? "Consolidado base" : `Base ${money(summary[base] as number)}`;
}

function dateOnly(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function cleanQuery(filters: GeneralLedgerQuery) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== "")
  ) as GeneralLedgerQuery;
}

export function GeneralLedgerPage() {
  const [filters, setFilters] = useState<GeneralLedgerQuery>(defaultFilters);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [costCenters, setCostCenters] = useState<LookupOption[]>([]);
  const [periods, setPeriods] = useState<LookupOption[]>([]);
  const [records, setRecords] = useState<GeneralLedgerEntry[]>([]);
  const [summary, setSummary] = useState<GeneralLedgerSummary>(emptySummary);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function loadReferences() {
    try {
      setReferencesLoading(true);
      const [accountResult, costCenterResult, periodResult] = await Promise.all([
        listAccountingAccounts({ pageSize: 300 }),
        fetchCatalogLookup("cost-centers", { pageSize: 100 }),
        fetchCatalogLookup("accounting-periods", { pageSize: 100 })
      ]);
      const postableAccounts = accountResult.records.filter(
        (account) => account.isActive && account.allowsPosting && !account.isBlocked && account.childCount === 0
      );
      setAccounts(postableAccounts);
      setCostCenters(costCenterResult.filter((costCenter) => costCenter.isActive !== false));
      setPeriods(periodResult.filter((period) => period.isActive !== false));
      setFilters((current) => ({ ...current, accountId: current.accountId || postableAccounts[0]?.accountId || "" }));
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudieron cargar cuentas, periodos o centros."
      });
    } finally {
      setReferencesLoading(false);
    }
  }

  async function loadLedger(nextFilters = filters) {
    if (!nextFilters.accountId) {
      setFeedback({ tone: "warning", message: "Selecciona una cuenta para consultar el Libro Mayor." });
      return;
    }
    if (nextFilters.dateFrom && nextFilters.dateTo && nextFilters.dateTo < nextFilters.dateFrom) {
      setFeedback({ tone: "warning", message: "La fecha hasta no puede ser menor que la fecha desde." });
      return;
    }

    try {
      setLoading(true);
      const result = await listGeneralLedgerEntries(cleanQuery(nextFilters));
      setRecords(result.records);
      setSummary(result.summary);
      setTotalItems(result.totalItems);
      setFeedback(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "No se pudo consultar el Libro Mayor."
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReferences();
  }, []);

  useEffect(() => {
    if (!referencesLoading && filters.accountId) {
      loadLedger(filters);
    }
  }, [referencesLoading, filters.accountId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    loadLedger(nextFilters);
  }

  function goToPage(page: number) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    loadLedger(nextFilters);
  }

  const rows = useMemo(
    () =>
      records.map((record) => [
        dateOnly(record.entryDate),
        <a key={record.journalEntryLineId} href={`/accounting/journal-entries?entry=${record.journalEntryId}`}>
          {record.entryNumber}
        </a>,
        record.lineDescription,
        record.lineReference ?? record.headerReference ?? "-",
        record.costCenterCode ? `${record.costCenterCode} ${record.costCenterName ?? ""}` : "-",
        money(record.debitAmount),
        money(record.creditAmount),
        money(record.runningBalance),
        `${record.currencyCode} / ${money(record.debitBaseAmount - record.creditBaseAmount)} base`
      ]),
    [records]
  );

  const currentPage = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const hasNextPage = currentPage * pageSize < totalItems;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Contabilidad"
        title="Libro Mayor"
        description="Consulta read-only derivada de asientos contables posteados."
        actions={
          <div className="table-actions">
            <a className="ui-button ui-button-secondary" href="/accounting/journal-entries">
              Asientos contables
            </a>
            <a className="ui-button ui-button-secondary" href="/accounting/chart-of-accounts">
              Plan de cuentas
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
            <FormField label="Cuenta" required>
              <Select
                disabled={referencesLoading || loading}
                value={filters.accountId}
                onChange={(event) => setFilters((current) => ({ ...current, accountId: event.target.value }))}
              >
                <option value="">Selecciona cuenta</option>
                {accounts.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </Select>
            </FormField>
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
            <FormField label="Origen">
              <Input
                disabled={loading}
                value={filters.sourceModule}
                onChange={(event) => setFilters((current) => ({ ...current, sourceModule: event.target.value.toUpperCase() }))}
                placeholder="MANUAL"
              />
            </FormField>
            <FormField label="Buscar">
              <Input
                disabled={loading}
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Asiento, referencia o descripcion"
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
          <span className="metric-label">Saldo inicial</span>
          <strong className="metric-value">{summaryAmount(summary, "openingBalance", "openingBaseBalance")}</strong>
          <span className="muted-text">{summaryHint(summary, "openingBaseBalance")}</span>
        </Card>
        <Card>
          <span className="metric-label">Debitos</span>
          <strong className="metric-value">{summaryAmount(summary, "totalDebit", "totalDebitBase")}</strong>
          <span className="muted-text">{summaryHint(summary, "totalDebitBase")}</span>
        </Card>
        <Card>
          <span className="metric-label">Creditos</span>
          <strong className="metric-value">{summaryAmount(summary, "totalCredit", "totalCreditBase")}</strong>
          <span className="muted-text">{summaryHint(summary, "totalCreditBase")}</span>
        </Card>
        <Card>
          <span className="metric-label">Movimiento neto</span>
          <strong className="metric-value">{summaryAmount(summary, "netMovement", "netBaseMovement")}</strong>
          <span className="muted-text">{summaryHint(summary, "netBaseMovement")}</span>
        </Card>
        <Card>
          <span className="metric-label">Saldo final</span>
          <strong className="metric-value">{summaryAmount(summary, "closingBalance", "closingBaseBalance")}</strong>
          <span className="muted-text">{summaryHint(summary, "closingBaseBalance")}</span>
        </Card>
      </div>

      {summary.hasMultipleCurrencies ? (
        <Alert tone="warning">La consulta tiene varias monedas; los importes originales se muestran separados y el resumen consolidado usa valores base.</Alert>
      ) : null}

      {summary.currencyTotals.length > 0 ? (
        <Card>
          <Table
            columns={["Moneda", "Saldo inicial", "Debito", "Credito", "Movimiento neto", "Saldo final", "Movimientos"]}
            rows={summary.currencyTotals.map((currency) => [
              currency.currencyCode,
              money(currency.openingBalance),
              money(currency.totalDebit),
              money(currency.totalCredit),
              money(currency.netMovement),
              money(currency.closingBalance),
              String(currency.movementCount)
            ])}
          />
        </Card>
      ) : null}

      {loading ? (
        <LoadingState label="Cargando Libro Mayor..." />
      ) : feedback?.tone === "error" ? (
        <ErrorState title="API no disponible" message={feedback.message} />
      ) : records.length === 0 ? (
        <EmptyState title="Sin movimientos" description="La cuenta seleccionada no tiene movimientos posteados para los filtros indicados." />
      ) : (
        <Card>
          <Table
            columns={["Fecha", "Asiento", "Descripcion", "Referencia", "Centro de costo", "Debito", "Credito", "Saldo acumulado", "Moneda/base"]}
            rows={rows}
          />
          <div className="table-actions">
            <Button disabled={currentPage <= 1 || loading} onClick={() => goToPage(currentPage - 1)} type="button" variant="secondary">
              Anterior
            </Button>
            <span className="muted-text">
              Pagina {currentPage} / {totalItems} movimientos
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
