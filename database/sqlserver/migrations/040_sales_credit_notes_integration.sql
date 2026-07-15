IF COL_LENGTH('ar.CustomerCreditNotes', 'SourceType') IS NULL
BEGIN
    ALTER TABLE ar.CustomerCreditNotes
        ADD SourceType NVARCHAR(40) NULL;
END;
GO

IF COL_LENGTH('ar.CustomerCreditNotes', 'SourceDocumentId') IS NULL
BEGIN
    ALTER TABLE ar.CustomerCreditNotes
        ADD SourceDocumentId UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH('ar.CustomerCreditNotes', 'SourceSalesInvoiceId') IS NULL
BEGIN
    ALTER TABLE ar.CustomerCreditNotes
        ADD SourceSalesInvoiceId UNIQUEIDENTIFIER NULL;
END;
GO

IF COL_LENGTH('ar.CustomerCreditNotes', 'SourceSalesReturnId') IS NULL
BEGIN
    ALTER TABLE ar.CustomerCreditNotes
        ADD SourceSalesReturnId UNIQUEIDENTIFIER NULL;
END;
GO

IF OBJECT_ID('sales.SalesCreditNoteOperations', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesCreditNoteOperations (
        SalesCreditNoteOperationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesCreditNoteOperations_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesReturnId UNIQUEIDENTIFIER NULL,
        SalesInvoiceId UNIQUEIDENTIFIER NULL,
        CustomerCreditNoteId UNIQUEIDENTIFIER NULL,
        AccountsReceivableDocumentId UNIQUEIDENTIFIER NULL,
        OperationType NVARCHAR(20) NOT NULL,
        IdempotencyKey NVARCHAR(120) NOT NULL,
        RequestHash NVARCHAR(128) NOT NULL,
        ResultStatus NVARCHAR(20) NOT NULL,
        ResultAmount DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_sales_SalesCreditNoteOperations_ResultAmount DEFAULT (0),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesCreditNoteOperations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesCreditNoteOperations PRIMARY KEY (SalesCreditNoteOperationId),
        CONSTRAINT FK_sales_SalesCreditNoteOperations_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesCreditNoteOperations_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesCreditNoteOperations_SalesReturns FOREIGN KEY (SalesReturnId) REFERENCES sales.SalesReturns (SalesReturnId),
        CONSTRAINT FK_sales_SalesCreditNoteOperations_SalesInvoices FOREIGN KEY (SalesInvoiceId) REFERENCES sales.SalesInvoices (SalesInvoiceId),
        CONSTRAINT FK_sales_SalesCreditNoteOperations_CreditNotes FOREIGN KEY (CustomerCreditNoteId) REFERENCES ar.CustomerCreditNotes (CustomerCreditNoteId),
        CONSTRAINT FK_sales_SalesCreditNoteOperations_ARDocuments FOREIGN KEY (AccountsReceivableDocumentId) REFERENCES ar.AccountsReceivableDocuments (AccountsReceivableDocumentId),
        CONSTRAINT CK_sales_SalesCreditNoteOperations_Type CHECK (OperationType IN ('CREATE', 'POST')),
        CONSTRAINT CK_sales_SalesCreditNoteOperations_Status CHECK (ResultStatus IN ('DRAFT', 'POSTED'))
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('ar.CustomerCreditNotes')
      AND name = 'FK_ar_CustomerCreditNotes_SourceSalesInvoices'
)
BEGIN
    ALTER TABLE ar.CustomerCreditNotes
        ADD CONSTRAINT FK_ar_CustomerCreditNotes_SourceSalesInvoices
            FOREIGN KEY (SourceSalesInvoiceId) REFERENCES sales.SalesInvoices (SalesInvoiceId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID('ar.CustomerCreditNotes')
      AND name = 'FK_ar_CustomerCreditNotes_SourceSalesReturns'
)
BEGIN
    ALTER TABLE ar.CustomerCreditNotes
        ADD CONSTRAINT FK_ar_CustomerCreditNotes_SourceSalesReturns
            FOREIGN KEY (SourceSalesReturnId) REFERENCES sales.SalesReturns (SalesReturnId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('sales.SalesCreditNoteOperations')
      AND name = 'UX_sales_SalesCreditNoteOperations_Key'
)
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesCreditNoteOperations_Key
        ON sales.SalesCreditNoteOperations (TenantId, CompanyId, OperationType, IdempotencyKey);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('ar.CustomerCreditNotes')
      AND name = 'IX_ar_CustomerCreditNotes_SalesSources'
)
BEGIN
    CREATE INDEX IX_ar_CustomerCreditNotes_SalesSources
        ON ar.CustomerCreditNotes (TenantId, CompanyId, SourceSalesReturnId, SourceSalesInvoiceId, Status)
        INCLUDE (Amount, CustomerId, CreditNoteNumber);
