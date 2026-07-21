import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type PostingRequest = {
  sourceModule: string;
  documentId: string;
  postingDate?: string;
  reference?: string;
  notes?: string;
};

export type PostingLinePreview = {
  lineNumber: number;
  side: "DEBIT" | "CREDIT";
  accountId: string;
  accountCode: string;
  accountName: string;
  costCenterId?: string;
  description: string;
  debitAmount: number;
  creditAmount: number;
  currencyCode: string;
  exchangeRate: number;
  debitBaseAmount: number;
  creditBaseAmount: number;
  taxAmount: number;
};

export type PostingPreview = {
  sourceModule: string;
  sourceDocumentType: string;
  documentId: string;
  documentNumber: string;
  postingDate: string;
  description: string;
  reference: string;
  currencyCode: string;
  exchangeRate: number;
  totalDebit: number;
  totalCredit: number;
  totalDebitBase: number;
  totalCreditBase: number;
  difference: number;
  baseDifference: number;
  taxAmount: number;
  lines: PostingLinePreview[];
};

async function requestAccounting<T>(path: string, payload: PostingRequest) {
  const response = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(payload)
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error?.message ?? `La API respondio con estado ${response.status}.`);
  }

  return body.data;
}

export function previewAccountingPosting(payload: PostingRequest) {
  return requestAccounting<PostingPreview>("/accounting/postings/preview", payload);
}
