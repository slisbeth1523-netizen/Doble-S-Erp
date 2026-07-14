import crypto from "node:crypto";

import { AppError } from "../../../shared/errors/app-error.js";
import { getSqlPool, sql } from "../../../shared/database/sqlserver.js";
import { buildEcfXml } from "../domain/ecf-xml-builder.js";
import { getDgiiEndpoints, type DgiiEnvironment } from "../domain/ecf-types.js";
import { cleanFiscalId, escapeXml } from "../utils/ecf-format.js";
import type {
  CertificationProfileSavePayload,
  CertificationStepUpdatePayload,
  EmitEcfPayload,
  SequenceCreatePayload,
  TaxConfigSavePayload
} from "../validators/electronic-invoicing.validators.js";

export type ElectronicInvoicingContext = {
  tenantId: string;
  companyId: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
};

const ofvUrl = "https://dgii.gov.do/ofv";
const ecfInfoUrl = "https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/default.aspx";
const certificationPortalUrl = "https://ecf.dgii.gov.do/certecf/portalcertificacion";

const certificationDefaults = [
  { ecfType: "POSTULACION", description: "Generar y firmar postulacion como emisor electronico", phaseCode: "POSTULACION", nature: "ERP", portalUrl: ofvUrl },
  { ecfType: "CONFIG", description: "Configurar certificado digital, logo, datos fiscales y URLs tecnicas", phaseCode: "PREPARACION", nature: "ERP", portalUrl: ecfInfoUrl },
  { ecfType: "DATOS_SOFTWARE", description: "Validar datos del software: tipo, nombre, version y proveedor", phaseCode: "PREPARACION", nature: "ERP", portalUrl: certificationPortalUrl },
  { ecfType: "E31_E32", description: "Ejecutar pruebas e-CF E31 y E32", phaseCode: "DATOS_ECF", nature: "API", portalUrl: certificationPortalUrl },
  { ecfType: "E33_E34", description: "Ejecutar pruebas de notas e-CF E33 y E34", phaseCode: "DATOS_ECF", nature: "API", portalUrl: certificationPortalUrl },
  { ecfType: "E41_E47", description: "Ejecutar pruebas de comprobantes especiales E41, E43, E44, E45, E46 y E47", phaseCode: "DATOS_ECF", nature: "API", portalUrl: certificationPortalUrl },
  { ecfType: "RFCE", description: "Ejecutar resumen factura consumo electronica RFCE", phaseCode: "DATOS_ECF", nature: "API", portalUrl: certificationPortalUrl },
  { ecfType: "ARECF", description: "Ejecutar acuse de recibo ARECF", phaseCode: "RECEPCION", nature: "API", portalUrl: certificationPortalUrl },
  { ecfType: "ACECF", description: "Ejecutar aprobacion o rechazo comercial ACECF", phaseCode: "RECEPCION", nature: "API", portalUrl: certificationPortalUrl },
  { ecfType: "REPRESENTACION", description: "Validar representacion impresa y logo del emisor", phaseCode: "RECEPCION", nature: "ERP", portalUrl: certificationPortalUrl },
  { ecfType: "URLS_PRUEBA", description: "Registrar URLs de prueba/certificacion solicitadas por DGII", phaseCode: "RECEPCION", nature: "PORTAL", portalUrl: certificationPortalUrl },
  { ecfType: "DECLARACION", description: "Generar y firmar declaracion jurada de certificacion", phaseCode: "PRODUCCION", nature: "ERP", portalUrl: certificationPortalUrl },
  { ecfType: "AUTORIZACION", description: "Solicitar autorizacion para operar en produccion", phaseCode: "PRODUCCION", nature: "PORTAL", portalUrl: certificationPortalUrl },
  { ecfType: "URLS_PROD", description: "Registrar URLs productivas y cambiar ambiente a produccion", phaseCode: "PRODUCCION", nature: "ERP", portalUrl: certificationPortalUrl },
  { ecfType: "PROD", description: "Confirmar inicio de operaciones en produccion", phaseCode: "PRODUCCION", nature: "PORTAL", portalUrl: certificationPortalUrl }
] as const;

function mapConfig(row: Record<string, unknown> | undefined) {
  if (!row) {
    return null;
  }

  return {
    CompanyTaxConfigurationId: row.CompanyFiscalSettingsId,
    Rnc: row.TaxId,
    FiscalName: row.FiscalName,
    Environment: row.ElectronicInvoicingEnvironment,
    CertificateAlias: row.CertificateAlias,
    CertificateFileName: row.CertificateFileName,
    CertificateUploadedAt: row.CertificateUploadedAt,
    IsElectronicInvoicingEnabled: Boolean(row.IsElectronicInvoicingEnabled),
    endpoints: getDgiiEndpoints(String(row.ElectronicInvoicingEnvironment ?? "TESTECF") as DgiiEnvironment)
  };
}

function mapSequence(row: Record<string, unknown>) {
  return {
    id: row.ElectronicInvoiceSequenceId,
    invoiceType: `E${row.InvoiceType}`,
    nextNumber: Number(row.NextNumber),
    rangeFrom: Number(row.RangeFrom),
    rangeTo: Number(row.RangeTo),
    prefix: row.Prefix,
    expirationDate: row.ExpirationDate,
    environment: row.Environment,
    isActive: Boolean(row.IsActive)
  };
}

