IF SCHEMA_ID('ar') IS NULL
BEGIN
    EXEC('CREATE SCHEMA ar');
END;
GO

IF OBJECT_ID('ar.AccountsReceivableDocuments', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE object_id = OBJECT_ID('ar.AccountsReceivableDocuments')
         AND name = 'IX_ar_AccountsReceivableDocuments_Aging'
   )
BEGIN
    CREATE INDEX IX_ar_AccountsReceivableDocuments_Aging
        ON ar.AccountsReceivableDocuments (TenantId, CompanyId, CustomerId, Status, DocumentDate, DueDate)
        INCLUDE (DocumentNumber, SourceType, SourceDocumentNumber, CurrencyCode, TotalAmount, PaidAmount, Reference, IsActive, CreatedAt);
END;
GO

CREATE OR ALTER VIEW ar.V_CustomerStatementDetail
AS
SELECT
    document.AccountsReceivableDocumentId,
    document.TenantId,
    document.CompanyId,
    document.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    document.DocumentNumber,
    document.SourceDocumentNumber,
    document.SourceType,
    document.DocumentDate,
    document.DueDate,
    document.CurrencyCode,
    document.Status,
    document.TotalAmount,
    document.PaidAmount,
    document.RemainingAmount,
    CASE
        WHEN CAST(document.DueDate AS date) >= CAST(SYSUTCDATETIME() AS date) THEN 0
        ELSE DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date))
    END AS DaysPastDue,
    CASE
        WHEN CAST(document.DueDate AS date) >= CAST(SYSUTCDATETIME() AS date) THEN 'CURRENT'
        WHEN DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date)) BETWEEN 1 AND 30 THEN '1-30'
        WHEN DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date)) BETWEEN 31 AND 60 THEN '31-60'
        WHEN DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date)) BETWEEN 61 AND 90 THEN '61-90'
        ELSE '90+'
    END AS AgingBucket,
    document.Reference,
    document.IsActive,
    document.CreatedAt,
    document.UpdatedAt,
    document.CreatedBy,
    document.UpdatedBy
FROM ar.AccountsReceivableDocuments document
INNER JOIN crm.Customers customer
    ON customer.CustomerId = document.CustomerId
WHERE document.IsActive = 1;
GO

CREATE OR ALTER VIEW ar.V_CustomerAgingSummary
AS
WITH open_documents AS (
    SELECT
        document.TenantId,
        document.CompanyId,
        document.CustomerId,
        customer.Code AS CustomerCode,
        customer.Name AS CustomerName,
        document.AccountsReceivableDocumentId,
        document.RemainingAmount,
        CASE
            WHEN CAST(document.DueDate AS date) >= CAST(SYSUTCDATETIME() AS date) THEN 'CURRENT'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date)) BETWEEN 1 AND 30 THEN '1-30'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date)) BETWEEN 31 AND 60 THEN '31-60'
            WHEN DATEDIFF(day, CAST(document.DueDate AS date), CAST(SYSUTCDATETIME() AS date)) BETWEEN 61 AND 90 THEN '61-90'
            ELSE '90+'
        END AS AgingBucket
    FROM ar.AccountsReceivableDocuments document
    INNER JOIN crm.Customers customer
        ON customer.CustomerId = document.CustomerId
    WHERE document.IsActive = 1
      AND document.Status IN ('OPEN', 'PARTIALLY_PAID')
      AND document.RemainingAmount > 0
)
SELECT
    TenantId,
    CompanyId,
    CustomerId,
    CustomerCode,
    CustomerName,
    SUM(CASE WHEN AgingBucket = 'CURRENT' THEN RemainingAmount ELSE 0 END) AS CurrentAmount,
    SUM(CASE WHEN AgingBucket = '1-30' THEN RemainingAmount ELSE 0 END) AS Days1To30Amount,
    SUM(CASE WHEN AgingBucket = '31-60' THEN RemainingAmount ELSE 0 END) AS Days31To60Amount,
    SUM(CASE WHEN AgingBucket = '61-90' THEN RemainingAmount ELSE 0 END) AS Days61To90Amount,
    SUM(CASE WHEN AgingBucket = '90+' THEN RemainingAmount ELSE 0 END) AS DaysOver90Amount,
    SUM(RemainingAmount) AS TotalOpenAmount,
    SUM(CASE WHEN AgingBucket <> 'CURRENT' THEN RemainingAmount ELSE 0 END) AS OverdueAmount,
    SUM(CASE WHEN AgingBucket = 'CURRENT' THEN RemainingAmount ELSE 0 END) AS NotDueAmount,
    COUNT(1) AS OpenDocumentCount,
    SUM(CASE WHEN AgingBucket <> 'CURRENT' THEN 1 ELSE 0 END) AS OverdueDocumentCount,
    MIN(CustomerCode) AS Code,
    CustomerName AS Name,
    CAST(1 AS bit) AS IsActive,
    SYSUTCDATETIME() AS CreatedAt,
    CAST(NULL AS datetime2(7)) AS UpdatedAt,
    CAST(NULL AS uniqueidentifier) AS CreatedBy,
    CAST(NULL AS uniqueidentifier) AS UpdatedBy
FROM open_documents
GROUP BY TenantId, CompanyId, CustomerId, CustomerCode, CustomerName;
GO

CREATE OR ALTER VIEW ar.V_CustomerBalanceSummary
AS
SELECT
    document.TenantId,
    document.CompanyId,
    document.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    SUM(document.TotalAmount) AS TotalDocumentAmount,
    SUM(document.PaidAmount) AS TotalPaidAmount,
    SUM(document.RemainingAmount) AS TotalRemainingAmount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 THEN document.RemainingAmount ELSE 0 END) AS TotalOpenAmount,
    SUM(CASE WHEN document.Status = 'PAID' THEN document.TotalAmount ELSE 0 END) AS TotalPaidDocumentAmount,
    COUNT(1) AS DocumentCount,
    SUM(CASE WHEN document.Status IN ('OPEN', 'PARTIALLY_PAID') AND document.RemainingAmount > 0 THEN 1 ELSE 0 END) AS OpenDocumentCount,
    SUM(CASE WHEN document.Status = 'PAID' THEN 1 ELSE 0 END) AS PaidDocumentCount,
    MIN(customer.Code) AS Code,
    customer.Name AS Name,
    CAST(1 AS bit) AS IsActive,
    MIN(document.CreatedAt) AS CreatedAt,
    MAX(document.UpdatedAt) AS UpdatedAt,
    CAST(NULL AS uniqueidentifier) AS CreatedBy,
    CAST(NULL AS uniqueidentifier) AS UpdatedBy
FROM ar.AccountsReceivableDocuments document
INNER JOIN crm.Customers customer
    ON customer.CustomerId = document.CustomerId
WHERE document.IsActive = 1
GROUP BY document.TenantId, document.CompanyId, document.CustomerId, customer.Code, customer.Name;
GO
