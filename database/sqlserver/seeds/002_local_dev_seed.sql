DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @CompanyId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @UserId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @RoleId UNIQUEIDENTIFIER = '44444444-4444-4444-4444-444444444444';
DECLARE @PasswordHash NVARCHAR(255) = '$2b$10$U8lc0SqC32RM3HYL9J/FxOCoCgYPotmSo5.lbya02skdBiSiEt1b2';

IF NOT EXISTS (SELECT 1 FROM core.Tenants WHERE TenantId = @TenantId)
BEGIN
  INSERT INTO core.Tenants (TenantId, Name, Slug, IsActive)
  VALUES (@TenantId, 'Doble S Demo Tenant', 'doble-s-demo', 1);
END;

IF NOT EXISTS (SELECT 1 FROM core.Companies WHERE CompanyId = @CompanyId)
BEGIN
  INSERT INTO core.Companies (CompanyId, TenantId, LegalName, TradeName, TaxId, FiscalCountryCode, IsActive)
  VALUES (@CompanyId, @TenantId, 'Doble S Demo SRL', 'Doble S Demo', 'LOCAL-DEMO', 'DO', 1);
END;

IF NOT EXISTS (SELECT 1 FROM security.Users WHERE UserId = @UserId)
BEGIN
  INSERT INTO security.Users (UserId, TenantId, DefaultCompanyId, Email, DisplayName, PasswordHash, IsActive)
  VALUES (@UserId, @TenantId, @CompanyId, 'demo@dobles.local', 'Usuario demo', @PasswordHash, 1);
END;

IF NOT EXISTS (
  SELECT 1 FROM security.UserCompanyAccess
  WHERE TenantId = @TenantId AND UserId = @UserId AND CompanyId = @CompanyId
)
BEGIN
  INSERT INTO security.UserCompanyAccess (TenantId, UserId, CompanyId, IsDefault)
  VALUES (@TenantId, @UserId, @CompanyId, 1);
END;

IF NOT EXISTS (SELECT 1 FROM security.Roles WHERE TenantId = @TenantId AND Code = 'LOCAL_ADMIN')
BEGIN
  INSERT INTO security.Roles (RoleId, TenantId, Code, Name, IsSystemRole, IsActive)
  VALUES (@RoleId, @TenantId, 'LOCAL_ADMIN', 'Administrador local', 1, 1);
END
ELSE
BEGIN
  SELECT @RoleId = RoleId FROM security.Roles WHERE TenantId = @TenantId AND Code = 'LOCAL_ADMIN';
END;

IF NOT EXISTS (
  SELECT 1 FROM security.UserRoles
  WHERE TenantId = @TenantId AND UserId = @UserId AND RoleId = @RoleId
)
BEGIN
  INSERT INTO security.UserRoles (TenantId, UserId, RoleId)
  VALUES (@TenantId, @UserId, @RoleId);
END;

DECLARE @Permissions TABLE (ModuleCode NVARCHAR(80), ActionCode NVARCHAR(80), Description NVARCHAR(250));

