IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NOT NULL
   AND EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('inventory.InventoryMovements')
         AND name = 'CK_inventory_InventoryMovements_MovementType'
   )
BEGIN
    ALTER TABLE inventory.InventoryMovements
        DROP CONSTRAINT CK_inventory_InventoryMovements_MovementType;
END;
GO

IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('inventory.InventoryMovements')
         AND name = 'CK_inventory_InventoryMovements_MovementType'
   )
BEGIN
    ALTER TABLE inventory.InventoryMovements
        ADD CONSTRAINT CK_inventory_InventoryMovements_MovementType CHECK (
            MovementType IN (
                'OPENING',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
                'TRANSFER',
                'PURCHASE_RECEIPT_PLACEHOLDER',
                'SALES_ISSUE_PLACEHOLDER',
                'SALES_SHIPMENT',
                'SALES_RETURN',
                'RETURN_IN_PLACEHOLDER',
                'RETURN_OUT_PLACEHOLDER'
            )
        );
END;
GO

IF OBJECT_ID('inventory.InventoryLedgerEntries', 'U') IS NOT NULL
   AND EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
         AND name = 'CK_inventory_InventoryLedgerEntries_MovementType'
   )
BEGIN
    ALTER TABLE inventory.InventoryLedgerEntries
        DROP CONSTRAINT CK_inventory_InventoryLedgerEntries_MovementType;
END;
GO

IF OBJECT_ID('inventory.InventoryLedgerEntries', 'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM sys.check_constraints
       WHERE parent_object_id = OBJECT_ID('inventory.InventoryLedgerEntries')
         AND name = 'CK_inventory_InventoryLedgerEntries_MovementType'
   )
BEGIN
    ALTER TABLE inventory.InventoryLedgerEntries
        ADD CONSTRAINT CK_inventory_InventoryLedgerEntries_MovementType CHECK (
            MovementType IN (
                'OPENING',
                'ADJUSTMENT_IN',
                'ADJUSTMENT_OUT',
                'TRANSFER',
                'PURCHASE_RECEIPT_PLACEHOLDER',
                'SALES_SHIPMENT',
                'SALES_RETURN'
            )
        );
END;
GO

