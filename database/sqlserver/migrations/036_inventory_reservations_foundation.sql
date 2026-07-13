IF OBJECT_ID('inventory.InventoryReservations', 'U') IS NULL
BEGIN
    CREATE TABLE inventory.InventoryReservations (
        InventoryReservationId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_Id DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        SalesOrderId UNIQUEIDENTIFIER NOT NULL,
        SalesOrderLineId UNIQUEIDENTIFIER NOT NULL,
        ItemId UNIQUEIDENTIFIER NOT NULL,
        WarehouseId UNIQUEIDENTIFIER NOT NULL,
        ReservedQuantity DECIMAL(18,4) NOT NULL,
        ReleasedQuantity DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_ReleasedQuantity DEFAULT (0),
        ConsumedQuantity DECIMAL(18,4) NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_ConsumedQuantity DEFAULT (0),
        ActiveQuantity AS (ReservedQuantity - ReleasedQuantity - ConsumedQuantity) PERSISTED,
        Status NVARCHAR(30) NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_Status DEFAULT 'ACTIVE',
        Reference NVARCHAR(120) NULL,
        Notes NVARCHAR(500) NULL,
        ReservedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_ReservedAt DEFAULT SYSUTCDATETIME(),
        ReservedBy UNIQUEIDENTIFIER NULL,
        ReleasedAt DATETIME2(7) NULL,
        ReleasedBy UNIQUEIDENTIFIER NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_inventory_InventoryReservations_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_inventory_InventoryReservations PRIMARY KEY (InventoryReservationId),
        CONSTRAINT FK_inventory_InventoryReservations_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_inventory_InventoryReservations_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_inventory_InventoryReservations_SalesOrders FOREIGN KEY (SalesOrderId)
            REFERENCES sales.SalesOrders (SalesOrderId),
        CONSTRAINT FK_inventory_InventoryReservations_SalesOrderLines FOREIGN KEY (SalesOrderLineId)
            REFERENCES sales.SalesOrderLines (SalesOrderLineId),
        CONSTRAINT FK_inventory_InventoryReservations_Items FOREIGN KEY (ItemId)
            REFERENCES inventory.Items (ItemId),
        CONSTRAINT FK_inventory_InventoryReservations_Warehouses FOREIGN KEY (WarehouseId)
            REFERENCES inventory.Warehouses (WarehouseId),
        CONSTRAINT CK_inventory_InventoryReservations_Status CHECK (
            Status IN ('ACTIVE', 'PARTIALLY_RELEASED', 'RELEASED', 'CONSUMED', 'CANCELLED')
        ),
        CONSTRAINT CK_inventory_InventoryReservations_ReservedQuantity CHECK (ReservedQuantity > 0),
        CONSTRAINT CK_inventory_InventoryReservations_ReleasedQuantity CHECK (ReleasedQuantity >= 0),
        CONSTRAINT CK_inventory_InventoryReservations_ConsumedQuantity CHECK (ConsumedQuantity >= 0),
        CONSTRAINT CK_inventory_InventoryReservations_QuantityBalance CHECK (
            ReleasedQuantity + ConsumedQuantity <= ReservedQuantity
        )
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryReservations')
      AND name = 'UX_inventory_InventoryReservations_Line_Item_Warehouse'
)
BEGIN
    CREATE UNIQUE INDEX UX_inventory_InventoryReservations_Line_Item_Warehouse
        ON inventory.InventoryReservations (TenantId, CompanyId, SalesOrderLineId, ItemId, WarehouseId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryReservations')
      AND name = 'IX_inventory_InventoryReservations_Order'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryReservations_Order
        ON inventory.InventoryReservations (TenantId, CompanyId, SalesOrderId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryReservations')
      AND name = 'IX_inventory_InventoryReservations_Line'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryReservations_Line
        ON inventory.InventoryReservations (TenantId, CompanyId, SalesOrderLineId);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('inventory.InventoryReservations')
      AND name = 'IX_inventory_InventoryReservations_Item_Warehouse'
)
BEGIN
    CREATE INDEX IX_inventory_InventoryReservations_Item_Warehouse
        ON inventory.InventoryReservations (TenantId, CompanyId, ItemId, WarehouseId, Status);
END;
GO

CREATE OR ALTER VIEW inventory.V_ItemAvailability
AS
WITH ActiveReservations AS (
    SELECT
        TenantId,
        CompanyId,
        ItemId,
        WarehouseId,
        SUM(ActiveQuantity) AS ReservedQuantity
    FROM inventory.InventoryReservations
    WHERE Status IN ('ACTIVE', 'PARTIALLY_RELEASED')
      AND ActiveQuantity > 0
      AND IsActive = 1
    GROUP BY TenantId, CompanyId, ItemId, WarehouseId
)
SELECT
    CONCAT(CONVERT(NVARCHAR(36), stock.ItemId), ':', CONVERT(NVARCHAR(36), stock.WarehouseId)) AS ItemAvailabilityId,
    stock.TenantId,
    stock.CompanyId,
    stock.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    stock.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    stock.QuantityOnHand AS OnHandQuantity,
    CAST(COALESCE(reservation.ReservedQuantity, 0) AS DECIMAL(18,4)) AS ReservedQuantity,
    CAST(stock.QuantityOnHand - COALESCE(reservation.ReservedQuantity, 0) AS DECIMAL(18,4)) AS AvailableQuantity,
    stock.IsActive,
    stock.CreatedAt,
    stock.UpdatedAt,
    stock.CreatedBy,
    stock.UpdatedBy
FROM inventory.ItemStocks stock
INNER JOIN inventory.Items item
    ON item.ItemId = stock.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = stock.WarehouseId
LEFT JOIN ActiveReservations reservation
    ON reservation.TenantId = stock.TenantId
   AND reservation.CompanyId = stock.CompanyId
   AND reservation.ItemId = stock.ItemId
   AND reservation.WarehouseId = stock.WarehouseId;
GO

CREATE OR ALTER VIEW inventory.V_InventoryReservationSummary
AS
SELECT
    reservation.InventoryReservationId,
    reservation.TenantId,
    reservation.CompanyId,
    reservation.SalesOrderId,
    salesOrder.OrderNumber,
    reservation.SalesOrderLineId,
    salesLine.LineNumber,
    reservation.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    reservation.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    reservation.ReservedQuantity,
    reservation.ReleasedQuantity,
    reservation.ConsumedQuantity,
    reservation.ActiveQuantity,
    reservation.Status,
    reservation.Reference,
    reservation.Notes,
    reservation.ReservedAt,
    reservation.ReservedBy,
    reservation.ReleasedAt,
    reservation.ReleasedBy,
    reservation.IsActive,
    reservation.CreatedAt,
    reservation.UpdatedAt,
    reservation.CreatedBy,
    reservation.UpdatedBy
FROM inventory.InventoryReservations reservation
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = reservation.SalesOrderId
INNER JOIN sales.SalesOrderLines salesLine
    ON salesLine.SalesOrderLineId = reservation.SalesOrderLineId
INNER JOIN inventory.Items item
    ON item.ItemId = reservation.ItemId
INNER JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = reservation.WarehouseId;
GO

CREATE OR ALTER VIEW inventory.V_SalesOrderReservationSummary
AS
WITH LineReservations AS (
    SELECT
        TenantId,
        CompanyId,
        SalesOrderId,
        SalesOrderLineId,
        SUM(CASE WHEN Status IN ('ACTIVE', 'PARTIALLY_RELEASED') THEN ActiveQuantity ELSE 0 END) AS ReservedQuantity,
        SUM(ReleasedQuantity) AS ReleasedQuantity,
        SUM(ConsumedQuantity) AS ConsumedQuantity
    FROM inventory.InventoryReservations
    WHERE IsActive = 1
    GROUP BY TenantId, CompanyId, SalesOrderId, SalesOrderLineId
)
SELECT
    salesLine.SalesOrderLineId AS SalesOrderReservationId,
    salesOrder.TenantId,
    salesOrder.CompanyId,
    salesOrder.SalesOrderId,
    salesOrder.OrderNumber,
    salesOrder.Status AS OrderStatus,
    salesLine.SalesOrderLineId,
    salesLine.LineNumber,
    salesLine.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    salesLine.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    salesLine.Quantity AS OrderedQuantity,
    CAST(COALESCE(lineReservation.ReservedQuantity, 0) AS DECIMAL(18,4)) AS ReservedQuantity,
    CAST(COALESCE(lineReservation.ReleasedQuantity, 0) AS DECIMAL(18,4)) AS ReleasedQuantity,
    CAST(COALESCE(lineReservation.ConsumedQuantity, 0) AS DECIMAL(18,4)) AS ConsumedQuantity,
    CAST(salesLine.Quantity - COALESCE(lineReservation.ReservedQuantity, 0) - COALESCE(lineReservation.ConsumedQuantity, 0) AS DECIMAL(18,4)) AS PendingReservationQuantity,
    availability.OnHandQuantity,
    availability.AvailableQuantity,
    salesOrder.IsActive,
    salesLine.CreatedAt,
    salesLine.UpdatedAt,
    salesLine.CreatedBy,
    salesLine.UpdatedBy
FROM sales.SalesOrderLines salesLine
INNER JOIN sales.SalesOrders salesOrder
    ON salesOrder.SalesOrderId = salesLine.SalesOrderId
INNER JOIN inventory.Items item
    ON item.ItemId = salesLine.ItemId
LEFT JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = salesLine.WarehouseId
LEFT JOIN LineReservations lineReservation
    ON lineReservation.TenantId = salesLine.TenantId
   AND lineReservation.CompanyId = salesLine.CompanyId
   AND lineReservation.SalesOrderLineId = salesLine.SalesOrderLineId
LEFT JOIN inventory.V_ItemAvailability availability
    ON availability.TenantId = salesLine.TenantId
   AND availability.CompanyId = salesLine.CompanyId
   AND availability.ItemId = salesLine.ItemId
   AND availability.WarehouseId = salesLine.WarehouseId;
GO

CREATE OR ALTER VIEW sales.V_SalesOrderLineSummary
AS
SELECT
    line.SalesOrderLineId,
    line.SalesOrderId,
    line.TenantId,
    line.CompanyId,
    salesOrder.OrderNumber,
    salesOrder.SourceQuotationId,
    salesOrder.SourceQuotationNumber,
    line.SourceQuotationLineId,
    salesOrder.CustomerId,
    customer.Code AS CustomerCode,
    customer.Name AS CustomerName,
    salesOrder.Status,
    salesOrder.OrderDate,
    salesOrder.RequestedDeliveryDate,
    line.LineNumber,
    line.ItemId,
    item.Code AS ItemCode,
    item.Description AS ItemDescription,
    line.UnitOfMeasureId,
    unit.Code AS UnitOfMeasureCode,
    unit.Name AS UnitOfMeasureName,
    line.WarehouseId,
    warehouse.Code AS WarehouseCode,
    warehouse.Name AS WarehouseName,
    line.Description,
    line.Quantity,
    line.UnitPrice,
    line.DiscountPercent,
    line.DiscountAmount,
    line.TaxPercent,
    line.TaxAmount,
    line.LineSubtotal,
    line.LineTotal,
    line.Notes,
    reservation.ReservedQuantity,
    reservation.PendingReservationQuantity,
    reservation.OnHandQuantity,
    reservation.AvailableQuantity,
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
INNER JOIN core.UnitsOfMeasure unit
    ON unit.UnitOfMeasureId = line.UnitOfMeasureId
LEFT JOIN inventory.Warehouses warehouse
    ON warehouse.WarehouseId = line.WarehouseId
LEFT JOIN inventory.V_SalesOrderReservationSummary reservation
    ON reservation.TenantId = line.TenantId
   AND reservation.CompanyId = line.CompanyId
   AND reservation.SalesOrderLineId = line.SalesOrderLineId;
GO