INSERT INTO @Permissions (ModuleCode, ActionCode, Description)
VALUES
  ('master-data', 'master-data.currencies.read', 'Local read currencies'),
  ('master-data', 'master-data.currencies.create', 'Local create currencies'),
  ('master-data', 'master-data.currencies.update', 'Local update currencies'),
  ('master-data', 'master-data.currencies.activate', 'Local activate currencies'),
  ('master-data', 'master-data.currencies.deactivate', 'Local deactivate currencies'),
  ('master-data', 'master-data.units-of-measure.read', 'Local read units of measure'),
  ('master-data', 'master-data.units-of-measure.create', 'Local create units of measure'),
  ('master-data', 'master-data.units-of-measure.update', 'Local update units of measure'),
  ('master-data', 'master-data.units-of-measure.activate', 'Local activate units of measure'),
  ('master-data', 'master-data.units-of-measure.deactivate', 'Local deactivate units of measure'),
  ('master-data', 'master-data.payment-terms.read', 'Local read payment terms'),
  ('master-data', 'master-data.payment-terms.create', 'Local create payment terms'),
  ('master-data', 'master-data.payment-terms.update', 'Local update payment terms'),
  ('master-data', 'master-data.payment-terms.activate', 'Local activate payment terms'),
  ('master-data', 'master-data.payment-terms.deactivate', 'Local deactivate payment terms'),
  ('master-data', 'master-data.tax-categories.read', 'Local read tax categories'),
  ('master-data', 'master-data.tax-categories.create', 'Local create tax categories'),
  ('master-data', 'master-data.tax-categories.update', 'Local update tax categories'),
  ('master-data', 'master-data.tax-categories.activate', 'Local activate tax categories'),
  ('master-data', 'master-data.tax-categories.deactivate', 'Local deactivate tax categories'),
  ('crm', 'crm.customers.read', 'Local read customers'),
  ('crm', 'crm.customers.create', 'Local create customers'),
  ('crm', 'crm.customers.update', 'Local update customers'),
  ('crm', 'crm.customers.activate', 'Local activate customers'),
  ('crm', 'crm.customers.deactivate', 'Local deactivate customers'),
  ('purchasing', 'purchasing.suppliers.read', 'Local read suppliers'),
  ('purchasing', 'purchasing.suppliers.create', 'Local create suppliers'),
  ('purchasing', 'purchasing.suppliers.update', 'Local update suppliers'),
  ('purchasing', 'purchasing.suppliers.activate', 'Local activate suppliers'),
  ('purchasing', 'purchasing.suppliers.deactivate', 'Local deactivate suppliers'),
  ('sales', 'sales.quotations.read', 'Local read sales quotations'),
  ('sales', 'sales.quotations.create', 'Local create sales quotations'),
  ('sales', 'sales.quotations.update', 'Local update sales quotations'),
  ('sales', 'sales.quotations.send', 'Local send sales quotations'),
  ('sales', 'sales.quotations.approve', 'Local approve sales quotations'),
  ('sales', 'sales.quotations.reject', 'Local reject sales quotations'),
  ('sales', 'sales.quotations.expire', 'Local expire sales quotations'),
  ('sales', 'sales.orders.read', 'Local read sales orders'),
  ('sales', 'sales.orders.create', 'Local create sales orders'),
  ('sales', 'sales.orders.update', 'Local update sales orders'),
  ('sales', 'sales.orders.submit', 'Local submit sales orders'),
  ('sales', 'sales.orders.approve', 'Local approve sales orders'),
  ('sales', 'sales.orders.reject', 'Local reject sales orders'),
  ('sales', 'sales.orders.cancel', 'Local cancel sales orders'),
  ('sales', 'sales.shipments.read', 'Local read sales shipments'),
  ('sales', 'sales.shipments.create', 'Local create sales shipments'),
  ('sales', 'sales.shipments.update', 'Local update sales shipments'),
  ('sales', 'sales.shipments.post', 'Local post sales shipments'),
  ('sales', 'sales.invoices.read', 'Local read sales invoices'),
  ('sales', 'sales.invoices.create', 'Local create sales invoices'),
  ('sales', 'sales.invoices.update', 'Local update sales invoices'),
  ('sales', 'sales.invoices.post', 'Local post sales invoices'),
  ('sales', 'sales.returns.read', 'Local read sales returns'),
  ('sales', 'sales.returns.create', 'Local create sales returns'),
  ('sales', 'sales.returns.update', 'Local update sales returns'),
  ('sales', 'sales.returns.post', 'Local post sales returns'),
  ('purchasing', 'purchasing.purchase-orders.read', 'Local read purchase orders'),
  ('purchasing', 'purchasing.purchase-orders.create', 'Local create purchase orders'),
  ('purchasing', 'purchasing.purchase-orders.approve', 'Local approve purchase orders'),
  ('purchasing', 'purchasing.purchase-orders.cancel', 'Local cancel purchase orders'),
  ('purchasing', 'purchasing.purchase-orders.export', 'Local export purchase orders'),
  ('purchasing', 'purchasing.purchase-orders.import', 'Local import purchase orders'),
  ('purchasing', 'purchasing.purchase-receipts.read', 'Local read purchase receipts'),
  ('purchasing', 'purchasing.purchase-receipts.create', 'Local create purchase receipts'),
  ('purchasing', 'purchasing.purchase-receipts.post', 'Local post purchase receipts'),
  ('purchasing', 'purchasing.purchase-receipts.export', 'Local export purchase receipts'),
  ('purchasing', 'purchasing.purchase-receipts.import', 'Local import purchase receipts'),
  ('purchasing', 'purchasing.supplier-invoices.read', 'Local read supplier invoices'),
  ('purchasing', 'purchasing.supplier-invoices.create', 'Local create supplier invoices'),
  ('purchasing', 'purchasing.supplier-invoices.post', 'Local post supplier invoices'),
  ('purchasing', 'ap.accounts-payable.read', 'Local read AP documents'),
  ('purchasing', 'ap.statements.read', 'Local read supplier statements'),
  ('purchasing', 'ap.aging.read', 'Local read supplier aging'),
  ('purchasing', 'ap.payments.read', 'Local read supplier payments'),
  ('purchasing', 'ap.payments.create', 'Local create supplier payments'),
  ('purchasing', 'ap.payments.update', 'Local update supplier payment applications'),
  ('purchasing', 'ap.payments.post', 'Local post supplier payments'),
  ('purchasing', 'ap.adjustments.read', 'Local read supplier adjustments'),
  ('purchasing', 'ap.adjustments.create', 'Local create supplier adjustments'),
  ('purchasing', 'ap.adjustments.update', 'Local update supplier adjustment applications'),
  ('purchasing', 'ap.adjustments.post', 'Local post supplier adjustments'),
  ('receivables', 'ar.documents.read', 'Local read accounts receivable documents'),
  ('receivables', 'ar.documents.create', 'Local create accounts receivable documents'),
  ('receivables', 'ar.customer-balances.read', 'Local read customer receivable balances'),
  ('receivables', 'ar.statements.read', 'Local read customer statements'),
  ('receivables', 'ar.aging.read', 'Local read customer aging'),
  ('receivables', 'ar.receipts.read', 'Local read customer receipts'),
  ('receivables', 'ar.receipts.create', 'Local create customer receipts'),
  ('receivables', 'ar.receipts.update', 'Local update customer receipt applications'),
  ('receivables', 'ar.receipts.post', 'Local post customer receipts'),
  ('receivables', 'ar.customer-credit-notes.read', 'Local read customer credit notes'),
  ('receivables', 'ar.customer-credit-notes.create', 'Local create customer credit notes'),
  ('receivables', 'ar.customer-credit-notes.update', 'Local update customer credit note applications'),
  ('receivables', 'ar.customer-credit-notes.post', 'Local post customer credit notes'),
  ('accounting', 'accounting.cost-centers.read', 'Local read cost centers'),
  ('accounting', 'accounting.cost-centers.create', 'Local create cost centers'),
  ('accounting', 'accounting.cost-centers.update', 'Local update cost centers'),
  ('accounting', 'accounting.cost-centers.activate', 'Local activate cost centers'),
  ('accounting', 'accounting.cost-centers.deactivate', 'Local deactivate cost centers'),
  ('accounting', 'accounting.accounts.read', 'Local read accounting accounts'),
  ('accounting', 'accounting.accounts.create', 'Local create accounting accounts'),
  ('accounting', 'accounting.accounts.update', 'Local update accounting accounts'),
  ('accounting', 'accounting.accounts.block', 'Local block accounting accounts'),
  ('accounting', 'accounting.accounts.unblock', 'Local unblock accounting accounts'),
  ('accounting', 'accounting.accounts.activate', 'Local activate accounting accounts'),
  ('accounting', 'accounting.accounts.deactivate', 'Local deactivate accounting accounts'),
  ('accounting', 'accounting.periods.read', 'Local read accounting periods'),
  ('accounting', 'accounting.periods.create', 'Local create accounting periods'),
  ('accounting', 'accounting.periods.update', 'Local update accounting periods'),
  ('accounting', 'accounting.periods.close', 'Local close accounting periods'),
  ('accounting', 'accounting.periods.reopen', 'Local reopen accounting periods'),
  ('inventory', 'inventory.items.read', 'Local read items'),
  ('inventory', 'inventory.items.create', 'Local create items'),
  ('inventory', 'inventory.items.update', 'Local update items'),
  ('inventory', 'inventory.items.activate', 'Local activate items'),
  ('inventory', 'inventory.items.deactivate', 'Local deactivate items'),
  ('inventory', 'inventory.categories.read', 'Local read categories'),
  ('inventory', 'inventory.categories.create', 'Local create categories'),
  ('inventory', 'inventory.categories.update', 'Local update categories'),
  ('inventory', 'inventory.categories.activate', 'Local activate categories'),
  ('inventory', 'inventory.categories.deactivate', 'Local deactivate categories'),
  ('inventory', 'inventory.brands.read', 'Local read brands'),
  ('inventory', 'inventory.brands.create', 'Local create brands'),
  ('inventory', 'inventory.brands.update', 'Local update brands'),
  ('inventory', 'inventory.brands.activate', 'Local activate brands'),
  ('inventory', 'inventory.brands.deactivate', 'Local deactivate brands'),
  ('inventory', 'inventory.warehouses.read', 'Local read warehouses'),
  ('inventory', 'inventory.warehouses.create', 'Local create warehouses'),
  ('inventory', 'inventory.warehouses.update', 'Local update warehouses'),
  ('inventory', 'inventory.warehouses.activate', 'Local activate warehouses'),
  ('inventory', 'inventory.warehouses.deactivate', 'Local deactivate warehouses'),
  ('inventory', 'inventory.stocks.read', 'Local read inventory stocks'),
  ('inventory', 'inventory.movements.read', 'Local read inventory movements'),
  ('inventory', 'inventory.movements.post', 'Local post inventory movements'),
  ('inventory', 'inventory.ledger.read', 'Local read inventory ledger'),
  ('inventory', 'inventory.adjustments.create', 'Local create inventory adjustments'),
  ('inventory', 'inventory.physical-counts.create', 'Local create physical counts'),
  ('inventory', 'inventory.physical-counts.count', 'Local count physical inventory lines'),
  ('inventory', 'inventory.physical-counts.complete', 'Local complete physical counts'),
  ('inventory', 'inventory.physical-counts.adjust', 'Local create physical count adjustments'),
  ('inventory', 'inventory.reservations.read', 'Local read inventory reservations'),
  ('inventory', 'inventory.reservations.create', 'Local create inventory reservations'),
  ('inventory', 'inventory.reservations.release', 'Local release inventory reservations'),
  ('inventory', 'inventory.availability.read', 'Local read inventory availability');

