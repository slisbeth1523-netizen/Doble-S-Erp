IF OBJECT_ID('fiscal.ElectronicCertificationProfiles', 'U') IS NULL
BEGIN
    CREATE TABLE fiscal.ElectronicCertificationProfiles (
        ElectronicCertificationProfileId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationProfiles_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        ApplicationStatus NVARCHAR(30) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationProfiles_ApplicationStatus DEFAULT 'NOT_STARTED',
        ApplicationReference NVARCHAR(120) NULL,
        PortalUser NVARCHAR(160) NULL,
        CertificationPortalUrl NVARCHAR(500) NULL,
        TaxOfficeVirtualUrl NVARCHAR(500) NULL,
        TechnicalContactName NVARCHAR(160) NULL,
        TechnicalContactEmail NVARCHAR(200) NULL,
        TechnicalContactPhone NVARCHAR(60) NULL,
        ServiceReceptionUrl NVARCHAR(500) NULL,
        ServiceApprovalUrl NVARCHAR(500) NULL,
        ServiceAuthenticationUrl NVARCHAR(500) NULL,
        PrintedRepresentationStatus NVARCHAR(30) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationProfiles_PrintStatus DEFAULT 'PENDING',
        ProductionAuthorizationStatus NVARCHAR(30) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationProfiles_ProdStatus DEFAULT 'PENDING',
        Notes NVARCHAR(2000) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_fiscal_ElectronicCertificationProfiles_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_fiscal_ElectronicCertificationProfiles PRIMARY KEY (ElectronicCertificationProfileId),
        CONSTRAINT FK_fiscal_ElectronicCertificationProfiles_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_fiscal_ElectronicCertificationProfiles_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT UQ_fiscal_ElectronicCertificationProfiles_Company UNIQUE (TenantId, CompanyId),
        CONSTRAINT CK_fiscal_ElectronicCertificationProfiles_ApplicationStatus CHECK (ApplicationStatus IN ('NOT_STARTED','READY_TO_APPLY','SUBMITTED','APPROVED','REJECTED','ON_HOLD')),
        CONSTRAINT CK_fiscal_ElectronicCertificationProfiles_PrintStatus CHECK (PrintedRepresentationStatus IN ('PENDING','SUBMITTED','APPROVED','REJECTED')),
        CONSTRAINT CK_fiscal_ElectronicCertificationProfiles_ProdStatus CHECK (ProductionAuthorizationStatus IN ('PENDING','REQUESTED','AUTHORIZED','REJECTED'))
    );
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'PhaseCode') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD PhaseCode NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'Nature') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD Nature NVARCHAR(20) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'PortalUrl') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD PortalUrl NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'EvidenceUrl') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD EvidenceUrl NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'Notes') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD Notes NVARCHAR(2000) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'ResponsibleName') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD ResponsibleName NVARCHAR(160) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationSteps', 'CompletedAt') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationSteps
        ADD CompletedAt DATETIME2(7) NULL;
END;
GO

CREATE OR ALTER VIEW fiscal.V_ElectronicCertificationStepSummary AS
SELECT
    step.ElectronicCertificationStepId,
    step.TenantId,
    step.CompanyId,
    step.StepNumber,
    step.EcfType,
    step.Description,
    step.PhaseCode,
    step.Nature,
    step.Status,
    step.TrackId,
    step.Response,
    step.PortalUrl,
    step.EvidenceUrl,
    step.Notes,
    step.ResponsibleName,
    step.CompletedAt,
    step.UpdatedAt,
    step.UpdatedBy
FROM fiscal.ElectronicCertificationSteps step;
GO
