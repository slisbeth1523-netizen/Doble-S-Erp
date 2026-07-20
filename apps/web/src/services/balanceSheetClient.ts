import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type BalanceSheetCurrencyTotal = {
  currencyCode: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  currentYearResult: number;
  difference: number;
  movementCount: number;
};

export type BalanceSheetLine = {
  section: string;
  sectionLabel: string;
  accountId?: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  amount: number | null;
  baseAmount: number;
  comparisonAmount?: number | null;
  comparisonBaseAmount?: number;
  variance?: number | null;
  varianceBase?: number;
  hasMultipleCurrencies: boolean;
  movementCount: number;
};

export type BalanceSheetSummary = {
  totalAssets: number | null;
  totalAssetsBase: number;
  totalLiabilities: number | null;
  totalLiabilitiesBase: number;
  totalEquity: number | null;
  totalEquityBase: number;
  currentYearResult: number | null;
  currentYearResultBase: number;
  difference: number | null;
  differenceBase: number;
  isBalanced: boolean;
  comparison?: {
    totalAssets: number | null;
    totalAssetsBase: number;
    totalLiabilities: number | null;
    totalLiabilitiesBase: number;
    totalEquity: number | null;
    totalEquityBase: number;
    currentYearResult: number | null;
    currentYearResultBase: number;
    difference: number | null;
    differenceBase: number;
    isBalanced: boolean;
  };
  hasMultipleCurrencies: boolean;
  currencyTotals: BalanceSheetCurrencyTotal[];
  movementCount: number;
};

export type BalanceSheetResult = {
  records: BalanceSheetLine[];
  summary: BalanceSheetSummary;
};

export type BalanceSheetQuery = {
  asOfDate?: string;
  compareAsOfDate?: string;
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

function queryString(query: BalanceSheetQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

export function getBalanceSheet(query: BalanceSheetQuery) {
  return requestAccounting<BalanceSheetResult>(`/accounting/balance-sheet?${queryString(query)}`);
}

export function getBalanceSheetSummary(query: BalanceSheetQuery) {
  return requestAccounting<BalanceSheetSummary>(`/accounting/balance-sheet/summary?${queryString(query)}`);
}