INSERT INTO security.Permissions (ModuleCode, ActionCode, Description, IsActive)
SELECT p.ModuleCode, p.ActionCode, p.Description, 1
FROM @Permissions p
WHERE NOT EXISTS (
  SELECT 1 FROM security.Permissions existing
  WHERE existing.ModuleCode = p.ModuleCode AND existing.ActionCode = p.ActionCode
);

INSERT INTO security.RolePermissions (TenantId, RoleId, PermissionId)
SELECT @TenantId, @RoleId, permission.PermissionId
FROM security.Permissions permission
INNER JOIN @Permissions p
  ON p.ModuleCode = permission.ModuleCode
 AND p.ActionCode = permission.ActionCode
WHERE NOT EXISTS (
  SELECT 1 FROM security.RolePermissions existing
  WHERE existing.TenantId = @TenantId
    AND existing.RoleId = @RoleId
    AND existing.PermissionId = permission.PermissionId
);
GO

DECLARE @TenantId UNIQUEIDENTIFIER = '11111111-1111-1111-1111-111111111111';
DECLARE @CompanyId UNIQUEIDENTIFIER = '22222222-2222-2222-2222-222222222222';
DECLARE @UserId UNIQUEIDENTIFIER = '33333333-3333-3333-3333-333333333333';
DECLARE @CurrencyId UNIQUEIDENTIFIER = '55555555-5555-5555-5555-555555555555';
DECLARE @UnitId UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666666';
DECLARE @BoxUnitId UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666667';
DECLARE @PackUnitId UNIQUEIDENTIFIER = '66666666-6666-6666-6666-666666666668';
DECLARE @PaymentTermId UNIQUEIDENTIFIER = '77777777-7777-7777-7777-777777777777';
DECLARE @TaxCategoryId UNIQUEIDENTIFIER = '88888888-8888-8888-8888-888888888888';
DECLARE @CategoryId UNIQUEIDENTIFIER = '99999999-9999-9999-9999-999999999999';
DECLARE @BrandId UNIQUEIDENTIFIER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
DECLARE @CostCenterAdminId UNIQUEIDENTIFIER = 'acacacac-acac-acac-acac-acacacacac01';
DECLARE @CostCenterAccountingId UNIQUEIDENTIFIER = 'acacacac-acac-acac-acac-acacacacac02';
DECLARE @AccountingPeriodJanId UNIQUEIDENTIFIER = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b101';
DECLARE @AccountingPeriodFebId UNIQUEIDENTIFIER = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b102';
DECLARE @AccountAssetsId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000001';
DECLARE @AccountCurrentAssetsId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000002';
DECLARE @AccountCashId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000003';
DECLARE @AccountBankId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000004';
DECLARE @AccountLiabilitiesId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000005';
DECLARE @AccountPayableId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000006';
DECLARE @AccountEquityId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000007';
DECLARE @AccountRevenueId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000008';
DECLARE @AccountExpensesId UNIQUEIDENTIFIER = 'ca000000-0000-0000-0000-000000000009';
DECLARE @WarehouseId UNIQUEIDENTIFIER = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
DECLARE @TransitWarehouseId UNIQUEIDENTIFIER = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeef';
DECLARE @InventoryMovementId UNIQUEIDENTIFIER = 'abababab-abab-abab-abab-abababababab';
DECLARE @InventoryMovementLineId UNIQUEIDENTIFIER = 'abababab-abab-abab-abab-abababababac';
DECLARE @PostQaMovementId UNIQUEIDENTIFIER = 'abababab-abab-abab-abab-abababababad';
DECLARE @PostQaMovementLineId UNIQUEIDENTIFIER = 'abababab-abab-abab-abab-abababababae';
DECLARE @TransferQaMovementId UNIQUEIDENTIFIER = 'abababab-abab-abab-abab-abababababaf';
DECLARE @TransferQaMovementLineId UNIQUEIDENTIFIER = 'abababab-abab-abab-abab-abababababb0';
DECLARE @CustomerId UNIQUEIDENTIFIER = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
DECLARE @SupplierId UNIQUEIDENTIFIER = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
DECLARE @ItemId UNIQUEIDENTIFIER = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

