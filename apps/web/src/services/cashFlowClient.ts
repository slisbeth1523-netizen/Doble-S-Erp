import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type CashFlowCurrencyTotal = {
  currencyCode: string;
  operatingCashFlow: number;
  investingCashFlow: number;
  financingCashFlow: number;
  netChange: number;
  beginningCash: number;
  endingCash: number;
  movementCount: number;
};

export type CashFlowLine = {
  section: string;
  sectionLabel: string;
  lineType: string;
  label: string;
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number;
  variance?: number | null;
  varianceBase?: number;
  hasMultipleCurrencies: boolean;
};

export type CashFlowSummary = {
  operatingCashFlow: number | null;
  operatingCashFlowBase: number;
  investingCashFlow: number | null;
  investingCashFlowBase: number;
  financingCashFlow: number | null;
  financingCashFlowBase: number;
  netChange: number | null;
  netChangeBase: number;
  beginningCash: number | null;
  beginningCashBase: number;
  endingCash: number | null;
  endingCashBase: number;
  comparison?: {
    operatingCashFlow: number | null;
    operatingCashFlowBase: number;
    investingCashFlow: number | null;
    investingCashFlowBase: number;
    financingCashFlow: number | null;
    financingCashFlowBase: number;
    netChange: number | null;
    netChangeBase: number;
    beginningCash: number | null;
    beginningCashBase: number;
    endingCash: number | null;
    endingCashBase: number;
    varianceNetChange: number | null;
    varianceNetChangeBase: number;
  };
  hasMultipleCurrencies: boolean;
  currencyTotals: CashFlowCurrencyTotal[];
  movementCount: number;
};

export type CashFlowResult = {
  records: CashFlowLine[];
  summary: CashFlowSummary;
};

export type CashFlowQuery = {
  dateFrom?: string;
  dateTo?: string;
  compareDateFrom?: string;
  compareDateTo?: string;
  costCenterId?: string;
  sourceModule?: string;
  currencyCode?: string;
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

function queryString(query: CashFlowQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

export function getCashFlow(query: CashFlowQuery) {
  return requestAccounting<CashFlowResult>(`/accounting/cash-flow?${queryString(query)}`);
}

export function getCashFlowSummary(query: CashFlowQuery) {
  return requestAccounting<CashFlowSummary>(`/accounting/cash-flow/summary?${queryString(query)}`);
}
