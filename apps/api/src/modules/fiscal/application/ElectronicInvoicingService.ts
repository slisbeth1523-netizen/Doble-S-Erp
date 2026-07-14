import { domainEventPublisher } from "../../events/application/DomainEventPublisher.js";
import { auditEvent } from "../../../utils/audit.js";
import { logger } from "../../../utils/logger.js";
import {
  electronicInvoicingRepository,
  type ElectronicInvoicingContext
} from "../infrastructure/ElectronicInvoicingRepository.js";
import type {
  CertificationProfileSavePayload,
  CertificationStepUpdatePayload,
  EmitEcfPayload,
  SequenceCreatePayload,
  TaxConfigSavePayload
} from "../validators/electronic-invoicing.validators.js";

export class ElectronicInvoicingService {
  constructor(private readonly repository = electronicInvoicingRepository) {}

  getTaxConfig(context: ElectronicInvoicingContext) {
    return this.repository.getTaxConfig(context);
  }

  saveTaxConfig(context: ElectronicInvoicingContext, payload: TaxConfigSavePayload) {
    return this.repository.saveTaxConfig(context, payload);
  }

  listSequences(context: ElectronicInvoicingContext) {
    return this.repository.listSequences(context);
  }

  createSequence(context: ElectronicInvoicingContext, payload: SequenceCreatePayload) {
    return this.repository.createSequence(context, payload);
  }

  listElectronicInvoices(context: ElectronicInvoicingContext) {
    return this.repository.listElectronicInvoices(context);
  }

  async emitElectronicInvoice(context: ElectronicInvoicingContext, sourceInvoiceId: string, payload: EmitEcfPayload) {
    const result = await this.repository.emitElectronicInvoice(context, sourceInvoiceId, payload);
    await this.recordEmitSideEffects(context, result);
    return result;
  }

  listCertificationSteps(context: ElectronicInvoicingContext) {
    return this.repository.listCertificationSteps(context);
  }

  getCertificationProfile(context: ElectronicInvoicingContext) {
    return this.repository.getCertificationProfile(context);
  }

  saveCertificationProfile(context: ElectronicInvoicingContext, payload: CertificationProfileSavePayload) {
    return this.repository.saveCertificationProfile(context, payload);
  }

  runCertificationStep(context: ElectronicInvoicingContext, stepNumber: number) {
    return this.repository.runCertificationStep(context, stepNumber);
  }

  updateCertificationStep(context: ElectronicInvoicingContext, stepNumber: number, payload: CertificationStepUpdatePayload) {
    return this.repository.updateCertificationStep(context, stepNumber, payload);
  }

  generateCertificationApplication(context: ElectronicInvoicingContext) {
    return this.repository.generateCertificationDocument(context, "POSTULACION");
  }

  generateCertificationAffidavit(context: ElectronicInvoicingContext) {
    return this.repository.generateCertificationDocument(context, "DECLARACION_JURADA");
  }

  resetCertification(context: ElectronicInvoicingContext) {
    return this.repository.resetCertification(context);
  }

  private async recordEmitSideEffects(context: ElectronicInvoicingContext, result: { id: unknown; ecfNumber: unknown; sourceInvoiceId: unknown; status: unknown }) {
    try {
      await auditEvent({
        tenantId: context.tenantId,
        companyId: context.companyId,
        userId: context.userId,
        action: "ELECTRONIC_INVOICE_EMITTED",
        entity: "fiscal.ElectronicInvoices",
        entityId: String(result.id),
        metadata: {
          ecfNumber: result.ecfNumber,
          sourceInvoiceId: result.sourceInvoiceId,
          status: result.status,
          requestId: context.requestId,
          correlationId: context.correlationId
        }
      });
    } catch (error) {
      logger.warn("Electronic invoice audit could not be recorded", {
        electronicInvoiceId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    try {
      await domainEventPublisher.publish(
        {
          tenantId: context.tenantId,
          companyId: context.companyId,
          userId: context.userId,
          requestId: context.requestId ?? "",
          correlationId: context.correlationId ?? context.requestId ?? ""
        },
        {
          eventName: "fiscal.electronic-invoice.emitted",
          eventType: "fiscal.electronic-invoice.emitted",
          sourceModule: "fiscal",
          sourceEntity: "fiscal.ElectronicInvoices",
          sourceEntityId: String(result.id),
          payload: result
        }
      );
    } catch (error) {
      logger.warn("Electronic invoice event could not be published", {
        electronicInvoiceId: result.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

export const electronicInvoicingService = new ElectronicInvoicingService();