IF NOT EXISTS (SELECT 1 FROM core.Currencies WHERE CurrencyId = @CurrencyId)
BEGIN
  INSERT INTO core.Currencies (CurrencyId, TenantId, CompanyId, Code, Name, Description, IsActive, CreatedBy)
  VALUES (@CurrencyId, @TenantId, NULL, 'DOP', 'Peso dominicano', 'Moneda local para pruebas', 1, @UserId);
END;

IF NOT EXISTS (SELECT 1 FROM core.UnitsOfMeasure WHERE UnitOfMeasureId = @UnitId)
BEGIN
  INSERT INTO core.UnitsOfMeasure (
    UnitOfMeasureId, TenantId, CompanyId, Code, Name, Description,
    Symbol, UnitType, DecimalPrecision, IsBaseUnit, IsActive, CreatedBy
  )
  VALUES (
    @UnitId, @TenantId, NULL, 'UND', 'Unidad', 'Unidad base para pruebas',
    'und', 'QUANTITY', 0, 1, 1, @UserId
  );
END;
ELSE
BEGIN
  UPDATE core.UnitsOfMeasure
  SET Symbol = COALESCE(Symbol, 'und'),
      UnitType = COALESCE(UnitType, 'QUANTITY'),
      DecimalPrecision = 0,
      IsBaseUnit = 1,
      UpdatedBy = @UserId,
      UpdatedAt = SYSUTCDATETIME()
  WHERE UnitOfMeasureId = @UnitId;
END;

IF NOT EXISTS (SELECT 1 FROM core.UnitsOfMeasure WHERE UnitOfMeasureId = @BoxUnitId)
BEGIN
  INSERT INTO core.UnitsOfMeasure (
    UnitOfMeasureId, TenantId, CompanyId, Code, Name, Description,
    Symbol, UnitType, DecimalPrecision, IsBaseUnit, IsActive, CreatedBy
  )
  VALUES (
    @BoxUnitId, @TenantId, NULL, 'CAJA', 'Caja', 'Caja para pruebas locales',
    'cja', 'QUANTITY', 0, 0, 1, @UserId
  );