IF OBJECT_ID('sales.SalesReturns', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesReturns (
        SalesReturnId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesReturns_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        ReturnNumber NVARCHAR(40) NOT NULL,
        SalesOrderId UNIQUEIDENTIFIER NOT NULL,
        SalesShipmentId UNIQUEIDENTIFIER NOT NULL,
        SalesInvoiceId UNIQUEIDENTIFIER NULL,
        CustomerId UNIQUEIDENTIFIER NOT NULL,
        ReturnDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesReturns_ReturnDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_sales_SalesReturns_Status DEFAULT 'DRAFT',
        WarehouseId UNIQUEIDENTIFIER NULL,
        Reason NVARCHAR(500) NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        InventoryMovementId UNIQUEIDENTIFIER NULL,
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_sales_SalesReturns_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesReturns_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesReturns PRIMARY KEY (SalesReturnId),
        CONSTRAINT FK_sales_SalesReturns_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesReturns_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesReturns_SalesOrders FOREIGN KEY (SalesOrderId) REFERENCES sales.SalesOrders (SalesOrderId),
        CONSTRAINT FK_sales_SalesReturns_SalesShipments FOREIGN KEY (SalesShipmentId) REFERENCES sales.SalesShipments (SalesShipmentId),
        CONSTRAINT FK_sales_SalesReturns_SalesInvoices FOREIGN KEY (SalesInvoiceId) REFERENCES sales.SalesInvoices (SalesInvoiceId),
        CONSTRAINT FK_sales_SalesReturns_Customers FOREIGN KEY (CustomerId) REFERENCES crm.Customers (CustomerId),
        CONSTRAINT FK_sales_SalesReturns_Warehouses FOREIGN KEY (WarehouseId) REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_sales_SalesReturns_InventoryMovements FOREIGN KEY (InventoryMovementId) REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT CK_sales_SalesReturns_Status CHECK (Status IN ('DRAFT', 'POSTED', 'CANCELLED'))
    );
END;
GO

IF OBJECT_ID('sales.SalesReturnLines', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesReturnLines (
        SalesReturnLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesReturnLines_Id DEFAULT NEWSEQUENTIALID(),
        SalesReturnId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesOrderLineId UNIQUEIDENTIFIER NOT NULL,
        SalesShipmentLineId UNIQUEIDENTIFIER NOT NULL,
        SalesInvoiceLineId UNIQUEIDENTIFIER NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NOT NULL,
        Quantity DECIMAL(18,4) NOT NULL,
        Reason NVARCHAR(500) NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesReturnLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesReturnLines PRIMARY KEY (SalesReturnLineId),
        CONSTRAINT FK_sales_SalesReturnLines_SalesReturns FOREIGN KEY (SalesReturnId) REFERENCES sales.SalesReturns (SalesReturnId),
        CONSTRAINT FK_sales_SalesReturnLines_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesReturnLines_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesReturnLines_SalesOrderLines FOREIGN KEY (SalesOrderLineId) REFERENCES sales.SalesOrderLines (SalesOrderLineId),
        CONSTRAINT FK_sales_SalesReturnLines_SalesShipmentLines FOREIGN KEY (SalesShipmentLineId) REFERENCES sales.SalesShipmentLines (SalesShipmentLineId),
        CONSTRAINT FK_sales_SalesReturnLines_SalesInvoiceLines FOREIGN KEY (SalesInvoiceLineId) REFERENCES sales.SalesInvoiceLines (SalesInvoiceLineId),
        CONSTRAINT FK_sales_SalesReturnLines_Items FOREIGN KEY (ItemId) REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_sales_SalesReturnLines_Warehouses FOREIGN KEY (WarehouseId) REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_sales_SalesReturnLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId) REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_sales_SalesReturnLines_Quantity CHECK (Quantity > 0)
    );
END;
GO

IF OBJECT_ID('sales.SalesReturnOperations', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesReturnOperations (
        SalesReturnOperationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesReturnOperations_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesReturnId UNIQUEIDENTIFIER NOT NULL,
        OperationType NVARCHAR(20) NOT NULL,
        IdempotencyKey NVARCHAR(120) NOT NULL,
        RequestHash NVARCHAR(128) NOT NULL,
        ResultStatus NVARCHAR(20) NOT NULL,
        InventoryMovementId UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesReturnOperations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesReturnOperations PRIMARY KEY (SalesReturnOperationId),
        CONSTRAINT FK_sales_SalesReturnOperations_Tenants FOREIGN KEY (TenantId) REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesReturnOperations_Companies FOREIGN KEY (CompanyId) REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesReturnOperations_SalesReturns FOREIGN KEY (SalesReturnId) REFERENCES sales.SalesReturns (SalesReturnId),
        CONSTRAINT FK_sales_SalesReturnOperations_InventoryMovements FOREIGN KEY (InventoryMovementId) REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT CK_sales_SalesReturnOperations_Type CHECK (OperationType IN ('POST')),
        CONSTRAINT CK_sales_SalesReturnOperations_Status CHECK (ResultStatus IN ('POSTED'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesReturns') AND name = 'UX_sales_SalesReturns_Number')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesReturns_Number ON sales.SalesReturns (TenantId, CompanyId, ReturnNumber);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesReturnLines') AND name = 'UX_sales_SalesReturnLines_Return_Line')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesReturnLines_Return_Line ON sales.SalesReturnLines (SalesReturnId, LineNumber);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesReturnOperations') AND name = 'UX_sales_SalesReturnOperations_Key')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesReturnOperations_Key ON sales.SalesReturnOperations (TenantId, CompanyId, OperationType, IdempotencyKey);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesReturns') AND name = 'IX_sales_SalesReturns_Filters')
BEGIN
    CREATE INDEX IX_sales_SalesReturns_Filters ON sales.SalesReturns (TenantId, CompanyId, CustomerId, SalesOrderId, SalesShipmentId, SalesInvoiceId, Status, ReturnDate);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesReturnLines') AND name = 'IX_sales_SalesReturnLines_ShipmentLine')
BEGIN
    CREATE INDEX IX_sales_SalesReturnLines_ShipmentLine ON sales.SalesReturnLines (TenantId, CompanyId, SalesShipmentLineId);
END;
GO

CREATE OR ALTER VIEW sales.V_SalesReturnSummary
AS
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
    salesReturn.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    salesReturn.ReturnDate,
    salesReturn.Status,
    salesReturn.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    salesReturn.Reason,
    salesReturn.Reference,
    salesReturn.Notes,
    salesReturn.InventoryMovementId,
    movement.MovementNumber,
    salesReturn.PostedAt,
    salesReturn.PostedBy,
    COUNT(line.SalesReturnLineId) AS LineCount,
    CAST(COALESCE(SUM(line.Quantity), 0) AS DECIMAL(18,4)) AS TotalQuantity,
    salesReturn.IsActive,
    salesReturn.CreatedAt,
    salesReturn.UpdatedAt,
    salesReturn.CreatedBy,
    salesReturn.UpdatedBy
FROM sales.SalesReturns salesReturn
INNER JOIN sales.SalesOrders salesOrder ON salesOrder.SalesOrderId = salesReturn.SalesOrderId
INNER JOIN sales.SalesShipments shipment ON shipment.SalesShipmentId = salesReturn.SalesShipmentId
LEFT JOIN sales.SalesInvoices invoice ON invoice.SalesInvoiceId = salesReturn.SalesInvoiceId
INNER JOIN crm.Customers customer ON customer.CustomerId = salesReturn.CustomerId
LEFT JOIN inventory.Warehouses warehouse ON warehouse.WarehouseId = salesReturn.WarehouseId
LEFT JOIN inventory.InventoryMovements movement ON movement.InventoryMovementId = salesReturn.InventoryMovementId
LEFT JOIN sales.SalesReturnLines line ON line.SalesReturnId = salesReturn.SalesReturnId
GROUP BY
    salesReturn.SalesReturnId, salesReturn.TenantId, salesReturn.CompanyId, salesReturn.ReturnNumber,
    salesReturn.SalesOrderId, salesOrder.OrderNumber, salesReturn.SalesShipmentId, shipment.ShipmentNumber,
    salesReturn.SalesInvoiceId, invoice.InvoiceNumber, salesReturn.CustomerId, customer.Code, customer.Name,
    salesReturn.ReturnDate, salesReturn.Status, salesReturn.WarehouseId, warehouse.Code, warehouse.Name,
    salesReturn.Reason, salesReturn.Reference, salesReturn.Notes, salesReturn.InventoryMovementId,
    movement.MovementNumber, salesReturn.PostedAt, salesReturn.PostedBy, salesReturn.IsActive,
    salesReturn.CreatedAt, salesReturn.UpdatedAt, salesReturn.CreatedBy, salesReturn.UpdatedBy;
GO

CREATE OR ALTER VIEW sales.V_SalesReturnLineSummary
AS
SELECT
    line.SalesReturnLineId,
    line.SalesReturnId,
    line.TenantId,
    line.CompanyId,
    salesReturn.ReturnNumber,
    salesReturn.Status AS ReturnStatus,
    salesReturn.SalesOrderId,
    salesOrder.OrderNumber,
    salesReturn.SalesShipmentId,
    shipment.ShipmentNumber,
    line.SalesShipmentLineId,
    line.SalesInvoiceLineId,
    invoiceLine.SalesInvoiceId,
    invoice.InvoiceNumber,
    line.SalesOrderLineId,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    line.Quantity,
    line.Reason,
    line.Notes,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy,
    CAST(1 AS BIT) AS IsActive
FROM sales.SalesReturnLines line
INNER JOIN sales.SalesReturns salesReturn ON salesReturn.SalesReturnId = line.SalesReturnId
INNER JOIN sales.SalesOrders salesOrder ON salesOrder.SalesOrderId = salesReturn.SalesOrderId
INNER JOIN sales.SalesShipments shipment ON shipment.SalesShipmentId = salesReturn.SalesShipmentId
LEFT JOIN sales.SalesInvoiceLines invoiceLine ON invoiceLine.SalesInvoiceLineId = line.SalesInvoiceLineId
LEFT JOIN sales.SalesInvoices invoice ON invoice.SalesInvoiceId = invoiceLine.SalesInvoiceId
INNER JOIN inventory.Items item ON item.ItemId = line.ItemId
INNER JOIN inventory.Warehouses warehouse ON warehouse.WarehouseId = line.WarehouseId
INNER JOIN core.UnitsOfMeasure unit ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO

CREATE OR ALTER VIEW sales.V_SalesShipmentReturnSummary
AS
WITH PostedReturns AS (
    SELECT
        returnLine.TenantId,
        returnLine.CompanyId,
        returnLine.SalesShipmentLineId,
        SUM(returnLine.Quantity) AS PreviouslyReturnedQuantity
    FROM sales.SalesReturnLines returnLine
    INNER JOIN sales.SalesReturns salesReturn
        ON salesReturn.SalesReturnId = returnLine.SalesReturnId
    WHERE salesReturn.Status = 'POSTED'
    GROUP BY returnLine.TenantId, returnLine.CompanyId, returnLine.SalesShipmentLineId
),
PostedInvoiceLines AS (
    SELECT
        invoiceLine.TenantId,
        invoiceLine.CompanyId,
        invoiceLine.SalesShipmentLineId,
        MAX(invoiceLine.SalesInvoiceLineId) AS SalesInvoiceLineId,
        MAX(invoice.SalesInvoiceId) AS SalesInvoiceId,
        MAX(invoice.InvoiceNumber) AS InvoiceNumber
    FROM sales.SalesInvoiceLines invoiceLine
    INNER JOIN sales.SalesInvoices invoice
        ON invoice.SalesInvoiceId = invoiceLine.SalesInvoiceId
    WHERE invoice.Status = 'POSTED'
    GROUP BY invoiceLine.TenantId, invoiceLine.CompanyId, invoiceLine.SalesShipmentLineId
)
SELECT
    shipmentLine.SalesShipmentLineId AS SalesShipmentReturnId,
    shipmentLine.TenantId,
    shipmentLine.CompanyId,
    shipment.SalesShipmentId,
    shipment.ShipmentNumber,
    shipment.Status AS ShipmentStatus,
    salesOrder.SalesOrderId,
    salesOrder.OrderNumber,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    invoiceLine.SalesInvoiceId,
    invoiceLine.InvoiceNumber,
    shipmentLine.SalesOrderLineId,
    shipmentLine.SalesShipmentLineId,
    invoiceLine.SalesInvoiceLineId,
    shipmentLine.LineNumber,
    shipmentLine.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    shipmentLine.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    shipmentLine.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    CAST(shipmentLine.Quantity AS DECIMAL(18,4)) AS ShippedQuantity,
    CAST(COALESCE(posted.PreviouslyReturnedQuantity, 0) AS DECIMAL(18,4)) AS PreviouslyReturnedQuantity,
    CAST(shipmentLine.Quantity - COALESCE(posted.PreviouslyReturnedQuantity, 0) AS DECIMAL(18,4)) AS ReturnableQuantity,
    shipment.IsActive,
    shipmentLine.CreatedAt,
    shipmentLine.UpdatedAt,
    shipmentLine.CreatedBy,
    shipmentLine.UpdatedBy
FROM sales.SalesShipmentLines shipmentLine
INNER JOIN sales.SalesShipments shipment ON shipment.SalesShipmentId = shipmentLine.SalesShipmentId
INNER JOIN sales.SalesOrders salesOrder ON salesOrder.SalesOrderId = shipment.SalesOrderId
INNER JOIN crm.Customers customer ON customer.CustomerId = salesOrder.CustomerId
INNER JOIN inventory.Items item ON item.ItemId = shipmentLine.ItemId
INNER JOIN inventory.Warehouses warehouse ON warehouse.WarehouseId = shipmentLine.WarehouseId
INNER JOIN core.UnitsOfMeasure unit ON unit.UnitOfMeasureId = shipmentLine.UnitOfMeasureId
LEFT JOIN PostedReturns posted
    ON posted.TenantId = shipmentLine.TenantId
   AND posted.CompanyId = shipmentLine.CompanyId
   AND posted.SalesShipmentLineId = shipmentLine.SalesShipmentLineId
LEFT JOIN PostedInvoiceLines invoiceLine
    ON invoiceLine.TenantId = shipmentLine.TenantId
   AND invoiceLine.CompanyId = shipmentLine.CompanyId
   AND invoiceLine.SalesShipmentLineId = shipmentLine.SalesShipmentLineId
WHERE shipment.Status = 'POSTED';
GO

CREATE OR ALTER VIEW sales.V_SalesInvoiceReturnSummary
AS
SELECT *
FROM sales.V_SalesShipmentReturnSummary
WHERE SalesInvoiceId IS NOT NULL;
GO