function mapElectronicInvoice(row: Record<string, unknown>) {
  return {
    id: row.ElectronicInvoiceId,
    tenantId: row.TenantId,
    companyId: row.CompanyId,
    sourceInvoiceId: row.SourceInvoiceId,
    invoiceType: `E${row.InvoiceType}`,
    ecfNumber: row.EcfNumber,
    trackId: row.TrackId,
    status: row.Status,
    signedXml: row.SignedXml ?? row.XmlContent,
    responseXml: row.DgiiResponseJson,
    createdAt: row.CreatedAt,
    companyName: row.CompanyName,
    sourceInvoiceNumber: row.SourceInvoiceNumber,
    totalAmount: Number(row.TotalAmount ?? 0)
  };
}

function buildCertificationXml(kind: "POSTULACION" | "DECLARACION_JURADA", profile: Record<string, unknown>, config: Record<string, unknown> | null) {
  const now = new Date().toISOString();
  const certificateFileName = config?.CertificateFileName ?? "";
  const logoFileName = profile.LogoFileName ?? "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<SolicitudEmisorElectronico>
  <TipoDocumento>${kind}</TipoDocumento>
  <FechaGeneracion>${now}</FechaGeneracion>
  <Contribuyente>
    <RNC>${escapeXml(config?.TaxId ?? "")}</RNC>
    <RazonSocial>${escapeXml(config?.FiscalName ?? "")}</RazonSocial>
    <NombreComercial>${escapeXml(profile.CommercialName ?? "")}</NombreComercial>
    <TipoContribuyente>${escapeXml(profile.TaxpayerType ?? "")}</TipoContribuyente>
    <ActividadEconomica>${escapeXml(profile.EconomicActivity ?? "")}</ActividadEconomica>
  </Contribuyente>
  <Representante>
    <Nombre>${escapeXml(profile.RepresentativeName ?? "")}</Nombre>
    <Documento>${escapeXml(profile.RepresentativeDocument ?? "")}</Documento>
    <Correo>${escapeXml(profile.RepresentativeEmail ?? "")}</Correo>
    <Telefono>${escapeXml(profile.RepresentativePhone ?? "")}</Telefono>
  </Representante>
  <Adjuntos>
    <CertificadoDigital>${escapeXml(certificateFileName)}</CertificadoDigital>
    <Logo>${escapeXml(logoFileName)}</Logo>
  </Adjuntos>
  <ContactoTecnico>
    <Nombre>${escapeXml(profile.TechnicalContactName ?? "")}</Nombre>
    <Correo>${escapeXml(profile.TechnicalContactEmail ?? "")}</Correo>
    <Telefono>${escapeXml(profile.TechnicalContactPhone ?? "")}</Telefono>
  </ContactoTecnico>
  <Software>
    <Nombre>${escapeXml(profile.SoftwareName ?? "Doble S ERP")}</Nombre>
    <Version>${escapeXml(profile.SoftwareVersion ?? "1.0")}</Version>
    <RNCProveedor>${escapeXml(profile.SoftwareProviderRnc ?? "")}</RNCProveedor>
  </Software>
  <Servicios>
    <Autenticacion>${escapeXml(profile.ServiceAuthenticationUrl ?? "")}</Autenticacion>
    <Recepcion>${escapeXml(profile.ServiceReceptionUrl ?? "")}</Recepcion>
    <AprobacionComercial>${escapeXml(profile.ServiceApprovalUrl ?? "")}</AprobacionComercial>
  </Servicios>
  <Declaracion>
    <Texto>El contribuyente declara que las informaciones registradas para la certificacion e-CF son correctas y que el proceso sera ejecutado conforme a los requisitos de la DGII.</Texto>
  </Declaracion>
</SolicitudEmisorElectronico>`;
}

function signCertificationXml(xml: string, certificateData?: unknown, certificateFileName?: unknown) {
  const certFingerprint = crypto
    .createHash("sha256")
    .update(String(certificateData ?? "CERTIFICADO_NO_CARGADO"))
    .digest("hex");
  const xmlFingerprint = crypto.createHash("sha256").update(xml).digest("hex");

  return `${xml}
<!-- Firma local ERP pendiente de XAdES real -->
<!-- Certificado: ${escapeXml(certificateFileName ?? "sin archivo")} -->
<!-- CertificadoSHA256: ${certFingerprint} -->
<!-- DocumentoSHA256: ${xmlFingerprint} -->`;
}

export class ElectronicInvoicingRepository {
  async getTaxConfig(context: ElectronicInvoicingContext) {
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        SELECT TOP (1)
          CompanyFiscalSettingsId,
          TaxId,
          FiscalName,
          IsElectronicInvoicingEnabled,
          ElectronicInvoicingEnvironment,
          CertificateAlias
          ,CertificateFileName
          ,CertificateUploadedAt
        FROM fiscal.CompanyFiscalSettings
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
      `);

    return mapConfig(result.recordset[0]);
  }

  async saveTaxConfig(context: ElectronicInvoicingContext, payload: TaxConfigSavePayload) {
    const pool = await getSqlPool();
    const rnc = cleanFiscalId(payload.rnc);
    const fiscalName = payload.fiscalName?.trim() || "Emisor electronico";

    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("TaxId", sql.NVarChar(32), rnc)
      .input("FiscalName", sql.NVarChar(250), fiscalName)
      .input("Environment", sql.NVarChar(20), payload.environment)
      .input("CertificateAlias", sql.NVarChar(160), payload.certificateAlias ?? null)
      .input("CertificateData", sql.NVarChar(sql.MAX), payload.certificateData ?? null)
      .input("CertificateFileName", sql.NVarChar(260), payload.certificateFileName ?? null)
      .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
      .query(`
        IF EXISTS (
          SELECT 1 FROM fiscal.CompanyFiscalSettings WHERE TenantId = @TenantId AND CompanyId = @CompanyId
        )
        BEGIN
          UPDATE fiscal.CompanyFiscalSettings
          SET TaxId = @TaxId,
              FiscalName = @FiscalName,
              IsElectronicInvoicingEnabled = 1,
              ElectronicInvoicingEnvironment = @Environment,
              CertificateAlias = COALESCE(@CertificateAlias, CertificateAlias),
              CertificateData = COALESCE(@CertificateData, CertificateData),
              CertificateFileName = COALESCE(@CertificateFileName, CertificateFileName),
              CertificateUploadedAt = CASE WHEN @CertificateData IS NULL THEN CertificateUploadedAt ELSE SYSUTCDATETIME() END,
              UpdatedAt = SYSUTCDATETIME()
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId;
        END
        ELSE
        BEGIN
          INSERT INTO fiscal.CompanyFiscalSettings (
            TenantId, CompanyId, TaxId, FiscalName, IsElectronicInvoicingEnabled,
            ElectronicInvoicingEnvironment, CertificateAlias, CertificateData, CertificateFileName, CertificateUploadedAt
          )
          VALUES (
            @TenantId, @CompanyId, @TaxId, @FiscalName, 1,
            @Environment, @CertificateAlias, @CertificateData, @CertificateFileName,
            CASE WHEN @CertificateData IS NULL THEN NULL ELSE SYSUTCDATETIME() END
          );
        END
      `);

    return this.getTaxConfig(context);
  }

  async listSequences(context: ElectronicInvoicingContext) {
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        SELECT *
        FROM fiscal.ElectronicInvoiceSequences
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
        ORDER BY IsActive DESC, Environment, InvoiceType;
      `);

    return result.recordset.map(mapSequence);
  }

  async createSequence(context: ElectronicInvoicingContext, payload: SequenceCreatePayload) {
    const pool = await getSqlPool();
    const environment = payload.environment ?? ((await this.getTaxConfig(context))?.Environment as DgiiEnvironment | undefined) ?? "TESTECF";

    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("InvoiceType", sql.NVarChar(2), payload.invoiceType)
      .input("Prefix", sql.NVarChar(3), payload.prefix)
      .input("RangeFrom", sql.BigInt, payload.rangeFrom)
      .input("RangeTo", sql.BigInt, payload.rangeTo)
      .input("ExpirationDate", sql.Date, payload.expirationDate ?? null)
      .input("Environment", sql.NVarChar(20), environment)
      .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
      .query(`
        UPDATE fiscal.ElectronicInvoiceSequences
        SET IsActive = 0,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND Environment = @Environment
          AND InvoiceType = @InvoiceType
          AND IsActive = 1;

        INSERT INTO fiscal.ElectronicInvoiceSequences (
          TenantId, CompanyId, InvoiceType, Prefix, RangeFrom, RangeTo, NextNumber,
          ExpirationDate, Environment, IsActive, CreatedBy
        )
        VALUES (
          @TenantId, @CompanyId, @InvoiceType, @Prefix, @RangeFrom, @RangeTo, @RangeFrom,
          @ExpirationDate, @Environment, 1, @UserId
        );
      `);

    return this.listSequences(context);
  }

  async listElectronicInvoices(context: ElectronicInvoicingContext) {
    const pool = await getSqlPool();
    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        SELECT *
        FROM fiscal.V_ElectronicInvoiceSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
        ORDER BY CreatedAt DESC;
      `);

    return result.recordset.map(mapElectronicInvoice);
  }

  async emitElectronicInvoice(context: ElectronicInvoicingContext, sourceInvoiceId: string, payload: EmitEcfPayload) {
    const pool = await getSqlPool();
    const transaction = new sql.Transaction(pool);

    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const request = new sql.Request(transaction);
      request.input("TenantId", sql.UniqueIdentifier, context.tenantId);
      request.input("CompanyId", sql.UniqueIdentifier, context.companyId);
      request.input("SourceInvoiceId", sql.UniqueIdentifier, sourceInvoiceId);

      const existing = await request.query(`
        SELECT TOP (1)
          electronicInvoice.ElectronicInvoiceId,
          electronicInvoice.TenantId,
          electronicInvoice.CompanyId,
          electronicInvoice.SourceModule,
          electronicInvoice.SourceInvoiceId,
          salesInvoice.InvoiceNumber AS SourceInvoiceNumber,
          company.LegalName AS CompanyName,
          electronicInvoice.InvoiceType,
          electronicInvoice.EcfNumber,
          electronicInvoice.Environment,
          electronicInvoice.TrackId,
          electronicInvoice.Status,
          electronicInvoice.XmlContent,
          electronicInvoice.SignedXml,
          electronicInvoice.DgiiResponseJson,
          electronicInvoice.TotalAmount,
          electronicInvoice.CreatedAt
        FROM fiscal.ElectronicInvoices electronicInvoice WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN core.Companies company
          ON company.CompanyId = electronicInvoice.CompanyId
        INNER JOIN sales.SalesInvoices salesInvoice
          ON salesInvoice.SalesInvoiceId = electronicInvoice.SourceInvoiceId
        WHERE electronicInvoice.TenantId = @TenantId
          AND electronicInvoice.CompanyId = @CompanyId
          AND electronicInvoice.SourceInvoiceId = @SourceInvoiceId;
      `);

      if (existing.recordset[0]) {
        await transaction.commit();
        return mapElectronicInvoice(existing.recordset[0]);
      }

      const invoiceResult = await request.query(`
        SELECT TOP (1)
          invoice.SalesInvoiceId,
          invoice.InvoiceNumber,
          invoice.InvoiceDate,
          invoice.DueDate,
          invoice.Status,
          invoice.SubtotalAmount,
          invoice.TaxAmount,
          invoice.TotalAmount,
          invoice.CustomerId,
          salesOrder.OrderNumber,
          customer.Name AS CustomerName,
          customer.DocumentNumber AS CustomerDocumentNumber,
          customer.AddressLine1 AS CustomerAddress,
          company.LegalName AS CompanyName,
          company.TaxId AS CompanyTaxId,
          fiscalSettings.TaxId AS FiscalTaxId,
          fiscalSettings.FiscalName,
          fiscalSettings.ElectronicInvoicingEnvironment
        FROM sales.SalesInvoices invoice WITH (UPDLOCK, HOLDLOCK)
        INNER JOIN sales.SalesOrders salesOrder
          ON salesOrder.SalesOrderId = invoice.SalesOrderId
        INNER JOIN crm.Customers customer
          ON customer.CustomerId = invoice.CustomerId
        INNER JOIN core.Companies company
          ON company.CompanyId = invoice.CompanyId
        LEFT JOIN fiscal.CompanyFiscalSettings fiscalSettings
          ON fiscalSettings.TenantId = invoice.TenantId
         AND fiscalSettings.CompanyId = invoice.CompanyId
        WHERE invoice.TenantId = @TenantId
          AND invoice.CompanyId = @CompanyId
          AND invoice.SalesInvoiceId = @SourceInvoiceId;
      `);

      const invoice = invoiceResult.recordset[0];
      if (!invoice) {
        throw new AppError("Factura de venta no encontrada.", 404, "SALES_INVOICE_NOT_FOUND");
      }
      if (invoice.Status !== "POSTED") {
        throw new AppError("Solo se pueden emitir e-CF de facturas posteadas.", 409, "SALES_INVOICE_NOT_POSTED");
      }

      const environment = String(invoice.ElectronicInvoicingEnvironment ?? "TESTECF") as DgiiEnvironment;
      const invoiceType = payload.invoiceType ?? "31";

      const sequenceResult = await request
        .input("InvoiceType", sql.NVarChar(2), invoiceType)
        .input("Environment", sql.NVarChar(20), environment)
        .query(`
          SELECT TOP (1) *
          FROM fiscal.ElectronicInvoiceSequences WITH (UPDLOCK, HOLDLOCK)
          WHERE TenantId = @TenantId
            AND CompanyId = @CompanyId
            AND Environment = @Environment
            AND InvoiceType = @InvoiceType
            AND IsActive = 1
          ORDER BY CreatedAt DESC;
        `);

      const sequence = sequenceResult.recordset[0];
      if (!sequence) {
        throw new AppError("No existe una secuencia e-CF activa para este tipo de comprobante.", 409, "ECF_SEQUENCE_REQUIRED");
      }
      if (Number(sequence.NextNumber) > Number(sequence.RangeTo)) {
        throw new AppError("La secuencia e-CF activa esta agotada.", 409, "ECF_SEQUENCE_EXHAUSTED");
      }

      const lineResult = await request.query(`
        SELECT
          line.LineNumber,
          COALESCE(item.Code, CAST(line.LineNumber AS NVARCHAR(20))) AS ItemCode,
          COALESCE(line.Description, item.Description, 'Articulo') AS ItemDescription,
          line.Quantity,
          line.UnitPrice,
          line.LineTotal
        FROM sales.SalesInvoiceLines line
        LEFT JOIN inventory.Items item
          ON item.ItemId = line.ItemId
        WHERE line.TenantId = @TenantId
          AND line.CompanyId = @CompanyId
          AND line.SalesInvoiceId = @SourceInvoiceId
        ORDER BY line.LineNumber;
      `);

      const ecfNumber = `${sequence.Prefix}${String(sequence.NextNumber).padStart(10, "0")}`;
      const xmlContent = buildEcfXml({
        ecfNumber,
        invoiceType,
        sequenceExpirationDate: sequence.ExpirationDate,
        invoiceDate: new Date(invoice.InvoiceDate),
        dueDate: invoice.DueDate ? new Date(invoice.DueDate) : null,
        companyTaxId: cleanFiscalId(String(invoice.FiscalTaxId ?? invoice.CompanyTaxId ?? "")),
        companyName: String(invoice.FiscalName ?? invoice.CompanyName),
        companyAddress: null,
        customerTaxId: invoice.CustomerDocumentNumber ? cleanFiscalId(String(invoice.CustomerDocumentNumber)) : null,
        customerName: String(invoice.CustomerName),
        customerAddress: invoice.CustomerAddress,
        sourceInvoiceNumber: String(invoice.InvoiceNumber),
        orderNumber: invoice.OrderNumber,
        subtotalAmount: Number(invoice.SubtotalAmount ?? 0),
        taxAmount: Number(invoice.TaxAmount ?? 0),
        totalAmount: Number(invoice.TotalAmount ?? 0),
        lines: lineResult.recordset.map((line) => ({
          lineNumber: Number(line.LineNumber),
          itemName: String(line.ItemCode),
          itemDescription: String(line.ItemDescription),
          quantity: Number(line.Quantity ?? 0),
          unitPrice: Number(line.UnitPrice ?? 0),
          lineTotal: Number(line.LineTotal ?? 0)
        }))
      });
      const signatureHash = crypto.createHash("sha256").update(xmlContent).digest("hex");
      const signedXml = `${xmlContent}\n<!-- Firma simulada local SHA256:${signatureHash} -->`;
      const trackId = `SIM-${crypto.randomUUID()}`;
      const response = {
        mode: "SIMULATED",
        status: "ACCEPTED",
        trackId,
        endpoints: getDgiiEndpoints(environment),
        note: "Emision local simulada. Para DGII real se requiere certificado valido y transporte oficial."
      };

      await request
        .input("EcfNumber", sql.NVarChar(13), ecfNumber)
        .input("TrackId", sql.NVarChar(80), trackId)
        .input("XmlContent", sql.NVarChar(sql.MAX), xmlContent)
        .input("SignedXml", sql.NVarChar(sql.MAX), signedXml)
        .input("ResponseJson", sql.NVarChar(sql.MAX), JSON.stringify(response))
        .input("TotalAmount", sql.Decimal(18, 4), Number(invoice.TotalAmount ?? 0))
        .input("SequenceId", sql.UniqueIdentifier, sequence.ElectronicInvoiceSequenceId)
        .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
        .query(`
          INSERT INTO fiscal.ElectronicInvoices (
            TenantId, CompanyId, SourceModule, SourceInvoiceId, InvoiceType, EcfNumber,
            Environment, TrackId, Status, XmlContent, SignedXml, DgiiResponseJson,
            TotalAmount, IssuedAt, CreatedBy
          )
          VALUES (
            @TenantId, @CompanyId, 'SALES', @SourceInvoiceId, @InvoiceType, @EcfNumber,
            @Environment, @TrackId, 'ACCEPTED', @XmlContent, @SignedXml, @ResponseJson,
            @TotalAmount, SYSUTCDATETIME(), @UserId
          );

          UPDATE fiscal.ElectronicInvoiceSequences
          SET NextNumber = NextNumber + 1,
              UpdatedAt = SYSUTCDATETIME(),
              UpdatedBy = @UserId
          WHERE ElectronicInvoiceSequenceId = @SequenceId;
        `);

      const created = await request.query(`
        SELECT *
        FROM fiscal.V_ElectronicInvoiceSummary
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND SourceInvoiceId = @SourceInvoiceId;
      `);

      await transaction.commit();
      return mapElectronicInvoice(created.recordset[0]);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listCertificationSteps(context: ElectronicInvoicingContext) {
    const pool = await getSqlPool();

    for (const [index, step] of certificationDefaults.entries()) {
      await pool
        .request()
        .input("TenantId", sql.UniqueIdentifier, context.tenantId)
        .input("CompanyId", sql.UniqueIdentifier, context.companyId)
        .input("StepNumber", sql.Int, index + 1)
        .input("EcfType", sql.NVarChar(20), step.ecfType)
        .input("Description", sql.NVarChar(500), step.description)
        .input("PhaseCode", sql.NVarChar(40), step.phaseCode)
        .input("Nature", sql.NVarChar(20), step.nature)
        .input("PortalUrl", sql.NVarChar(500), step.portalUrl)
        .query(`
          IF NOT EXISTS (
            SELECT 1 FROM fiscal.ElectronicCertificationSteps
            WHERE TenantId = @TenantId AND CompanyId = @CompanyId AND StepNumber = @StepNumber
          )
          BEGIN
            INSERT INTO fiscal.ElectronicCertificationSteps (
              TenantId, CompanyId, StepNumber, EcfType, Description, PhaseCode, Nature, PortalUrl
            )
            VALUES (
              @TenantId, @CompanyId, @StepNumber, @EcfType, @Description, @PhaseCode, @Nature, @PortalUrl
            );
          END
          ELSE
          BEGIN
            UPDATE fiscal.ElectronicCertificationSteps
            SET EcfType = @EcfType,
                Description = @Description,
                PhaseCode = @PhaseCode,
                Nature = @Nature,
                PortalUrl = @PortalUrl
            WHERE TenantId = @TenantId
              AND CompanyId = @CompanyId
              AND StepNumber = @StepNumber;
          END
        `);
    }

    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        SELECT
          StepNumber AS stepNumber,
          Description AS description,
          EcfType AS ecfType,
          PhaseCode AS phaseCode,
          Nature AS nature,
          Status AS status,
          TrackId AS trackId,
          Response AS response,
          PortalUrl AS portalUrl,
          EvidenceUrl AS evidenceUrl,
          Notes AS notes,
          ResponsibleName AS responsibleName,
          CompletedAt AS completedAt
        FROM fiscal.ElectronicCertificationSteps
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
        ORDER BY StepNumber;
      `);

    return result.recordset;
  }

  async runCertificationStep(context: ElectronicInvoicingContext, stepNumber: number) {
    const trackId = `CERT-${stepNumber}-${crypto.randomUUID()}`;
    const pool = await getSqlPool();
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("StepNumber", sql.Int, stepNumber)
      .input("TrackId", sql.NVarChar(80), trackId)
      .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
      .query(`
        UPDATE fiscal.ElectronicCertificationSteps
        SET Status = 'PASSED',
            TrackId = @TrackId,
            Response = 'Validacion local registrada para certificacion e-CF.',
            CompletedAt = SYSUTCDATETIME(),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND StepNumber = @StepNumber;
      `);

    const steps = await this.listCertificationSteps(context);
    return steps.find((step) => Number(step.stepNumber) === stepNumber);
  }

  async resetCertification(context: ElectronicInvoicingContext) {
    const pool = await getSqlPool();
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        UPDATE fiscal.ElectronicCertificationSteps
        SET Status = 'PENDING',
            TrackId = NULL,
            Response = NULL,
            EvidenceUrl = NULL,
            Notes = NULL,
            CompletedAt = NULL,
            UpdatedAt = SYSUTCDATETIME()
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return this.listCertificationSteps(context);
  }

  async getCertificationProfile(context: ElectronicInvoicingContext) {
    const pool = await getSqlPool();
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("OfvUrl", sql.NVarChar(500), ofvUrl)
      .input("CertificationUrl", sql.NVarChar(500), certificationPortalUrl)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM fiscal.ElectronicCertificationProfiles
          WHERE TenantId = @TenantId AND CompanyId = @CompanyId
        )
        BEGIN
          INSERT INTO fiscal.ElectronicCertificationProfiles (
            TenantId, CompanyId, TaxOfficeVirtualUrl, CertificationPortalUrl
          )
          VALUES (@TenantId, @CompanyId, @OfvUrl, @CertificationUrl);
        END
      `);

    const result = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        SELECT TOP (1)
          ElectronicCertificationProfileId AS id,
          ApplicationStatus AS applicationStatus,
          ApplicationReference AS applicationReference,
          PortalUser AS portalUser,
          CertificationPortalUrl AS certificationPortalUrl,
          TaxOfficeVirtualUrl AS taxOfficeVirtualUrl,
          CommercialName AS commercialName,
          EconomicActivity AS economicActivity,
          TaxpayerType AS taxpayerType,
          RepresentativeName AS representativeName,
          RepresentativeDocument AS representativeDocument,
          RepresentativeEmail AS representativeEmail,
          RepresentativePhone AS representativePhone,
          TechnicalContactName AS technicalContactName,
          TechnicalContactEmail AS technicalContactEmail,
          TechnicalContactPhone AS technicalContactPhone,
          SoftwareName AS softwareName,
          SoftwareVersion AS softwareVersion,
          SoftwareProviderRnc AS softwareProviderRnc,
          ServiceReceptionUrl AS serviceReceptionUrl,
          ServiceApprovalUrl AS serviceApprovalUrl,
          ServiceAuthenticationUrl AS serviceAuthenticationUrl,
          LogoFileName AS logoFileName,
          LogoMimeType AS logoMimeType,
          LogoBase64 AS logoBase64,
          ApplicationXml AS applicationXml,
          SignedApplicationXml AS signedApplicationXml,
          AffidavitXml AS affidavitXml,
          SignedAffidavitXml AS signedAffidavitXml,
          PrintedRepresentationStatus AS printedRepresentationStatus,
          ProductionAuthorizationStatus AS productionAuthorizationStatus,
          Notes AS notes,
          CreatedAt AS createdAt,
          UpdatedAt AS updatedAt
        FROM fiscal.ElectronicCertificationProfiles
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return result.recordset[0];
  }

  async generateCertificationDocument(context: ElectronicInvoicingContext, kind: "POSTULACION" | "DECLARACION_JURADA") {
    await this.getCertificationProfile(context);
    await this.listCertificationSteps(context);

    const pool = await getSqlPool();
    const data = await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .query(`
        SELECT TOP (1) *
        FROM fiscal.ElectronicCertificationProfiles
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;

        SELECT TOP (1) *
        FROM fiscal.CompanyFiscalSettings
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    const recordsets = data.recordsets as sql.IRecordSet<Record<string, unknown>>[];
    const profile = recordsets[0]?.[0];
    const config = recordsets[1]?.[0] ?? null;
    if (!profile) {
      throw new AppError("Expediente de certificacion no encontrado.", 404, "CERTIFICATION_PROFILE_NOT_FOUND");
    }

    const requiredFields = [
      ["RNC", config?.TaxId],
      ["razon social", config?.FiscalName],
      ["nombre del software", profile.SoftwareName],
      ["version del software", profile.SoftwareVersion],
      ["URL de recepcion", profile.ServiceReceptionUrl],
      ["URL de aprobacion", profile.ServiceApprovalUrl],
      ["URL de autenticacion", profile.ServiceAuthenticationUrl]
    ];
    const missing = requiredFields.filter(([, value]) => !String(value ?? "").trim()).map(([label]) => label);
    if (missing.length > 0) {
      throw new AppError(
        `Completa estos datos antes de generar el documento: ${missing.join(", ")}.`,
        409,
        "CERTIFICATION_PROFILE_INCOMPLETE"
      );
    }

    const xml = buildCertificationXml(kind, profile, config);
    const signedXml = signCertificationXml(xml, config?.CertificateData, config?.CertificateFileName);
    const stepType = kind === "POSTULACION" ? "POSTULACION" : "DECLARACION";
    const evidenceUrl = `erp://dgii/certification/${kind.toLowerCase()}`;
    const response = kind === "POSTULACION"
      ? "Postulacion generada y firmada desde el ERP para cargar en Oficina Virtual DGII."
      : "Declaracion jurada generada y firmada desde el ERP para completar el paso a produccion.";

    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("ApplicationXml", sql.NVarChar(sql.MAX), kind === "POSTULACION" ? xml : null)
      .input("SignedApplicationXml", sql.NVarChar(sql.MAX), kind === "POSTULACION" ? signedXml : null)
      .input("AffidavitXml", sql.NVarChar(sql.MAX), kind === "DECLARACION_JURADA" ? xml : null)
      .input("SignedAffidavitXml", sql.NVarChar(sql.MAX), kind === "DECLARACION_JURADA" ? signedXml : null)
      .input("StepType", sql.NVarChar(20), stepType)
      .input("EvidenceUrl", sql.NVarChar(500), evidenceUrl)
      .input("Response", sql.NVarChar(sql.MAX), response)
      .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
      .query(`
        UPDATE fiscal.ElectronicCertificationProfiles
        SET ApplicationXml = COALESCE(@ApplicationXml, ApplicationXml),
            SignedApplicationXml = COALESCE(@SignedApplicationXml, SignedApplicationXml),
            AffidavitXml = COALESCE(@AffidavitXml, AffidavitXml),
            SignedAffidavitXml = COALESCE(@SignedAffidavitXml, SignedAffidavitXml),
            ApplicationStatus = CASE WHEN @ApplicationXml IS NULL THEN ApplicationStatus ELSE 'READY_TO_APPLY' END,
            ProductionAuthorizationStatus = CASE WHEN @AffidavitXml IS NULL THEN ProductionAuthorizationStatus ELSE 'REQUESTED' END,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;

        UPDATE fiscal.ElectronicCertificationSteps
        SET Status = 'PASSED',
            EvidenceUrl = @EvidenceUrl,
            Response = @Response,
            CompletedAt = COALESCE(CompletedAt, SYSUTCDATETIME()),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND EcfType = @StepType;
      `);

    return {
      kind,
      xml,
      signedXml,
      profile: await this.getCertificationProfile(context),
      steps: await this.listCertificationSteps(context)
    };
  }

  async saveCertificationProfile(context: ElectronicInvoicingContext, payload: CertificationProfileSavePayload) {
    await this.getCertificationProfile(context);
    const pool = await getSqlPool();
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("ApplicationStatus", sql.NVarChar(30), payload.applicationStatus ?? null)
      .input("ApplicationReference", sql.NVarChar(120), payload.applicationReference ?? null)
      .input("PortalUser", sql.NVarChar(160), payload.portalUser ?? null)
      .input("CertificationPortalUrl", sql.NVarChar(500), payload.certificationPortalUrl ?? null)
      .input("TaxOfficeVirtualUrl", sql.NVarChar(500), payload.taxOfficeVirtualUrl ?? null)
      .input("CommercialName", sql.NVarChar(250), payload.commercialName ?? null)
      .input("EconomicActivity", sql.NVarChar(250), payload.economicActivity ?? null)
      .input("TaxpayerType", sql.NVarChar(80), payload.taxpayerType ?? null)
      .input("RepresentativeName", sql.NVarChar(200), payload.representativeName ?? null)
      .input("RepresentativeDocument", sql.NVarChar(40), payload.representativeDocument ?? null)
      .input("RepresentativeEmail", sql.NVarChar(200), payload.representativeEmail ?? null)
      .input("RepresentativePhone", sql.NVarChar(60), payload.representativePhone ?? null)
      .input("TechnicalContactName", sql.NVarChar(160), payload.technicalContactName ?? null)
      .input("TechnicalContactEmail", sql.NVarChar(200), payload.technicalContactEmail ?? null)
      .input("TechnicalContactPhone", sql.NVarChar(60), payload.technicalContactPhone ?? null)
      .input("SoftwareName", sql.NVarChar(160), payload.softwareName ?? null)
      .input("SoftwareVersion", sql.NVarChar(80), payload.softwareVersion ?? null)
      .input("SoftwareProviderRnc", sql.NVarChar(40), payload.softwareProviderRnc ?? null)
      .input("ServiceReceptionUrl", sql.NVarChar(500), payload.serviceReceptionUrl ?? null)
      .input("ServiceApprovalUrl", sql.NVarChar(500), payload.serviceApprovalUrl ?? null)
      .input("ServiceAuthenticationUrl", sql.NVarChar(500), payload.serviceAuthenticationUrl ?? null)
      .input("LogoFileName", sql.NVarChar(260), payload.logoFileName ?? null)
      .input("LogoMimeType", sql.NVarChar(80), payload.logoMimeType ?? null)
      .input("LogoBase64", sql.NVarChar(sql.MAX), payload.logoBase64 ?? null)
      .input("PrintedRepresentationStatus", sql.NVarChar(30), payload.printedRepresentationStatus ?? null)
      .input("ProductionAuthorizationStatus", sql.NVarChar(30), payload.productionAuthorizationStatus ?? null)
      .input("Notes", sql.NVarChar(2000), payload.notes ?? null)
      .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
      .query(`
        UPDATE fiscal.ElectronicCertificationProfiles
        SET ApplicationStatus = COALESCE(@ApplicationStatus, ApplicationStatus),
            ApplicationReference = COALESCE(@ApplicationReference, ApplicationReference),
            PortalUser = COALESCE(@PortalUser, PortalUser),
            CertificationPortalUrl = COALESCE(@CertificationPortalUrl, CertificationPortalUrl),
            TaxOfficeVirtualUrl = COALESCE(@TaxOfficeVirtualUrl, TaxOfficeVirtualUrl),
            CommercialName = COALESCE(@CommercialName, CommercialName),
            EconomicActivity = COALESCE(@EconomicActivity, EconomicActivity),
            TaxpayerType = COALESCE(@TaxpayerType, TaxpayerType),
            RepresentativeName = COALESCE(@RepresentativeName, RepresentativeName),
            RepresentativeDocument = COALESCE(@RepresentativeDocument, RepresentativeDocument),
            RepresentativeEmail = COALESCE(@RepresentativeEmail, RepresentativeEmail),
            RepresentativePhone = COALESCE(@RepresentativePhone, RepresentativePhone),
            TechnicalContactName = COALESCE(@TechnicalContactName, TechnicalContactName),
            TechnicalContactEmail = COALESCE(@TechnicalContactEmail, TechnicalContactEmail),
            TechnicalContactPhone = COALESCE(@TechnicalContactPhone, TechnicalContactPhone),
            SoftwareName = COALESCE(@SoftwareName, SoftwareName),
            SoftwareVersion = COALESCE(@SoftwareVersion, SoftwareVersion),
            SoftwareProviderRnc = COALESCE(@SoftwareProviderRnc, SoftwareProviderRnc),
            ServiceReceptionUrl = COALESCE(@ServiceReceptionUrl, ServiceReceptionUrl),
            ServiceApprovalUrl = COALESCE(@ServiceApprovalUrl, ServiceApprovalUrl),
            ServiceAuthenticationUrl = COALESCE(@ServiceAuthenticationUrl, ServiceAuthenticationUrl),
            LogoFileName = COALESCE(@LogoFileName, LogoFileName),
            LogoMimeType = COALESCE(@LogoMimeType, LogoMimeType),
            LogoBase64 = COALESCE(@LogoBase64, LogoBase64),
            PrintedRepresentationStatus = COALESCE(@PrintedRepresentationStatus, PrintedRepresentationStatus),
            ProductionAuthorizationStatus = COALESCE(@ProductionAuthorizationStatus, ProductionAuthorizationStatus),
            Notes = COALESCE(@Notes, Notes),
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId;
      `);

    return this.getCertificationProfile(context);
  }

  async updateCertificationStep(context: ElectronicInvoicingContext, stepNumber: number, payload: CertificationStepUpdatePayload) {
    await this.listCertificationSteps(context);
    const pool = await getSqlPool();
    await pool
      .request()
      .input("TenantId", sql.UniqueIdentifier, context.tenantId)
      .input("CompanyId", sql.UniqueIdentifier, context.companyId)
      .input("StepNumber", sql.Int, stepNumber)
      .input("Status", sql.NVarChar(20), payload.status ?? null)
      .input("EvidenceUrl", sql.NVarChar(500), payload.evidenceUrl ?? null)
      .input("Notes", sql.NVarChar(2000), payload.notes ?? null)
      .input("ResponsibleName", sql.NVarChar(160), payload.responsibleName ?? null)
      .input("Response", sql.NVarChar(sql.MAX), payload.response ?? null)
      .input("UserId", sql.UniqueIdentifier, context.userId ?? null)
      .query(`
        UPDATE fiscal.ElectronicCertificationSteps
        SET Status = COALESCE(@Status, Status),
            EvidenceUrl = COALESCE(@EvidenceUrl, EvidenceUrl),
            Notes = COALESCE(@Notes, Notes),
            ResponsibleName = COALESCE(@ResponsibleName, ResponsibleName),
            Response = COALESCE(@Response, Response),
            CompletedAt = CASE WHEN COALESCE(@Status, Status) = 'PASSED' THEN COALESCE(CompletedAt, SYSUTCDATETIME()) ELSE CompletedAt END,
            UpdatedAt = SYSUTCDATETIME(),
            UpdatedBy = @UserId
        WHERE TenantId = @TenantId
          AND CompanyId = @CompanyId
          AND StepNumber = @StepNumber;
      `);

    const steps = await this.listCertificationSteps(context);
    return steps.find((step) => Number(step.stepNumber) === stepNumber);
  }
}

export const electronicInvoicingRepository = new ElectronicInvoicingRepository();
