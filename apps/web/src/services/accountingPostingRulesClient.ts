import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

export type PostingRule = {
  postingRuleId: string;
  ruleCode: string;
  name: string;
  description?: string;
  sourceModule: string;
  sourceDocumentType: string;
  direction: "RECEIVABLE" | "PAYABLE";
  debitAccountId: string;
  debitAccountCode: string;
  debitAccountName: string;
  creditAccountId: string;
  creditAccountCode: string;
  creditAccountName: string;
  taxAccountId?: string;
  taxAccountCode?: string;
  taxAccountName?: string;
  appliesTax: boolean;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
};

export type PostingRulePayload = {
  ruleCode: string;
  name: string;
  description?: string;
  sourceModule: string;
  sourceDocumentType: string;
  direction: "RECEIVABLE" | "PAYABLE";
  debitAccountId: string;
  creditAccountId: string;
  taxAccountId?: string | null;
  costCenterId?: string | null;
  appliesTax: boolean;
  priority: number;
  isDefault: boolean;
  isActive: boolean;
};

export type PostingRuleListResult = {
  records: PostingRule[];
  totalItems: number;
  page: number;
  pageSize: number;
};

async function requestRules<T>(path: string, options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown } = {}) {
  const response = await apiFetch(path, {
    method: options.method ?? "GET",
    headers: { "content-type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    throw new Error(body?.error?.message ?? `La API respondio con estado ${response.status}.`);
  }

  return body.data;
}

export function listPostingRules(query: { search?: string; pageSize?: number } = {}) {
  const params = new URLSearchParams();
  if (query.search) params.append("search", query.search);
  params.append("pageSize", String(query.pageSize ?? 100));

  return requestRules<PostingRuleListResult>(`/accounting/posting-rules?${params.toString()}`);
}

export function createPostingRule(payload: PostingRulePayload) {
  return requestRules<PostingRule>("/accounting/posting-rules", { method: "POST", body: payload });
}

export function updatePostingRule(id: string, payload: PostingRulePayload) {
  return requestRules<PostingRule>(`/accounting/posting-rules/${id}`, { method: "PATCH", body: payload });
}

export function deletePostingRule(id: string) {
  return requestRules<PostingRule>(`/accounting/posting-rules/${id}`, { method: "DELETE" });
}
