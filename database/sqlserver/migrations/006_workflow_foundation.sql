IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'workflow')
BEGIN
    EXEC('CREATE SCHEMA workflow');
END;
GO

IF OBJECT_ID('workflow.Definitions', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.Definitions (
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_Definitions_WorkflowDefinitionId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(80) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_Definitions_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_Definitions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_Definitions PRIMARY KEY (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_Definitions_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT UQ_workflow_Definitions_Tenant_Code UNIQUE (TenantId, Code)
    );

    CREATE INDEX IX_workflow_Definitions_Tenant_Active
        ON workflow.Definitions (TenantId, IsActive);
END;
GO

IF OBJECT_ID('workflow.States', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.States (
        WorkflowStateId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_States_WorkflowStateId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(80) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_States_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_States_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_States PRIMARY KEY (WorkflowStateId),
        CONSTRAINT FK_workflow_States_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_States_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT UQ_workflow_States_Tenant_Definition_Code UNIQUE (TenantId, WorkflowDefinitionId, Code)
    );

    CREATE INDEX IX_workflow_States_Tenant_Definition_Active
        ON workflow.States (TenantId, WorkflowDefinitionId, IsActive);
END;
GO

IF OBJECT_ID('workflow.Transitions', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.Transitions (
        WorkflowTransitionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_Transitions_WorkflowTransitionId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        FromStateId UNIQUEIDENTIFIER NOT NULL,
        ToStateId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(80) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_Transitions_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_Transitions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_Transitions PRIMARY KEY (WorkflowTransitionId),
        CONSTRAINT FK_workflow_Transitions_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_Transitions_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_Transitions_FromStates FOREIGN KEY (FromStateId)
            REFERENCES workflow.States (WorkflowStateId),
        CONSTRAINT FK_workflow_Transitions_ToStates FOREIGN KEY (ToStateId)
            REFERENCES workflow.States (WorkflowStateId),
        CONSTRAINT CK_workflow_Transitions_DifferentStates CHECK (FromStateId <> ToStateId),
        CONSTRAINT UQ_workflow_Transitions_Tenant_Definition_Code UNIQUE (TenantId, WorkflowDefinitionId, Code)
    );

    CREATE INDEX IX_workflow_Transitions_Tenant_Definition_Active
        ON workflow.Transitions (TenantId, WorkflowDefinitionId, IsActive);

    CREATE INDEX IX_workflow_Transitions_From_To
        ON workflow.Transitions (TenantId, WorkflowDefinitionId, FromStateId, ToStateId);
END;
GO
