IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'ap')
BEGIN
    EXEC('CREATE SCHEMA ap');
END;
GO

IF OBJECT_ID('purchasing.SupplierInvoices', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.SupplierInvoices (
        SupplierInvoiceId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_SupplierInvoiceId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SupplierInvoiceNumber NVARCHAR(40) NOT NULL,
        SupplierId UNIQUEIDENTIFIER NOT NULL,
        PurchaseReceiptId UNIQUEIDENTIFIER NOT NULL,
        InvoiceDate DATETIME2(7) NOT NULL,
        DueDate DATETIME2(7) NOT NULL,
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_Status DEFAULT 'DRAFT',
        SubTotal DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_SubTotal DEFAULT (0),
        TaxAmount DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_TaxAmount DEFAULT (0),
        TotalAmount DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_TotalAmount DEFAULT (0),
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoices_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_SupplierInvoices PRIMARY KEY (SupplierInvoiceId),
        CONSTRAINT FK_purchasing_SupplierInvoices_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_SupplierInvoices_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_SupplierInvoices_Suppliers FOREIGN KEY (SupplierId)
            REFERENCES purchasing.Suppliers (SupplierId),
        CONSTRAINT FK_purchasing_SupplierInvoices_PurchaseReceipts FOREIGN KEY (PurchaseReceiptId)
            REFERENCES purchasing.PurchaseReceipts (PurchaseReceiptId),
        CONSTRAINT CK_purchasing_SupplierInvoices_Status CHECK (
            Status IN ('DRAFT', 'POSTED')
        )
    );
END;
GO

IF OBJECT_ID('purchasing.SupplierInvoiceLines', 'U') IS NULL
BEGIN
    CREATE TABLE purchasing.SupplierInvoiceLines (
        SupplierInvoiceLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoiceLines_SupplierInvoiceLineId DEFAULT NEWSEQUENTIALID(),
        SupplierInvoiceId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NULL,
        Quantity DECIMAL(18,6) NOT NULL,
        UnitCost DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoiceLines_UnitCost DEFAULT (0),
        TaxAmount DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoiceLines_TaxAmount DEFAULT (0),
        LineTotal AS (Quantity * UnitCost + TaxAmount) PERSISTED,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_purchasing_SupplierInvoiceLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_purchasing_SupplierInvoiceLines PRIMARY KEY (SupplierInvoiceLineId),
        CONSTRAINT FK_purchasing_SupplierInvoiceLines_SupplierInvoices FOREIGN KEY (SupplierInvoiceId)
            REFERENCES purchasing.SupplierInvoices (SupplierInvoiceId),
        CONSTRAINT FK_purchasing_SupplierInvoiceLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_purchasing_SupplierInvoiceLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_purchasing_SupplierInvoiceLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_purchasing_SupplierInvoiceLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_purchasing_SupplierInvoiceLines_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_purchasing_SupplierInvoiceLines_UnitCost CHECK (UnitCost >= 0)
    );
END;
GO

IF OBJECT_ID('ap.AccountsPayableDocuments', 'U') IS NULL
BEGIN
    CREATE TABLE ap.AccountsPayableDocuments (
        AccountsPayableDocumentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_ap_AccountsPayableDocuments_AccountsPayableDocumentId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        DocumentNumber NVARCHAR(40) NOT NULL,
        SupplierId UNIQUEIDENTIFIER NOT NULL,
        SourceModule NVARCHAR(40) NOT NULL,
        SourceDocumentId UNIQUEIDENTIFIER NOT NULL,
        SourceDocumentNumber NVARCHAR(80) NOT NULL,
        DocumentDate DATETIME2(7) NOT NULL,
        DueDate DATETIME2(7) NOT NULL,
        TotalAmount DECIMAL(18,6) NOT NULL,
        PaidAmount DECIMAL(18,6) NOT NULL
            CONSTRAINT DF_ap_AccountsPayableDocuments_PaidAmount DEFAULT (0),
        RemainingAmount AS (TotalAmount - PaidAmount) PERSISTED,
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_ap_AccountsPayableDocuments_Status DEFAULT 'PENDING',
        Notes NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_ap_AccountsPayableDocuments_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_ap_AccountsPayableDocuments_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_ap_AccountsPayableDocuments PRIMARY KEY (AccountsPayableDocumentId),
        CONSTRAINT FK_ap_AccountsPayableDocuments_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_ap_AccountsPayableDocuments_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_ap_AccountsPayableDocuments_Suppliers FOREIGN KEY (SupplierId)
            REFERENCES purchasing.Suppliers (SupplierId),
        CONSTRAINT CK_ap_AccountsPayableDocuments_Status CHECK (
            Status IN ('PENDING', 'PARTIALLY_PAID', 'PAID', 'VOIDED')
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.SupplierInvoices')
      AND name = 'UX_purchasing_SupplierInvoices_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_SupplierInvoices_Tenant_Company_Number
        ON purchasing.SupplierInvoices (TenantId, CompanyId, SupplierInvoiceNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.SupplierInvoices')
      AND name = 'IX_purchasing_SupplierInvoices_Tenant_Company_Receipt'
)
BEGIN
    CREATE INDEX IX_purchasing_SupplierInvoices_Tenant_Company_Receipt
        ON purchasing.SupplierInvoices (TenantId, CompanyId, PurchaseReceiptId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('purchasing.SupplierInvoiceLines')
      AND name = 'UX_purchasing_SupplierInvoiceLines_Invoice_Line'
)
BEGIN
    CREATE UNIQUE INDEX UX_purchasing_SupplierInvoiceLines_Invoice_Line
        ON purchasing.SupplierInvoiceLines (SupplierInvoiceId, LineNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.AccountsPayableDocuments')
      AND name = 'UX_ap_AccountsPayableDocuments_Tenant_Company_Number'
)
BEGIN
    CREATE UNIQUE INDEX UX_ap_AccountsPayableDocuments_Tenant_Company_Number
        ON ap.AccountsPayableDocuments (TenantId, CompanyId, DocumentNumber);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ap.AccountsPayableDocuments')
      AND name = 'IX_ap_AccountsPayableDocuments_SourceDocument'
)
BEGIN
    CREATE INDEX IX_ap_AccountsPayableDocuments_SourceDocument
        ON ap.AccountsPayableDocuments (TenantId, CompanyId, SourceDocumentId);
END;
GO

CREATE OR ALTER VIEW purchasing.V_SupplierInvoiceSummary
AS
SELECT
    inv.SupplierInvoiceId,
    inv.TenantId,
    inv.CompanyId,
    inv.SupplierInvoiceNumber,
    inv.SupplierId,
    s.Code AS SupplierCode,
    s.Name AS SupplierName,
    inv.PurchaseReceiptId,
    pr.PurchaseReceiptNumber,
    inv.InvoiceDate,
    inv.DueDate,
    inv.Status,
    inv.SubTotal,
    inv.TaxAmount,
    inv.TotalAmount,
    inv.Reference,
    inv.Notes,
    inv.PostedAt,
    inv.PostedBy,
    inv.IsActive,
    inv.CreatedAt,
    inv.UpdatedAt,
    inv.CreatedBy,
    inv.UpdatedBy,
    COUNT(line.SupplierInvoiceLineId) AS LineCount
FROM purchasing.SupplierInvoices inv
INNER JOIN purchasing.Suppliers s
    ON inv.SupplierId = s.SupplierId
INNER JOIN purchasing.PurchaseReceipts pr
    ON inv.PurchaseReceiptId = pr.PurchaseReceiptId
LEFT JOIN purchasing.SupplierInvoiceLines line
    ON line.SupplierInvoiceId = inv.SupplierInvoiceId
GROUP BY
    inv.SupplierInvoiceId,
    inv.TenantId,
    inv.CompanyId,
    inv.SupplierInvoiceNumber,
    inv.SupplierId,
    s.Code,
    s.Name,
    inv.PurchaseReceiptId,
    pr.PurchaseReceiptNumber,
    inv.InvoiceDate,
    inv.DueDate,
    inv.Status,
    inv.SubTotal,
    inv.TaxAmount,
    inv.TotalAmount,
    inv.Reference,
    inv.Notes,
    inv.PostedAt,
    inv.PostedBy,
    inv.IsActive,
    inv.CreatedAt,
    inv.UpdatedAt,
    inv.CreatedBy,
    inv.UpdatedBy;
GO

CREATE OR ALTER VIEW purchasing.V_SupplierInvoiceLineSummary
AS
SELECT
    line.SupplierInvoiceLineId,
    line.SupplierInvoiceId,
    inv.SupplierInvoiceNumber,
    line.TenantId,
    line.CompanyId,
    inv.SupplierId,
    s.Code AS SupplierCode,
    s.Name AS SupplierName,
    inv.Status,
    inv.InvoiceDate,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
    line.Quantity,
    line.UnitCost,
    line.TaxAmount,
    line.LineTotal,
    line.Notes,
    inv.IsActive,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM purchasing.SupplierInvoiceLines line
INNER JOIN purchasing.SupplierInvoices inv
    ON inv.SupplierInvoiceId = line.SupplierInvoiceId
INNER JOIN purchasing.Suppliers s
    ON s.SupplierId = inv.SupplierId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
LEFT JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO

CREATE OR ALTER VIEW ap.V_AccountsPayableDocumentSummary
AS
SELECT
    ap.AccountsPayableDocumentId,
    ap.TenantId,
    ap.CompanyId,
    ap.DocumentNumber,
    ap.SupplierId,
    s.Code AS SupplierCode,
    s.Name AS SupplierName,
    ap.SourceModule,
    ap.SourceDocumentId,
    ap.SourceDocumentNumber,
    ap.DocumentDate,
    ap.DueDate,
    ap.TotalAmount,
    ap.PaidAmount,
    ap.RemainingAmount,
    ap.Status,
    ap.Notes,
    ap.IsActive,
    ap.CreatedAt,
    ap.UpdatedAt,
    ap.CreatedBy,
    ap.UpdatedBy
FROM ap.AccountsPayableDocuments ap
INNER JOIN purchasing.Suppliers s
    ON ap.SupplierId = s.SupplierId;
GO