END;
GO

CREATE OR ALTER VIEW sales.V_SalesReturnCreditNotePending
AS
WITH ReturnAmounts AS (
    SELECT
        salesReturn.SalesReturnId,
        salesReturn.TenantId,
        salesReturn.CompanyId,
        salesReturn.ReturnNumber,
        salesReturn.SalesOrderId,
        salesOrder.OrderNumber,
        salesReturn.SalesShipmentId,
        shipment.ShipmentNumber,
        salesReturn.SalesInvoiceId,
        invoice.InvoiceNumber,
        invoice.AccountsReceivableDocumentId,
        arDocument.DocumentNumber AS AccountsReceivableDocumentNumber,
        arDocument.Status AS AccountsReceivableStatus,
        arDocument.RemainingAmount AS AccountsReceivableRemainingAmount,
        salesReturn.CustomerId,
        customer.Code AS CustomerCode,
        customer.Name AS CustomerName,
        salesReturn.Status AS ReturnStatus,
        invoice.Status AS InvoiceStatus,
        CAST(SUM(returnLine.Quantity * (invoiceLine.LineTotal / NULLIF(invoiceLine.Quantity, 0))) AS DECIMAL(18,4)) AS ReturnedAmount,
        CAST(SUM(returnLine.Quantity) AS DECIMAL(18,4)) AS ReturnedQuantity,
        salesReturn.PostedAt,
        salesReturn.IsActive,
        salesReturn.CreatedAt,
        salesReturn.UpdatedAt,
        salesReturn.CreatedBy,
        salesReturn.UpdatedBy
    FROM sales.SalesReturns salesReturn
    INNER JOIN sales.SalesReturnLines returnLine
        ON returnLine.SalesReturnId = salesReturn.SalesReturnId
    INNER JOIN sales.SalesInvoiceLines invoiceLine
        ON invoiceLine.SalesInvoiceLineId = returnLine.SalesInvoiceLineId
    INNER JOIN sales.SalesInvoices invoice
        ON invoice.SalesInvoiceId = invoiceLine.SalesInvoiceId
       AND invoice.SalesInvoiceId = salesReturn.SalesInvoiceId
    INNER JOIN ar.AccountsReceivableDocuments arDocument
        ON arDocument.AccountsReceivableDocumentId = invoice.AccountsReceivableDocumentId
    INNER JOIN sales.SalesOrders salesOrder
        ON salesOrder.SalesOrderId = salesReturn.SalesOrderId
    INNER JOIN sales.SalesShipments shipment
        ON shipment.SalesShipmentId = salesReturn.SalesShipmentId
    INNER JOIN crm.Customers customer
        ON customer.CustomerId = salesReturn.CustomerId
    WHERE salesReturn.Status = 'POSTED'
      AND invoice.Status = 'POSTED'
      AND salesReturn.SalesInvoiceId IS NOT NULL
      AND invoice.AccountsReceivableDocumentId IS NOT NULL
    GROUP BY
        salesReturn.SalesReturnId,
        salesReturn.TenantId,
        salesReturn.CompanyId,
        salesReturn.ReturnNumber,
        salesReturn.SalesOrderId,
        salesOrder.OrderNumber,
        salesReturn.SalesShipmentId,
        shipment.ShipmentNumber,
        salesReturn.SalesInvoiceId,
        invoice.InvoiceNumber,
        invoice.AccountsReceivableDocumentId,
        arDocument.DocumentNumber,
        arDocument.Status,
        arDocument.RemainingAmount,
        salesReturn.CustomerId,
        customer.Code,
        customer.Name,
        salesReturn.Status,
        invoice.Status,
        salesReturn.PostedAt,
        salesReturn.IsActive,
        salesReturn.CreatedAt,
        salesReturn.UpdatedAt,
        salesReturn.CreatedBy,
        salesReturn.UpdatedBy
),
Credits AS (
    SELECT
        SourceSalesReturnId AS SalesReturnId,
        TenantId,
        CompanyId,
        CAST(SUM(CASE WHEN Status <> 'CANCELLED' THEN Amount ELSE 0 END) AS DECIMAL(18,4)) AS ReservedCreditAmount,
        CAST(SUM(CASE WHEN Status = 'POSTED' THEN Amount ELSE 0 END) AS DECIMAL(18,4)) AS PostedCreditAmount,
        COUNT(CASE WHEN Status <> 'CANCELLED' THEN 1 END) AS CreditNoteCount
    FROM ar.CustomerCreditNotes
    WHERE SourceType = 'SALES_RETURN'
      AND SourceSalesReturnId IS NOT NULL
    GROUP BY SourceSalesReturnId, TenantId, CompanyId
)
SELECT
    amount.SalesReturnId AS SalesReturnCreditNotePendingId,
    amount.TenantId,
    amount.CompanyId,
    amount.SalesReturnId,
    amount.ReturnNumber,
    amount.SalesOrderId,
    amount.OrderNumber,
    amount.SalesShipmentId,
    amount.ShipmentNumber,
    amount.SalesInvoiceId,
    amount.InvoiceNumber,
    amount.AccountsReceivableDocumentId,
    amount.AccountsReceivableDocumentNumber,
    amount.AccountsReceivableStatus,
    amount.AccountsReceivableRemainingAmount,
    amount.CustomerId,
    amount.CustomerCode,
    amount.CustomerName,
    amount.ReturnStatus,
    amount.InvoiceStatus,
    amount.ReturnedQuantity,
    amount.ReturnedAmount,
    CAST(COALESCE(credit.ReservedCreditAmount, 0) AS DECIMAL(18,4)) AS ReservedCreditAmount,
    CAST(COALESCE(credit.PostedCreditAmount, 0) AS DECIMAL(18,4)) AS PostedCreditAmount,
    CAST(amount.ReturnedAmount - COALESCE(credit.ReservedCreditAmount, 0) AS DECIMAL(18,4)) AS PendingCreditAmount,
    COALESCE(credit.CreditNoteCount, 0) AS CreditNoteCount,
    amount.IsActive,
    amount.CreatedAt,
    amount.UpdatedAt,
    amount.CreatedBy,
    amount.UpdatedBy
