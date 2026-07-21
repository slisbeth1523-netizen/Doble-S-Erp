IF OBJECT_ID('accounting.PostingRules', 'U') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('accounting.PostingRules')
         AND name = 'CK_accounting_PostingRules_SourceDocumentType'
   )
BEGIN
    ALTER TABLE accounting.PostingRules
        DROP CONSTRAINT CK_accounting_PostingRules_SourceDocumentType;
END;
GO

IF OBJECT_ID('accounting.PostingRules', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('accounting.PostingRules')
         AND name = 'CK_accounting_PostingRules_SourceDocumentType'
   )
BEGIN
    ALTER TABLE accounting.PostingRules
        ADD CONSTRAINT CK_accounting_PostingRules_SourceDocumentType CHECK (
            SourceDocumentType IN (
                N'AR_DOCUMENT',
                N'AP_DOCUMENT',
                N'SALES_INVOICE',
                N'SUPPLIER_INVOICE',
                N'CUSTOMER_CREDIT_NOTE',
                N'CUSTOMER_DEBIT_NOTE'
            )
        );
END;
GO
