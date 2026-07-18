import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type TrialBalanceCurrencyTotal = {
  currencyCode: string;
  openingBalance?: number;
  periodDebit?: number;
  periodCredit?: number;
  netMovement?: number;
  endingBalance?: number;
  endingDebit?: number;
  endingCredit?: number;
  totalDebits?: number;
  totalCredits?: number;
  difference?: number;
  movementCount: number;
};

export type TrialBalanceAccount = {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  normalBalance: string;
  openingBalance: number | null;
  openingBaseBalance: number;
  periodDebit: number | null;
  periodCredit: number | null;
  periodDebitBase: number;
  periodCreditBase: number;
  netMovement: number | null;
  netBaseMovement: number;
  endingBalance: number | null;
  endingBaseBalance: number;
  endingDebit: number | null;
  endingCredit: number | null;
  endingDebitBase: number;
  endingCreditBase: number;
  movementCount: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: TrialBalanceCurrencyTotal[];
};

export type TrialBalanceSummary = {
  totalDebits: number | null;
  totalCredits: number | null;
  totalDebitsBase: number;
  totalCreditsBase: number;
  difference: number | null;
  differenceBase: number;
  isBalanced: boolean;
  accountCount: number;
  movementCount: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: TrialBalanceCurrencyTotal[];
};

export type TrialBalanceResult = {
  records: TrialBalanceAccount[];
  totalItems: number;
  page: number;
  pageSize: number;
  summary: TrialBalanceSummary;
};

export type TrialBalanceQuery = {
  accountId?: string;
  accountingPeriodId?: string;
  costCenterId?: string;
  sourceModule?: string;
  currencyCode?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

async function requestAccounting<T>(path: string) {
  const response = await apiFetch(path);
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error?.message ?? `La API respondio con estado ${response.status}.`);
  }

  return body.data;
}

function queryString(query: TrialBalanceQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

export function listTrialBalance(query: TrialBalanceQuery) {
  return requestAccounting<TrialBalanceResult>(`/accounting/trial-balance?${queryString(query)}`);
}

export function getTrialBalanceSummary(query: TrialBalanceQuery) {
  return requestAccounting<TrialBalanceSummary>(`/accounting/trial-balance/summary?${queryString(query)}`);
}