END;

IF NOT EXISTS (SELECT 1 FROM core.UnitsOfMeasure WHERE UnitOfMeasureId = @PackUnitId)
BEGIN
  INSERT INTO core.UnitsOfMeasure (
    UnitOfMeasureId, TenantId, CompanyId, Code, Name, Description,
    Symbol, UnitType, DecimalPrecision, IsBaseUnit, IsActive, CreatedBy
  )
  VALUES (
    @PackUnitId, @TenantId, NULL, 'PAQ', 'Paquete', 'Paquete para pruebas locales',
    'paq', 'QUANTITY', 0, 0, 1, @UserId
  );
END;

IF NOT EXISTS (SELECT 1 FROM core.PaymentTerms WHERE PaymentTermId = @PaymentTermId)
BEGIN
  INSERT INTO core.PaymentTerms (PaymentTermId, TenantId, CompanyId, Code, Name, Description, IsActive, CreatedBy)
  VALUES (@PaymentTermId, @TenantId, @CompanyId, 'CONTADO', 'Contado', 'Pago inmediato', 1, @UserId);
END;

IF NOT EXISTS (SELECT 1 FROM fiscal.TaxCategories WHERE TaxCategoryId = @TaxCategoryId)
BEGIN
  INSERT INTO fiscal.TaxCategories (TaxCategoryId, TenantId, CompanyId, Code, Name, Description, IsActive, CreatedBy)
  VALUES (@TaxCategoryId, @TenantId, @CompanyId, 'ITBIS18', 'ITBIS 18%', 'Categoria fiscal local de prueba', 1, @UserId);
END;

IF OBJECT_ID('inventory.Categories', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM inventory.Categories WHERE CategoryId = @CategoryId)
BEGIN
  INSERT INTO inventory.Categories (
    CategoryId, TenantId, CompanyId, Code, Name, Description, IsSalesCategory,
    IsPurchaseCategory, IsInventoryCategory, IsActive, CreatedBy
  )
  VALUES (
    @CategoryId, @TenantId, @CompanyId, 'GENERAL', 'General', 'Categoria general local',
    1, 1, 1, 1, @UserId
  );
END;

IF OBJECT_ID('inventory.Brands', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM inventory.Brands WHERE BrandId = @BrandId)
BEGIN
  INSERT INTO inventory.Brands (
    BrandId, TenantId, CompanyId, Code, Name, Description, Website, CountryCode, IsActive, CreatedBy
  )
  VALUES (
    @BrandId, @TenantId, @CompanyId, 'DOBLES', 'Doble S', 'Marca local de prueba',
    'https://local.dobles.example', 'DOM', 1, @UserId
  );
END;

IF OBJECT_ID('accounting.CostCenters', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accounting.CostCenters WHERE CostCenterId = @CostCenterAdminId)
BEGIN
  INSERT INTO accounting.CostCenters (
    CostCenterId, TenantId, CompanyId, Code, Name, Description,
    ParentCostCenterId, Level, AllowsPosting, ValidFrom, ValidTo, IsActive, CreatedBy
  )
  VALUES (
    @CostCenterAdminId, @TenantId, @CompanyId, 'ADMIN', 'Administracion',
    'Centro de costo administrativo demo', NULL, 1, 0, '2026-01-01', NULL, 1, @UserId
  );
END;

IF OBJECT_ID('accounting.CostCenters', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accounting.CostCenters WHERE CostCenterId = @CostCenterAccountingId)
BEGIN
  INSERT INTO accounting.CostCenters (
    CostCenterId, TenantId, CompanyId, Code, Name, Description,
    ParentCostCenterId, Level, AllowsPosting, ValidFrom, ValidTo, IsActive, CreatedBy
  )
  VALUES (
    @CostCenterAccountingId, @TenantId, @CompanyId, 'CONTAB', 'Contabilidad',
    'Centro de costo contable demo', @CostCenterAdminId, 2, 1, '2026-01-01', NULL, 1, @UserId
  );
END;

IF OBJECT_ID('accounting.AccountingPeriods', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accounting.AccountingPeriods WHERE AccountingPeriodId = @AccountingPeriodJanId)
BEGIN
  INSERT INTO accounting.AccountingPeriods (
    AccountingPeriodId, TenantId, CompanyId, FiscalYear, PeriodNumber, Name,
    StartDate, EndDate, Status, IsAdjustmentPeriod, OpenedAt, OpenedBy, ClosedAt, ClosedBy, IsActive, CreatedBy
  )
  VALUES (
    @AccountingPeriodJanId, @TenantId, @CompanyId, 2025, 1, 'Enero 2025',
    '2025-01-01', '2025-01-31', 'CLOSED', 0, '2025-01-01T00:00:00', @UserId, '2025-02-01T00:00:00', @UserId, 1, @UserId
  );
END;

