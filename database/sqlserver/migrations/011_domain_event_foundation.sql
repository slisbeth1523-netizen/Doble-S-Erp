IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'events')
BEGIN
    EXEC('CREATE SCHEMA events');
END;
GO

IF OBJECT_ID('events.DomainEvents', 'U') IS NULL
BEGIN
    CREATE TABLE events.DomainEvents (
        DomainEventId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_events_DomainEvents_DomainEventId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        EventName NVARCHAR(160) NOT NULL,
        EventType NVARCHAR(80) NOT NULL,
        SourceModule NVARCHAR(120) NOT NULL,
        SourceEntity NVARCHAR(160) NOT NULL,
        SourceEntityId NVARCHAR(120) NOT NULL,
        PayloadJson NVARCHAR(MAX) NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        Status NVARCHAR(40) NOT NULL
            CONSTRAINT DF_events_DomainEvents_Status DEFAULT ('PENDING'),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_events_DomainEvents_CreatedAt DEFAULT SYSUTCDATETIME(),
        ProcessedAt DATETIME2(7) NULL,
        FailedAt DATETIME2(7) NULL,
        ErrorMessage NVARCHAR(500) NULL,
        RetryCount INT NOT NULL
            CONSTRAINT DF_events_DomainEvents_RetryCount DEFAULT (0),
        RequestId NVARCHAR(80) NULL,
        CorrelationId NVARCHAR(80) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_events_DomainEvents PRIMARY KEY (DomainEventId),
        CONSTRAINT FK_events_DomainEvents_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_events_DomainEvents_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT CK_events_DomainEvents_Status CHECK (
            Status IN ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED')
        ),
        CONSTRAINT CK_events_DomainEvents_RetryCount CHECK (RetryCount >= 0)
    );

    CREATE INDEX IX_events_DomainEvents_Tenant_Status_CreatedAt
        ON events.DomainEvents (TenantId, Status, CreatedAt DESC);

    CREATE INDEX IX_events_DomainEvents_Tenant_EventName
        ON events.DomainEvents (TenantId, EventName, CreatedAt DESC);

    CREATE INDEX IX_events_DomainEvents_Source
        ON events.DomainEvents (TenantId, SourceModule, SourceEntity, SourceEntityId);

    CREATE INDEX IX_events_DomainEvents_CorrelationId
        ON events.DomainEvents (CorrelationId)
        WHERE CorrelationId IS NOT NULL;
END;
GO

IF OBJECT_ID('events.EventSubscriptions', 'U') IS NULL
BEGIN
    CREATE TABLE events.EventSubscriptions (
        EventSubscriptionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_events_EventSubscriptions_EventSubscriptionId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NULL,
        EventName NVARCHAR(160) NOT NULL,
        SubscriberModule NVARCHAR(120) NOT NULL,
        SubscriberName NVARCHAR(160) NOT NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_events_EventSubscriptions_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_events_EventSubscriptions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_events_EventSubscriptions PRIMARY KEY (EventSubscriptionId),
        CONSTRAINT FK_events_EventSubscriptions_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId)
    );

    CREATE UNIQUE INDEX UX_events_EventSubscriptions_Tenant_Event_Subscriber
        ON events.EventSubscriptions (TenantId, EventName, SubscriberModule, SubscriberName)
        WHERE TenantId IS NOT NULL;

    CREATE UNIQUE INDEX UX_events_EventSubscriptions_Global_Event_Subscriber
        ON events.EventSubscriptions (EventName, SubscriberModule, SubscriberName)
        WHERE TenantId IS NULL;

    CREATE INDEX IX_events_EventSubscriptions_Tenant_EventName
        ON events.EventSubscriptions (TenantId, EventName, IsActive);
END;
GO
