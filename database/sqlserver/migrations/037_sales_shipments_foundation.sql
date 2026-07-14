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
                'SALES_SHIPMENT'
            )
        );
END;
GO

IF OBJECT_ID('sales.SalesShipments', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesShipments (
        SalesShipmentId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesShipments_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        ShipmentNumber NVARCHAR(40) NOT NULL,
        SalesOrderId UNIQUEIDENTIFIER NOT NULL,
        ShipmentDate DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesShipments_ShipmentDate DEFAULT SYSUTCDATETIME(),
        Status NVARCHAR(20) NOT NULL
            CONSTRAINT DF_sales_SalesShipments_Status DEFAULT 'DRAFT',
        WarehouseId UNIQUEIDENTIFIER NULL,
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(1000) NULL,
        InventoryMovementId UNIQUEIDENTIFIER NULL,
        PostedAt DATETIME2(7) NULL,
        PostedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_sales_SalesShipments_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesShipments_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesShipments PRIMARY KEY (SalesShipmentId),
        CONSTRAINT FK_sales_SalesShipments_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesShipments_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesShipments_SalesOrders FOREIGN KEY (SalesOrderId)
            REFERENCES sales.SalesOrders (SalesOrderId),
        CONSTRAINT FK_sales_SalesShipments_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_sales_SalesShipments_InventoryMovements FOREIGN KEY (InventoryMovementId)
            REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT CK_sales_SalesShipments_Status CHECK (Status IN ('DRAFT', 'POSTED', 'CANCELLED'))
    );
END;
GO

IF OBJECT_ID('sales.SalesShipmentLines', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesShipmentLines (
        SalesShipmentLineId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesShipmentLines_Id DEFAULT NEWSEQUENTIALID(),
        SalesShipmentId UNIQUEIDENTIFIER NOT NULL,
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesOrderLineId UNIQUEIDENTIFIER NOT NULL,
        InventoryReservationId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        UnitOfMeasureId UNIQUEIDENTIFIER NOT NULL,
        Quantity DECIMAL(18,4) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesShipmentLines_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesShipmentLines PRIMARY KEY (SalesShipmentLineId),
        CONSTRAINT FK_sales_SalesShipmentLines_SalesShipments FOREIGN KEY (SalesShipmentId)
            REFERENCES sales.SalesShipments (SalesShipmentId),
        CONSTRAINT FK_sales_SalesShipmentLines_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesShipmentLines_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesShipmentLines_SalesOrderLines FOREIGN KEY (SalesOrderLineId)
            REFERENCES sales.SalesOrderLines (SalesOrderLineId),
        CONSTRAINT FK_sales_SalesShipmentLines_InventoryReservations FOREIGN KEY (InventoryReservationId)
            REFERENCES inventory.InventoryReservations (InventoryReservationId),
        CONSTRAINT FK_sales_SalesShipmentLines_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_sales_SalesShipmentLines_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT FK_sales_SalesShipmentLines_UnitsOfMeasure FOREIGN KEY (UnitOfMeasureId)
            REFERENCES core.UnitsOfMeasure (UnitOfMeasureId),
        CONSTRAINT CK_sales_SalesShipmentLines_Quantity CHECK (Quantity > 0)
    );
END;
GO

IF OBJECT_ID('sales.SalesShipmentOperations', 'U') IS NULL
BEGIN
    CREATE TABLE sales.SalesShipmentOperations (
        SalesShipmentOperationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_sales_SalesShipmentOperations_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesShipmentId UNIQUEIDENTIFIER NOT NULL,
        OperationType NVARCHAR(20) NOT NULL,
        IdempotencyKey NVARCHAR(120) NOT NULL,
        RequestHash NVARCHAR(64) NOT NULL,
        ResultStatus NVARCHAR(20) NOT NULL,
        InventoryMovementId UNIQUEIDENTIFIER NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_sales_SalesShipmentOperations_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_sales_SalesShipmentOperations PRIMARY KEY (SalesShipmentOperationId),
        CONSTRAINT FK_sales_SalesShipmentOperations_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_sales_SalesShipmentOperations_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_sales_SalesShipmentOperations_SalesShipments FOREIGN KEY (SalesShipmentId)
            REFERENCES sales.SalesShipments (SalesShipmentId),
        CONSTRAINT FK_sales_SalesShipmentOperations_InventoryMovements FOREIGN KEY (InventoryMovementId)
            REFERENCES inventory.InventoryMovements (InventoryMovementId),
        CONSTRAINT CK_sales_SalesShipmentOperations_Type CHECK (OperationType IN ('POST')),
        CONSTRAINT CK_sales_SalesShipmentOperations_Status CHECK (ResultStatus IN ('POSTED'))
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipments') AND name = 'UX_sales_SalesShipments_Number')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesShipments_Number
        ON sales.SalesShipments (TenantId, CompanyId, ShipmentNumber);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipments') AND name = 'IX_sales_SalesShipments_Order')
BEGIN
    CREATE INDEX IX_sales_SalesShipments_Order
        ON sales.SalesShipments (TenantId, CompanyId, SalesOrderId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipments') AND name = 'IX_sales_SalesShipments_Status')
BEGIN
    CREATE INDEX IX_sales_SalesShipments_Status
        ON sales.SalesShipments (TenantId, CompanyId, Status);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipments') AND name = 'IX_sales_SalesShipments_Date')
BEGIN
    CREATE INDEX IX_sales_SalesShipments_Date
        ON sales.SalesShipments (TenantId, CompanyId, ShipmentDate);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipments') AND name = 'IX_sales_SalesShipments_Warehouse')
BEGIN
    CREATE INDEX IX_sales_SalesShipments_Warehouse
        ON sales.SalesShipments (TenantId, CompanyId, WarehouseId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipmentLines') AND name = 'UX_sales_SalesShipmentLines_Shipment_Line')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesShipmentLines_Shipment_Line
        ON sales.SalesShipmentLines (SalesShipmentId, LineNumber);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipmentLines') AND name = 'IX_sales_SalesShipmentLines_OrderLine')
BEGIN
    CREATE INDEX IX_sales_SalesShipmentLines_OrderLine
        ON sales.SalesShipmentLines (TenantId, CompanyId, SalesOrderLineId);
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('sales.SalesShipmentOperations') AND name = 'UX_sales_SalesShipmentOperations_Key')
BEGIN
    CREATE UNIQUE INDEX UX_sales_SalesShipmentOperations_Key
        ON sales.SalesShipmentOperations (TenantId, CompanyId, OperationType, IdempotencyKey);
END;
GO

CREATE OR ALTER VIEW sales.V_SalesShipmentSummary
AS
SELECT
    shipment.SalesShipmentId,
    shipment.TenantId,
    shipment.CompanyId,
    shipment.ShipmentNumber,
    shipment.SalesOrderId,
    salesOrder.OrderNumber,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    shipment.ShipmentDate,
    shipment.Status,
    shipment.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    shipment.Reference,
    shipment.Notes,
    shipment.InventoryMovementId,
    movement.MovementNumber,
    shipment.PostedAt,
    shipment.PostedBy,
    COUNT(line.SalesShipmentLineId) AS LineCount,
    CAST(COALESCE(SUM(line.Quantity), 0) AS DECIMAL(18,4)) AS TotalQuantity,
    shipment.IsActive,
    shipment.CreatedAt,
    shipment.UpdatedAt,
    shipment.CreatedBy,
    shipment.UpdatedBy
FROM sales.SalesShipments shipment
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = shipment.SalesOrderId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = salesOrder.CustomerId
LEFT JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = shipment.WarehouseId
LEFT JOIN inventory.InventoryMovements movement
    ON movement.InventoryMovementId = shipment.InventoryMovementId
LEFT JOIN sales.SalesShipmentLines line
    ON line.SalesShipmentId = shipment.SalesShipmentId
GROUP BY
    shipment.SalesShipmentId,
    shipment.TenantId,
    shipment.CompanyId,
    shipment.ShipmentNumber,
    shipment.SalesOrderId,
    salesOrder.OrderNumber,
    salesOrder.CustomerId,
    customer.Code,
    customer.Name,
    shipment.ShipmentDate,
    shipment.Status,
    shipment.WarehouseId,
    warehouse.Code,
    warehouse.Name,
    shipment.Reference,
    shipment.Notes,
    shipment.InventoryMovementId,
    movement.MovementNumber,
    shipment.PostedAt,
    shipment.PostedBy,
    shipment.IsActive,
    shipment.CreatedAt,
    shipment.UpdatedAt,
    shipment.CreatedBy,
    shipment.UpdatedBy;
GO

CREATE OR ALTER VIEW sales.V_SalesShipmentLineSummary
AS
SELECT
    line.SalesShipmentLineId,
    line.SalesShipmentId,
    line.TenantId,
    line.CompanyId,
    shipment.ShipmentNumber,
    shipment.SalesOrderId,
    salesOrder.OrderNumber,
    shipment.Status AS ShipmentStatus,
    line.SalesOrderLineId,
    orderLine.LineNumber AS SalesOrderLineNumber,
    line.InventoryReservationId,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
    line.Quantity,
    line.Notes,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy,
    CAST(1 AS BIT) AS IsActive
FROM sales.SalesShipmentLines line
INNER JOIN sales.SalesShipments shipment
    ON shipment.SalesShipmentId = line.SalesShipmentId
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = shipment.SalesOrderId
INNER JOIN sales.SalesOrderLines orderLine
    ON orderLine.SalesOrderLineId = line.SalesOrderLineId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
INNER JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId;
GO

CREATE OR ALTER VIEW sales.V_SalesOrderShipmentSummary
AS
WITH PostedShipments AS (
    SELECT
        shipment.TenantId,
        shipment.CompanyId,
        shipment.SalesOrderId,
        line.SalesOrderLineId,
        SUM(line.Quantity) AS PreviouslyShippedQuantity
    FROM sales.SalesShipmentLines line
    INNER JOIN sales.SalesShipments shipment
        ON shipment.SalesShipmentId = line.SalesShipmentId
    WHERE shipment.Status = 'POSTED'
    GROUP BY shipment.TenantId, shipment.CompanyId, shipment.SalesOrderId, line.SalesOrderLineId
),
LineReservations AS (
    SELECT
        TenantId,
        CompanyId,
        SalesOrderId,
        SalesOrderLineId,
        SUM(CASE WHEN Status IN ('ACTIVE', 'PARTIALLY_RELEASED') THEN ActiveQuantity ELSE 0 END) AS ActiveReservationQuantity,
        SUM(ReservedQuantity) AS ReservedQuantity
    FROM inventory.InventoryReservations
    WHERE IsActive = 1
    GROUP BY TenantId, CompanyId, SalesOrderId, SalesOrderLineId
)
SELECT
    line.SalesOrderLineId AS SalesOrderShipmentId,
    salesOrder.TenantId,
    salesOrder.CompanyId,
    salesOrder.SalesOrderId,
    salesOrder.OrderNumber,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    salesOrder.Status AS OrderStatus,
    line.SalesOrderLineId,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.Quantity AS OrderedQuantity,
    CAST(COALESCE(reservation.ReservedQuantity, 0) AS DECIMAL(18,4)) AS ReservedQuantity,
    CAST(COALESCE(shipped.PreviouslyShippedQuantity, 0) AS DECIMAL(18,4)) AS PreviouslyShippedQuantity,
    CAST(line.Quantity - COALESCE(shipped.PreviouslyShippedQuantity, 0) AS DECIMAL(18,4)) AS PendingShipmentQuantity,
    CAST(COALESCE(reservation.ActiveReservationQuantity, 0) AS DECIMAL(18,4)) AS ActiveReservationQuantity,
    salesOrder.IsActive,
    line.CreatedAt,
    line.UpdatedAt,
    line.CreatedBy,
    line.UpdatedBy
FROM sales.SalesOrderLines line
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = line.SalesOrderId
INNER JOIN crm.Customers customer
    ON customer.CustomerId = salesOrder.CustomerId
INNER JOIN inventory.Items item
    ON item.ItemId = line.ItemId
LEFT JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
LEFT JOIN PostedShipments shipped
    ON shipped.TenantId = line.TenantId
   AND shipped.CompanyId = line.CompanyId
   AND shipped.SalesOrderLineId = line.SalesOrderLineId
LEFT JOIN LineReservations reservation
    ON reservation.TenantId = line.TenantId
   AND reservation.CompanyId = line.CompanyId
   AND reservation.SalesOrderLineId = line.SalesOrderLineId;
GO
