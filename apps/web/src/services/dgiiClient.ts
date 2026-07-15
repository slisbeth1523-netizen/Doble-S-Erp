import type { ApiResponse } from "@doble-s-erp/shared";
import { apiFetch } from "./apiClient.js";

type RequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
};

async function requestDgii<T>(path: string, options: RequestOptions = {}) {
  const response = await apiFetch(path, {
    method: options.method ?? "GET",
    headers: {
      "content-type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success || body.data === undefined) {
    const message = body?.error?.message ?? `La API respondio con estado ${response.status}.`;
    throw new Error(message);
  }

  return body.data;
}

export type CompanyTaxConfig = {
  CompanyTaxConfigurationId: string;
  Rnc: string;
  FiscalName?: string;
  Environment: string;
  CertificateAlias?: string;
  CertificateFileName?: string;
  CertificateUploadedAt?: string;
  IsElectronicInvoicingEnabled?: boolean;
  endpoints?: Record<string, string>;
};

export type ElectronicSequence = {
  id: string;
  invoiceType: string;
  nextNumber: number;
  rangeFrom: number;
  rangeTo: number;
  prefix: string;
  environment?: string;
  expirationDate?: string;
  isActive: boolean;
};

export type ElectronicInvoice = {
  id: string;
  tenantId: string;
  companyId: string;
  sourceInvoiceId: string;
  invoiceType: string;
  ecfNumber: string;
  trackId?: string;
  status: string;
  signedXml: string;
  responseXml?: string;
  createdAt: string;
  companyName: string;
  sourceInvoiceNumber: string;
  totalAmount: number;
};

export function getTaxConfig() {
  return requestDgii<CompanyTaxConfig>("/dgii/tax-config");
}

export function saveTaxConfig(payload: { rnc: string; environment: string; certificateData?: string; certificatePassword?: string }) {
  return requestDgii<CompanyTaxConfig>("/dgii/tax-config", {
    method: "POST",
    body: payload
  });
}

export function saveFullTaxConfig(payload: {
  rnc: string;
  fiscalName?: string;
  environment: string;
  certificateAlias?: string;
  certificateData?: string;
  certificateFileName?: string;
  certificatePassword?: string;
}) {
  return requestDgii<CompanyTaxConfig>("/dgii/tax-config", {
    method: "POST",
    body: payload
  });
}

export function listSequences() {
  return requestDgii<ElectronicSequence[]>("/dgii/sequences");
}

export function createSequence(payload: { invoiceType: string; rangeFrom: number; rangeTo: number; prefix: string; expirationDate?: string }) {
  return requestDgii<void>("/dgii/sequences", {
    method: "POST",
    body: payload
  });
}

export function listElectronicInvoices() {
  return requestDgii<ElectronicInvoice[]>("/dgii/electronic-invoices");
}

export function emitEcf(sourceInvoiceId: string, payload: { invoiceType?: string } = {}) {
  return requestDgii<{ ecfNumber: string; trackId: string; status: string }>((`/dgii/electronic-invoices/${sourceInvoiceId}/emit`), {
    method: "POST",
    body: payload
  });
}

export type CertificationStep = {
  stepNumber: number;
  description: string;
  ecfType: string;
  phaseCode?: string;
  nature?: string;
  status: string;
  trackId?: string;
  response?: string;
  portalUrl?: string;
  evidenceUrl?: string;
  notes?: string;
  responsibleName?: string;
  completedAt?: string;
};

export type CertificationProfile = {
  id: string;
  applicationStatus: string;
  applicationReference?: string;
  portalUser?: string;
  certificationPortalUrl?: string;
  taxOfficeVirtualUrl?: string;
  commercialName?: string;
  economicActivity?: string;
  taxpayerType?: string;
  representativeName?: string;
  representativeDocument?: string;
  representativeEmail?: string;
  representativePhone?: string;
  technicalContactName?: string;
  technicalContactEmail?: string;
  technicalContactPhone?: string;
  softwareName?: string;
  softwareVersion?: string;
  softwareProviderRnc?: string;
  serviceReceptionUrl?: string;
  serviceApprovalUrl?: string;
  serviceAuthenticationUrl?: string;
  logoFileName?: string;
  logoMimeType?: string;
  logoBase64?: string;
  applicationXml?: string;
  signedApplicationXml?: string;
  affidavitXml?: string;
  signedAffidavitXml?: string;
  printedRepresentationStatus: string;
  productionAuthorizationStatus: string;
  notes?: string;
};

export type CertificationGeneratedDocument = {
  kind: string;
  xml: string;
  signedXml: string;
  profile: CertificationProfile;
  steps: CertificationStep[];
};

export function getCertificationProfile() {
  return requestDgii<CertificationProfile>("/dgii/certification/profile");
}

export function saveCertificationProfile(payload: Partial<CertificationProfile>) {
  return requestDgii<CertificationProfile>("/dgii/certification/profile", {
    method: "POST",
    body: payload
  });
}

export function getCertificationSteps() {
  return requestDgii<CertificationStep[]>("/dgii/certification/steps");
}

export function updateCertificationStep(stepNumber: number, payload: Partial<CertificationStep>) {
  return requestDgii<CertificationStep>(`/dgii/certification/steps/${stepNumber}`, {
    method: "POST",
    body: payload
  });
}

export function runCertificationStep(stepNumber: number) {
  return requestDgii<CertificationStep>(`/dgii/certification/steps/${stepNumber}/run`, {
    method: "POST"
  });
}

export function generateCertificationApplication() {
  return requestDgii<CertificationGeneratedDocument>("/dgii/certification/application/generate", {
    method: "POST"
  });
}

export function generateCertificationAffidavit() {
  return requestDgii<CertificationGeneratedDocument>("/dgii/certification/affidavit/generate", {
    method: "POST"
  });
}

export function resetCertification() {
  return requestDgii<CertificationStep[]>("/dgii/certification/reset", {
    method: "POST"
  });
}