FROM ReturnAmounts amount
LEFT JOIN Credits credit
    ON credit.SalesReturnId = amount.SalesReturnId
   AND credit.TenantId = amount.TenantId
   AND credit.CompanyId = amount.CompanyId;
GO

CREATE OR ALTER VIEW sales.V_SalesCreditNoteIntegrationSummary
AS
SELECT
    note.CustomerCreditNoteId AS SalesCreditNoteIntegrationId,
    note.TenantId,
    note.CompanyId,
    note.CustomerCreditNoteId,
    note.CreditNoteNumber,
    note.SourceSalesReturnId AS SalesReturnId,
    salesReturn.ReturnNumber,
    note.SourceSalesInvoiceId AS SalesInvoiceId,
    invoice.InvoiceNumber,
    invoice.AccountsReceivableDocumentId,
    arDocument.DocumentNumber AS AccountsReceivableDocumentNumber,
    arDocument.Status AS AccountsReceivableStatus,
    arDocument.TotalAmount AS AccountsReceivableTotalAmount,
    arDocument.PaidAmount AS AccountsReceivablePaidAmount,
    arDocument.RemainingAmount AS AccountsReceivableRemainingAmount,
    note.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    note.CreditNoteDate,
    note.Status,
    note.Amount,
    COALESCE(applications.AppliedAmount, 0) AS AppliedAmount,
    note.Amount - COALESCE(applications.AppliedAmount, 0) AS UnappliedAmount,
    note.Reference,
    note.Notes,
    note.PostedAt,
    note.IsActive,
    note.CreatedAt,
    note.UpdatedAt,
    note.CreatedBy,
    note.UpdatedBy
FROM ar.CustomerCreditNotes note
INNER JOIN sales.SalesReturns salesReturn
    ON salesReturn.SalesReturnId = note.SourceSalesReturnId
INNER JOIN sales.SalesInvoices invoice
    ON invoice.SalesInvoiceId = note.SourceSalesInvoiceId
INNER JOIN ar.AccountsReceivableDocuments arDocument
    ON arDocument.AccountsReceivableDocumentId = invoice.AccountsReceivableDocumentId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = note.CustomerId
LEFT JOIN (
    SELECT CustomerCreditNoteId, SUM(AppliedAmount) AS AppliedAmount
    FROM ar.CustomerCreditNoteApplications
    GROUP BY CustomerCreditNoteId
) applications
    ON applications.CustomerCreditNoteId = note.CustomerCreditNoteId
WHERE note.SourceType = 'SALES_RETURN'
  AND note.SourceSalesReturnId IS NOT NULL
  AND note.SourceSalesInvoiceId IS NOT NULL;
GO
