import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type GeneralLedgerEntry = {
  journalEntryId: string;
  journalEntryLineId: string;
  entryNumber: string;
  entryDate: string;
  periodCode: string;
  sourceModule: string;
  headerDescription: string;
  headerReference?: string;
  lineNumber: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  costCenterCode?: string;
  costCenterName?: string;
  lineDescription: string;
  lineReference?: string;
  currencyCode: string;
  exchangeRate: number;
  debitAmount: number;
  creditAmount: number;
  debitBaseAmount: number;
  creditBaseAmount: number;
  runningBalance: number;
  runningBaseBalance: number;
};

export type GeneralLedgerSummary = {
  openingBalance: number | null;
  openingBaseBalance: number;
  totalDebit: number | null;
  totalCredit: number | null;
  totalDebitBase: number;
  totalCreditBase: number;
  netMovement: number | null;
  netBaseMovement: number;
  closingBalance: number | null;
  closingBaseBalance: number;
  movementCount: number;
  hasMultipleCurrencies: boolean;
  currencyTotals: Array<{
    currencyCode: string;
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    netMovement: number;
    closingBalance: number;
    movementCount: number;
  }>;
};

export type GeneralLedgerResult = {
  records: GeneralLedgerEntry[];
  totalItems: number;
  page: number;
  pageSize: number;
  summary: GeneralLedgerSummary;
};

export type GeneralLedgerQuery = {
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

function queryString(query: GeneralLedgerQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

export function listGeneralLedgerEntries(query: GeneralLedgerQuery) {
  return requestAccounting<GeneralLedgerResult>(`/accounting/general-ledger?${queryString(query)}`);
}

export function getGeneralLedgerSummary(query: GeneralLedgerQuery) {
  return requestAccounting<GeneralLedgerSummary>(`/accounting/general-ledger/summary?${queryString(query)}`);
}