IF OBJECT_ID('accounting.AccountingPeriods', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM accounting.AccountingPeriods WHERE AccountingPeriodId = @AccountingPeriodFebId)
BEGIN
  INSERT INTO accounting.AccountingPeriods (
    AccountingPeriodId, TenantId, CompanyId, FiscalYear, PeriodNumber, Name,
    StartDate, EndDate, Status, IsAdjustmentPeriod, OpenedAt, OpenedBy, IsActive, CreatedBy
  )
  VALUES (
    @AccountingPeriodFebId, @TenantId, @CompanyId, 2025, 2, 'Febrero 2025',
    '2025-02-01', '2025-02-28', 'OPEN', 0, '2025-02-01T00:00:00', @UserId, 1, @UserId
  );
END;

IF OBJECT_ID('accounting.Accounts', 'U') IS NOT NULL
BEGIN
  DECLARE @SeedAccounts TABLE (
    AccountId UNIQUEIDENTIFIER NOT NULL,
    Code NVARCHAR(50) NOT NULL,
    Name NVARCHAR(200) NOT NULL,
    ParentAccountId UNIQUEIDENTIFIER NULL,
    Level INT NOT NULL,
    AccountType NVARCHAR(30) NOT NULL,
    NormalBalance NVARCHAR(10) NOT NULL,
    AllowsPosting BIT NOT NULL,
    IsControlAccount BIT NOT NULL
  );

  INSERT INTO @SeedAccounts (AccountId, Code, Name, ParentAccountId, Level, AccountType, NormalBalance, AllowsPosting, IsControlAccount)
  VALUES
    (@AccountAssetsId, '1', 'Activos', NULL, 1, 'ASSET', 'DEBIT', 0, 1),
    (@AccountCurrentAssetsId, '1-01', 'Activos corrientes', @AccountAssetsId, 2, 'ASSET', 'DEBIT', 0, 1),
    (@AccountCashId, '1-01-001', 'Caja general', @AccountCurrentAssetsId, 3, 'ASSET', 'DEBIT', 1, 0),
    (@AccountBankId, '1-01-002', 'Banco general', @AccountCurrentAssetsId, 3, 'ASSET', 'DEBIT', 1, 0),
    (@AccountLiabilitiesId, '2', 'Pasivos', NULL, 1, 'LIABILITY', 'CREDIT', 0, 1),
    (@AccountPayableId, '2-01', 'Cuentas por pagar', @AccountLiabilitiesId, 2, 'LIABILITY', 'CREDIT', 1, 0),
    (@AccountEquityId, '3', 'Patrimonio', NULL, 1, 'EQUITY', 'CREDIT', 0, 1),
    (@AccountRevenueId, '4', 'Ingresos', NULL, 1, 'REVENUE', 'CREDIT', 0, 1),
    (@AccountExpensesId, '5', 'Gastos', NULL, 1, 'EXPENSE', 'DEBIT', 0, 1);

  INSERT INTO accounting.Accounts (
    AccountId, TenantId, CompanyId, Code, Name, ParentAccountId, Level,
    AccountType, NormalBalance, AllowsPosting, IsControlAccount,
    RequiresCostCenter, RequiresThirdParty, IsBlocked, IsActive, CreatedBy
  )
  SELECT
    seed.AccountId, @TenantId, @CompanyId, seed.Code, seed.Name, seed.ParentAccountId, seed.Level,
    seed.AccountType, seed.NormalBalance, seed.AllowsPosting, seed.IsControlAccount,
    0, 0, 0, 1, @UserId
  FROM @SeedAccounts seed
  WHERE NOT EXISTS (
    SELECT 1
    FROM accounting.Accounts existing
    WHERE existing.TenantId = @TenantId
      AND existing.CompanyId = @CompanyId
      AND existing.Code = seed.Code
  );
END;

IF OBJECT_ID('inventory.Warehouses', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @WarehouseId)
BEGIN
  INSERT INTO inventory.Warehouses (
    WarehouseId, TenantId, CompanyId, Code, Name, Description, WarehouseType,
    City, Province, CountryCode, AllowsNegativeInventory, IsDefault, IsTransit,
    IsVirtual, IsActive, CreatedBy
  )
  VALUES (
    @WarehouseId, @TenantId, @CompanyId, 'ALM-PRINCIPAL', 'Almacen Principal',
    'Almacen principal local de prueba', 'NORMAL', 'Santo Domingo',
    'Distrito Nacional', 'DOM', 0, 1, 0, 0, 1, @UserId
  );
END;

IF OBJECT_ID('inventory.Warehouses', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @TransitWarehouseId)
BEGIN
  INSERT INTO inventory.Warehouses (
    WarehouseId, TenantId, CompanyId, Code, Name, Description, WarehouseType,
    City, Province, CountryCode, AllowsNegativeInventory, IsDefault, IsTransit,
    IsVirtual, IsActive, CreatedBy
  )
  VALUES (
    @TransitWarehouseId, @TenantId, @CompanyId, 'ALM-TRANSITO', 'Almacen de Transito',
    'Almacen de transito local de prueba', 'TRANSIT', 'Santo Domingo',
    'Distrito Nacional', 'DOM', 0, 0, 1, 0, 1, @UserId
  );
END;

