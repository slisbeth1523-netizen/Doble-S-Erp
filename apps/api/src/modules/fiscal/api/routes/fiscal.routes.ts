import { Router } from "express";

import { requireCompanyContext, requireTenantContext } from "../../../core/api/tenant-context.middleware.js";
import { requireAuth } from "../../../security/api/auth.middleware.js";
import { requirePermission } from "../../../security/api/permission.middleware.js";
import { asyncHandler } from "../../../../shared/http/async-handler.js";
import { getRequestContext } from "../../../../utils/requestContext.js";
import { sendSuccess } from "../../../../utils/responseBuilder.js";
import { validateRequest } from "../../../../utils/validateRequest.js";
import { electronicInvoicingService } from "../../application/ElectronicInvoicingService.js";
import {
  certificationProfileSaveSchema,
  certificationStepParamsSchema,
  certificationStepUpdateSchema,
  emitEcfParamsSchema,
  emitEcfSchema,
  sequenceCreateSchema,
  taxConfigSaveSchema
} from "../../validators/electronic-invoicing.validators.js";

export const fiscalRouter = Router();

fiscalRouter.use(requireAuth, requireTenantContext, requireCompanyContext);

function fiscalContext(request: Parameters<typeof getRequestContext>[0]) {
  const context = getRequestContext(request);

  return {
    tenantId: request.tenantContext!.tenantId,
    companyId: request.tenantContext!.companyId!,
    userId: context.userId,
    requestId: context.requestId,
    correlationId: context.correlationId
  };
}

fiscalRouter.get(
  "/tax-config",
  requirePermission("fiscal", "dgii.electronic-invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.getTaxConfig(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/tax-config",
  validateRequest({ body: taxConfigSaveSchema }),
  requirePermission("fiscal", "dgii.electronic-invoices.configure"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.saveTaxConfig(fiscalContext(request), request.body);
    sendSuccess(response, result);
  })
);

fiscalRouter.get(
  "/sequences",
  requirePermission("fiscal", "dgii.electronic-invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.listSequences(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/sequences",
  validateRequest({ body: sequenceCreateSchema }),
  requirePermission("fiscal", "dgii.electronic-invoices.configure"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.createSequence(fiscalContext(request), request.body);
    sendSuccess(response, result, 201);
  })
);

fiscalRouter.get(
  "/electronic-invoices",
  requirePermission("fiscal", "dgii.electronic-invoices.read"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.listElectronicInvoices(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/electronic-invoices/:sourceInvoiceId/emit",
  validateRequest({ params: emitEcfParamsSchema, body: emitEcfSchema }),
  requirePermission("fiscal", "dgii.electronic-invoices.emit"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.emitElectronicInvoice(
      fiscalContext(request),
      request.params.sourceInvoiceId!,
      request.body
    );
    sendSuccess(response, result);
  })
);

fiscalRouter.get(
  "/certification/profile",
  requirePermission("fiscal", "dgii.certification.read"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.getCertificationProfile(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/certification/profile",
  validateRequest({ body: certificationProfileSaveSchema }),
  requirePermission("fiscal", "dgii.certification.update"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.saveCertificationProfile(fiscalContext(request), request.body);
    sendSuccess(response, result);
  })
);

fiscalRouter.get(
  "/certification/steps",
  requirePermission("fiscal", "dgii.certification.read"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.listCertificationSteps(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/certification/steps/:stepNumber",
  validateRequest({ params: certificationStepParamsSchema, body: certificationStepUpdateSchema }),
  requirePermission("fiscal", "dgii.certification.update"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.updateCertificationStep(
      fiscalContext(request),
      Number(request.params.stepNumber),
      request.body
    );
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/certification/steps/:stepNumber/run",
  validateRequest({ params: certificationStepParamsSchema }),
  requirePermission("fiscal", "dgii.certification.update"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.runCertificationStep(
      fiscalContext(request),
      Number(request.params.stepNumber)
    );
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/certification/application/generate",
  requirePermission("fiscal", "dgii.certification.update"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.generateCertificationApplication(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/certification/affidavit/generate",
  requirePermission("fiscal", "dgii.certification.update"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.generateCertificationAffidavit(fiscalContext(request));
    sendSuccess(response, result);
  })
);

fiscalRouter.post(
  "/certification/reset",
  requirePermission("fiscal", "dgii.certification.update"),
  asyncHandler(async (request, response) => {
    const result = await electronicInvoicingService.resetCertification(fiscalContext(request));
    sendSuccess(response, result);
  })
);
