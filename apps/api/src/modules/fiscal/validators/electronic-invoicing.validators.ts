import { z } from "zod";

const uniqueIdentifierSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Invalid uniqueidentifier")
  .transform((value) => value.toLowerCase());

export const dgiiEnvironmentSchema = z.enum(["TESTECF", "CERTECF", "PRODUCCION"]);
export const ecfTypeSchema = z.enum(["31", "32", "33", "34", "41", "43", "44", "45", "46", "47"]);

export const taxConfigSaveSchema = z.object({
  rnc: z.string().trim().min(9).max(32),
  fiscalName: z.string().trim().min(2).max(250).optional(),
  environment: dgiiEnvironmentSchema,
  certificateAlias: z.string().trim().max(160).optional().nullable(),
  certificateData: z.string().trim().max(500000).optional().nullable(),
  certificateFileName: z.string().trim().max(260).optional().nullable(),
  certificatePassword: z.string().trim().max(200).optional().nullable()
});

export const sequenceCreateSchema = z.object({
  invoiceType: z.string().trim().regex(/^E?\d{2}$/).transform((value) => value.replace(/^E/, "")),
  rangeFrom: z.coerce.number().int().positive(),
  rangeTo: z.coerce.number().int().positive(),
  prefix: z.string().trim().regex(/^E\d{2}$/),
  expirationDate: z.coerce.date().optional().nullable(),
  environment: dgiiEnvironmentSchema.optional()
}).refine((value) => value.rangeTo >= value.rangeFrom, {
  path: ["rangeTo"],
  message: "El rango final debe ser mayor o igual al inicial."
});

export const emitEcfParamsSchema = z.object({
  sourceInvoiceId: uniqueIdentifierSchema
});

export const emitEcfSchema = z.object({
  invoiceType: z.string().trim().regex(/^E?\d{2}$/).transform((value) => value.replace(/^E/, "")).optional()
});

export const certificationStepParamsSchema = z.object({
  stepNumber: z.coerce.number().int().min(1).max(15)
});

export const certificationProfileSaveSchema = z.object({
  applicationStatus: z.enum(["NOT_STARTED", "READY_TO_APPLY", "SUBMITTED", "APPROVED", "REJECTED", "ON_HOLD"]).optional(),
  applicationReference: z.string().trim().max(120).optional().nullable(),
  portalUser: z.string().trim().max(160).optional().nullable(),
  certificationPortalUrl: z.string().trim().max(500).optional().nullable(),
  taxOfficeVirtualUrl: z.string().trim().max(500).optional().nullable(),
  commercialName: z.string().trim().max(250).optional().nullable(),
  economicActivity: z.string().trim().max(250).optional().nullable(),
  taxpayerType: z.string().trim().max(80).optional().nullable(),
  representativeName: z.string().trim().max(200).optional().nullable(),
  representativeDocument: z.string().trim().max(40).optional().nullable(),
  representativeEmail: z.string().trim().email().max(200).optional().nullable(),
  representativePhone: z.string().trim().max(60).optional().nullable(),
  technicalContactName: z.string().trim().max(160).optional().nullable(),
  technicalContactEmail: z.string().trim().email().max(200).optional().nullable(),
  technicalContactPhone: z.string().trim().max(60).optional().nullable(),
  softwareName: z.string().trim().max(160).optional().nullable(),
  softwareVersion: z.string().trim().max(80).optional().nullable(),
  softwareProviderRnc: z.string().trim().max(40).optional().nullable(),
  serviceReceptionUrl: z.string().trim().max(500).optional().nullable(),
  serviceApprovalUrl: z.string().trim().max(500).optional().nullable(),
  serviceAuthenticationUrl: z.string().trim().max(500).optional().nullable(),
  logoFileName: z.string().trim().max(260).optional().nullable(),
  logoMimeType: z.string().trim().max(80).optional().nullable(),
  logoBase64: z.string().trim().max(500000).optional().nullable(),
  printedRepresentationStatus: z.enum(["PENDING", "SUBMITTED", "APPROVED", "REJECTED"]).optional(),
  productionAuthorizationStatus: z.enum(["PENDING", "REQUESTED", "AUTHORIZED", "REJECTED"]).optional(),
  notes: z.string().trim().max(2000).optional().nullable()
});

export const certificationStepUpdateSchema = z.object({
  status: z.enum(["PENDING", "RUNNING", "PASSED", "FAILED"]).optional(),
  evidenceUrl: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  responsibleName: z.string().trim().max(160).optional().nullable(),
  response: z.string().trim().max(2000).optional().nullable()
});

export type TaxConfigSavePayload = z.infer<typeof taxConfigSaveSchema>;
export type SequenceCreatePayload = z.infer<typeof sequenceCreateSchema>;
export type EmitEcfPayload = z.infer<typeof emitEcfSchema>;
export type CertificationProfileSavePayload = z.infer<typeof certificationProfileSaveSchema>;
export type CertificationStepUpdatePayload = z.infer<typeof certificationStepUpdateSchema>;
