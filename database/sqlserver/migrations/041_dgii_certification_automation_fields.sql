IF COL_LENGTH('fiscal.CompanyFiscalSettings', 'CertificateFileName') IS NULL
BEGIN
    ALTER TABLE fiscal.CompanyFiscalSettings
        ADD CertificateFileName NVARCHAR(260) NULL;
END;
GO

IF COL_LENGTH('fiscal.CompanyFiscalSettings', 'CertificateUploadedAt') IS NULL
BEGIN
    ALTER TABLE fiscal.CompanyFiscalSettings
        ADD CertificateUploadedAt DATETIME2(7) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'CommercialName') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD CommercialName NVARCHAR(250) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'EconomicActivity') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD EconomicActivity NVARCHAR(250) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'TaxpayerType') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD TaxpayerType NVARCHAR(80) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'RepresentativeName') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD RepresentativeName NVARCHAR(200) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'RepresentativeDocument') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD RepresentativeDocument NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'RepresentativeEmail') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD RepresentativeEmail NVARCHAR(200) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'RepresentativePhone') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD RepresentativePhone NVARCHAR(60) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'SoftwareName') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD SoftwareName NVARCHAR(160) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'SoftwareVersion') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD SoftwareVersion NVARCHAR(80) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'SoftwareProviderRnc') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD SoftwareProviderRnc NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'LogoFileName') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD LogoFileName NVARCHAR(260) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'LogoMimeType') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD LogoMimeType NVARCHAR(80) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'LogoBase64') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD LogoBase64 NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'ApplicationXml') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD ApplicationXml NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'SignedApplicationXml') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD SignedApplicationXml NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'AffidavitXml') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD AffidavitXml NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('fiscal.ElectronicCertificationProfiles', 'SignedAffidavitXml') IS NULL
BEGIN
    ALTER TABLE fiscal.ElectronicCertificationProfiles
        ADD SignedAffidavitXml NVARCHAR(MAX) NULL;
END;
GO