IF OBJECT_ID('crm.Customers', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM crm.Customers WHERE CustomerId = @CustomerId)
BEGIN
  INSERT INTO crm.Customers (
    CustomerId, TenantId, CompanyId, Code, Name, CommercialName, DocumentType,
    DocumentNumber, Email, Phone, City, Province, CountryCode, PaymentTermId,
    CurrencyId, TaxCategoryId, CreditLimit, IsCreditCustomer, IsActive, CreatedBy
  )
  VALUES (
    @CustomerId, @TenantId, @CompanyId, 'CLI-DEMO', 'Cliente Demo SRL', 'Cliente Demo',
    'RNC', '000000001', 'cliente.demo@dobles.local', '809-000-0001',
    'Santo Domingo', 'Distrito Nacional', 'DOM', @PaymentTermId, @CurrencyId,
    @TaxCategoryId, 50000, 1, 1, @UserId
  );
END;

IF OBJECT_ID('purchasing.Suppliers', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM purchasing.Suppliers WHERE SupplierId = @SupplierId)
BEGIN
  INSERT INTO purchasing.Suppliers (
    SupplierId, TenantId, CompanyId, Code, Name, CommercialName, DocumentType,
    DocumentNumber, Email, Phone, City, Province, CountryCode, PaymentTermId,
    CurrencyId, TaxCategoryId, IsTaxWithholder, IsForeignSupplier, ContactName,
    ContactEmail, ContactPhone, Notes, IsActive, CreatedBy
  )
  VALUES (
    @SupplierId, @TenantId, @CompanyId, 'SUP-DEMO', 'Proveedor Demo SRL', 'Proveedor Demo',
    'RNC', '000000002', 'proveedor.demo@dobles.local', '809-000-0002',
    'Santo Domingo', 'Distrito Nacional', 'DOM', @PaymentTermId, @CurrencyId,
    @TaxCategoryId, 0, 0, 'Contacto Demo', 'contacto.proveedor@dobles.local',
    '809-000-0003', 'Proveedor local de prueba', 1, @UserId
  );
END;

IF OBJECT_ID('inventory.Items', 'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM inventory.Items WHERE ItemId = @ItemId)
BEGIN
  INSERT INTO inventory.Items (
    ItemId, TenantId, CompanyId, Code, Description, ShortDescription, Barcode,
    AlternateCode, CategoryId, BrandId, UnitOfMeasureId, TaxCategoryId,
    DefaultWarehouseId,
    InventoryType, ItemType, AllowNegativeInventory, TrackInventory, TrackLot,
    TrackSerial, IsService, IsManufactured, CostMethod, StandardCost,
    AverageCost, LastCost, BasePrice, MinimumPrice, MaximumDiscountPercent,
    Weight, Volume, Notes, IsActive, CreatedBy
  )
  VALUES (
    @ItemId, @TenantId, @CompanyId, 'ART-DEMO', 'Articulo demo local',
    'Articulo demo', '000000000001', 'ART-ALT-DEMO', @CategoryId, @BrandId,
    @UnitId, @TaxCategoryId, @WarehouseId, 'PRODUCT', 'NORMAL', 0, 1, 0, 0, 0, 0,
    'AVERAGE', 100, 100, 100, 150, 120, 0, 0, 0, 'Articulo local de prueba',
    1, @UserId
  );
END;

IF OBJECT_ID('inventory.Items', 'U') IS NOT NULL
   AND COL_LENGTH('inventory.Items', 'DefaultWarehouseId') IS NOT NULL
   AND EXISTS (SELECT 1 FROM inventory.Items WHERE ItemId = @ItemId)
BEGIN
  UPDATE inventory.Items
  SET DefaultWarehouseId = COALESCE(DefaultWarehouseId, @WarehouseId),
      UpdatedBy = @UserId,
      UpdatedAt = SYSUTCDATETIME()
  WHERE ItemId = @ItemId;
END;

IF OBJECT_ID('inventory.ItemStocks', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM inventory.Items WHERE ItemId = @ItemId)
   AND EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @WarehouseId)
   AND NOT EXISTS (
     SELECT 1
     FROM inventory.ItemStocks
     WHERE TenantId = @TenantId
       AND CompanyId = @CompanyId
       AND ItemId = @ItemId
       AND WarehouseId = @WarehouseId
   )
BEGIN
  INSERT INTO inventory.ItemStocks (
    TenantId, CompanyId, ItemId, WarehouseId, QuantityOnHand,
    QuantityReserved, AverageCost, LastCost, StandardCost, IsActive, CreatedBy
  )
  SELECT
    @TenantId, @CompanyId, ItemId, @WarehouseId, 0,
    0, COALESCE(AverageCost, 0), COALESCE(LastCost, 0), COALESCE(StandardCost, 0), 1, @UserId
  FROM inventory.Items
  WHERE ItemId = @ItemId;
END;

IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.InventoryMovementLines', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM inventory.Items WHERE ItemId = @ItemId)
   AND EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @WarehouseId)
   AND NOT EXISTS (
     SELECT 1
     FROM inventory.InventoryMovements
     WHERE TenantId = @TenantId
       AND CompanyId = @CompanyId
       AND MovementNumber = 'MOV-DEMO-001'
   )
