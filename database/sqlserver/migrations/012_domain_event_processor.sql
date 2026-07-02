IF COL_LENGTH('events.DomainEvents', 'LockedAt') IS NULL
BEGIN
    ALTER TABLE events.DomainEvents
        ADD LockedAt DATETIME2(7) NULL;
END;
GO

IF COL_LENGTH('events.DomainEvents', 'LockedBy') IS NULL
BEGIN
    ALTER TABLE events.DomainEvents
        ADD LockedBy NVARCHAR(120) NULL;
END;
GO

IF COL_LENGTH('events.DomainEvents', 'NextAttemptAt') IS NULL
BEGIN
    ALTER TABLE events.DomainEvents
        ADD NextAttemptAt DATETIME2(7) NULL;
END;
GO

IF COL_LENGTH('events.DomainEvents', 'LastAttemptAt') IS NULL
BEGIN
    ALTER TABLE events.DomainEvents
        ADD LastAttemptAt DATETIME2(7) NULL;
END;
GO

IF COL_LENGTH('events.DomainEvents', 'MaxRetries') IS NULL
BEGIN
    ALTER TABLE events.DomainEvents
        ADD MaxRetries INT NOT NULL
            CONSTRAINT DF_events_DomainEvents_MaxRetries DEFAULT (3);
END;
GO

DECLARE @StatusConstraintName SYSNAME;

SELECT @StatusConstraintName = cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('events.DomainEvents')
  AND cc.definition LIKE '%Status%'
  AND cc.definition LIKE '%PENDING%';

IF @StatusConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE events.DomainEvents DROP CONSTRAINT ' + QUOTENAME(@StatusConstraintName));
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('events.DomainEvents')
      AND name = 'CK_events_DomainEvents_Status'
)
BEGIN
    ALTER TABLE events.DomainEvents
        ADD CONSTRAINT CK_events_DomainEvents_Status CHECK (
            Status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED')
        );
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('events.DomainEvents')
      AND name = 'CK_events_DomainEvents_MaxRetries'
)
BEGIN
    ALTER TABLE events.DomainEvents
        ADD CONSTRAINT CK_events_DomainEvents_MaxRetries CHECK (MaxRetries >= 1);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('events.DomainEvents')
      AND name = 'IX_events_DomainEvents_Pending_Lock'
)
BEGIN
    CREATE INDEX IX_events_DomainEvents_Pending_Lock
        ON events.DomainEvents (TenantId, Status, NextAttemptAt, LockedAt, CreatedAt)
        INCLUDE (EventName, RetryCount, MaxRetries);
END;
GO
