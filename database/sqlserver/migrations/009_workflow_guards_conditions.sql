IF OBJECT_ID('workflow.Guards', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.Guards (
        WorkflowGuardId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_Guards_WorkflowGuardId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        TransitionId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(80) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        GuardType NVARCHAR(80) NOT NULL,
        FieldName NVARCHAR(160) NULL,
        ExpectedValue NVARCHAR(250) NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        ErrorMessage NVARCHAR(250) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_Guards_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_Guards_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_Guards PRIMARY KEY (WorkflowGuardId),
        CONSTRAINT FK_workflow_Guards_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_Guards_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_Guards_Transitions FOREIGN KEY (TransitionId)
            REFERENCES workflow.Transitions (WorkflowTransitionId),
        CONSTRAINT UQ_workflow_Guards_Tenant_Workflow_Transition_Code
            UNIQUE (TenantId, WorkflowDefinitionId, TransitionId, Code),
        CONSTRAINT CK_workflow_Guards_GuardType CHECK (
            GuardType IN (
                'REQUIRED_FIELD',
                'ENTITY_PROPERTY_EQUALS',
                'ENTITY_PROPERTY_NOT_EQUALS',
                'ENTITY_PROPERTY_MIN',
                'ENTITY_PROPERTY_MAX',
                'CUSTOM_PLACEHOLDER'
            )
        )
    );

    CREATE INDEX IX_workflow_Guards_Tenant_Workflow_Transition
        ON workflow.Guards (TenantId, WorkflowDefinitionId, TransitionId, IsActive);
END;
GO

IF OBJECT_ID('workflow.Conditions', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.Conditions (
        WorkflowConditionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_Conditions_WorkflowConditionId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        TransitionId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(80) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        ConditionType NVARCHAR(80) NOT NULL,
        FieldName NVARCHAR(160) NULL,
        Operator NVARCHAR(40) NULL,
        ExpectedValue NVARCHAR(250) NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_Conditions_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_Conditions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_Conditions PRIMARY KEY (WorkflowConditionId),
        CONSTRAINT FK_workflow_Conditions_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_Conditions_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_Conditions_Transitions FOREIGN KEY (TransitionId)
            REFERENCES workflow.Transitions (WorkflowTransitionId),
        CONSTRAINT UQ_workflow_Conditions_Tenant_Workflow_Transition_Code
            UNIQUE (TenantId, WorkflowDefinitionId, TransitionId, Code),
        CONSTRAINT CK_workflow_Conditions_ConditionType CHECK (
            ConditionType IN (
                'FIELD_EXISTS',
                'FIELD_EQUALS',
                'FIELD_NOT_EQUALS',
                'FIELD_GREATER_THAN',
                'FIELD_LESS_THAN',
                'CUSTOM_PLACEHOLDER'
            )
        )
    );

    CREATE INDEX IX_workflow_Conditions_Tenant_Workflow_Transition
        ON workflow.Conditions (TenantId, WorkflowDefinitionId, TransitionId, IsActive);
END;
GO
