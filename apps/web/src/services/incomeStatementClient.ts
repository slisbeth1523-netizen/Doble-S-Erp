import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type IncomeStatementCurrencyTotal = {
  currencyCode: string;
  totalRevenue?: number;
  costs?: number;
  grossProfit?: number;
  operatingExpenses?: number;
  operatingIncome?: number;
  otherIncome?: number;
  otherExpenses?: number;
  profitBeforeTax?: number;
  netIncome?: number;
  comparisonNetIncome?: number;
  varianceNetIncome?: number;
  movementCount: number;
};

export type IncomeStatementLine = {
  section: string;
  sectionLabel: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  classification?: string;
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number;
  variance?: number | null;
  varianceBase?: number;
  hasMultipleCurrencies: boolean;
  movementCount: number;
};

export type IncomeStatementSummary = {
  totalRevenue: number | null;
  totalRevenueBase: number;
  costs: number | null;
  costsBase: number;
  grossProfit: number | null;
  grossProfitBase: number;
  operatingExpenses: number | null;
  operatingExpensesBase: number;
  operatingIncome: number | null;
  operatingIncomeBase: number;
  otherIncome: number | null;
  otherIncomeBase: number;
  otherExpenses: number | null;
  otherExpensesBase: number;
  profitBeforeTax: number | null;
  profitBeforeTaxBase: number;
  netIncome: number | null;
  netIncomeBase: number;
  comparison?: {
    totalRevenue: number | null;
    totalRevenueBase: number;
    costs: number | null;
    costsBase: number;
    grossProfit: number | null;
    grossProfitBase: number;
    operatingExpenses: number | null;
    operatingExpensesBase: number;
    operatingIncome: number | null;
    operatingIncomeBase: number;
    otherIncome: number | null;
    otherIncomeBase: number;
    otherExpenses: number | null;
    otherExpensesBase: number;
    profitBeforeTax: number | null;
    profitBeforeTaxBase: number;
    netIncome: number | null;
    netIncomeBase: number;
    varianceNetIncome: number | null;
    varianceNetIncomeBase: number;
  };
  hasMultipleCurrencies: boolean;
  currencyTotals: IncomeStatementCurrencyTotal[];
  movementCount: number;
};

export type IncomeStatementResult = {
  records: IncomeStatementLine[];
  summary: IncomeStatementSummary;
};

export type IncomeStatementQuery = {
  accountingPeriodId?: string;
  costCenterId?: string;
  sourceModule?: string;
  currencyCode?: string;
  dateFrom?: string;
  dateTo?: string;
  compareAccountingPeriodId?: string;
  compareDateFrom?: string;
  compareDateTo?: string;
  search?: string;
};

async function requestAccounting<T>(path: string) {
  const response = await apiFetch(path);
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error?.message ?? `La API respondio con estado ${response.status}.`);
  }

  return body.data;
}

function queryString(query: IncomeStatementQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

export function getIncomeStatement(query: IncomeStatementQuery) {
  return requestAccounting<IncomeStatementResult>(`/accounting/income-statement?${queryString(query)}`);
}

export function getIncomeStatementSummary(query: IncomeStatementQuery) {
  return requestAccounting<IncomeStatementSummary>(`/accounting/income-statement/summary?${queryString(query)}`);
}