BEGIN
  INSERT INTO inventory.InventoryMovements (
    InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
    MovementDate, Status, SourceModule, SourceDocumentNumber, Reference,
    Notes, IsActive, CreatedBy
  )
  VALUES (
    @InventoryMovementId, @TenantId, @CompanyId, 'MOV-DEMO-001', 'OPENING',
    SYSUTCDATETIME(), 'DRAFT', 'LOCAL_SEED', NULL, 'Movimiento demo local',
    'Documento base para validar movimientos sin afectar existencias', 1, @UserId
  );

  INSERT INTO inventory.InventoryMovementLines (
    InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
    LineNumber, ItemId, WarehouseId, UnitOfMeasureId, Quantity, UnitCost,
    Notes, CreatedBy
  )
  VALUES (
    @InventoryMovementLineId, @InventoryMovementId, @TenantId, @CompanyId,
    1, @ItemId, @WarehouseId, @UnitId, 1, 0,
    'Linea demo local sin posteo de existencias', @UserId
  );
END;

IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.InventoryMovementLines', 'U') IS NOT NULL
   AND EXISTS (
     SELECT 1
     FROM inventory.InventoryMovements
     WHERE TenantId = @TenantId
       AND CompanyId = @CompanyId
       AND MovementNumber = 'MOV-DEMO-001'
   )
   AND NOT EXISTS (
     SELECT 1
     FROM inventory.InventoryMovementLines line
     INNER JOIN inventory.InventoryMovements movement
       ON movement.InventoryMovementId = line.InventoryMovementId
     WHERE movement.TenantId = @TenantId
       AND movement.CompanyId = @CompanyId
       AND movement.MovementNumber = 'MOV-DEMO-001'
       AND line.LineNumber = 1
   )
BEGIN
  INSERT INTO inventory.InventoryMovementLines (
    InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
    LineNumber, ItemId, WarehouseId, UnitOfMeasureId, Quantity, UnitCost,
    Notes, CreatedBy
  )
  SELECT
    @InventoryMovementLineId, movement.InventoryMovementId, @TenantId, @CompanyId,
    1, @ItemId, @WarehouseId, @UnitId, 1, 0,
    'Linea demo local sin posteo de existencias', @UserId
  FROM inventory.InventoryMovements movement
  WHERE movement.TenantId = @TenantId
    AND movement.CompanyId = @CompanyId
    AND movement.MovementNumber = 'MOV-DEMO-001';
END;

IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.InventoryMovementLines', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM inventory.Items WHERE ItemId = @ItemId)
   AND EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @WarehouseId)
   AND NOT EXISTS (
     SELECT 1
     FROM inventory.InventoryMovements
     WHERE TenantId = @TenantId
       AND CompanyId = @CompanyId
       AND MovementNumber = 'MOV-POST-QA-001'
   )
BEGIN
  INSERT INTO inventory.InventoryMovements (
    InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
    MovementDate, Status, SourceModule, SourceDocumentNumber, Reference,
    Notes, IsActive, CreatedBy
  )
  VALUES (
    @PostQaMovementId, @TenantId, @CompanyId, 'MOV-POST-QA-001', 'ADJUSTMENT_IN',
    SYSUTCDATETIME(), 'DRAFT', 'LOCAL_SEED', NULL, 'Movimiento QA posteable',
    'Movimiento demo para validar posteo manual controlado', 1, @UserId
  );

  INSERT INTO inventory.InventoryMovementLines (
    InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
    LineNumber, ItemId, WarehouseId, UnitOfMeasureId, Quantity, UnitCost,
    Notes, CreatedBy
  )
  VALUES (
    @PostQaMovementLineId, @PostQaMovementId, @TenantId, @CompanyId,
    1, @ItemId, @WarehouseId, @UnitId, 2, 100,
    'Linea QA posteable local', @UserId
  );
END;

IF OBJECT_ID('inventory.InventoryMovements', 'U') IS NOT NULL
   AND OBJECT_ID('inventory.InventoryMovementLines', 'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM inventory.Items WHERE ItemId = @ItemId)
   AND EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @WarehouseId)
   AND EXISTS (SELECT 1 FROM inventory.Warehouses WHERE WarehouseId = @TransitWarehouseId)
   AND NOT EXISTS (
     SELECT 1
     FROM inventory.InventoryMovements
     WHERE TenantId = @TenantId
       AND CompanyId = @CompanyId
       AND MovementNumber = 'MOV-TRANSFER-QA-001'
   )
BEGIN
  INSERT INTO inventory.InventoryMovements (
    InventoryMovementId, TenantId, CompanyId, MovementNumber, MovementType,
    MovementDate, Status, SourceModule, SourceDocumentNumber, Reference,
    Notes, IsActive, CreatedBy
  )
  VALUES (
    @TransferQaMovementId, @TenantId, @CompanyId, 'MOV-TRANSFER-QA-001', 'TRANSFER',
    SYSUTCDATETIME(), 'DRAFT', 'LOCAL_SEED', NULL, 'Movimiento QA transferible',
    'Movimiento demo para validar transferencia controlada sin posteo automatico', 1, @UserId
  );

  INSERT INTO inventory.InventoryMovementLines (
    InventoryMovementLineId, InventoryMovementId, TenantId, CompanyId,
    LineNumber, ItemId, WarehouseId, ToWarehouseId, UnitOfMeasureId, Quantity, UnitCost,
    Notes, CreatedBy
  )
  VALUES (
    @TransferQaMovementLineId, @TransferQaMovementId, @TenantId, @CompanyId,
    1, @ItemId, @WarehouseId, @TransitWarehouseId, @UnitId, 1, 0,
    'Linea QA transferible local', @UserId
  );
END;
GO
