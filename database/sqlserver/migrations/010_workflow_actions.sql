IF OBJECT_ID('workflow.Actions', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.Actions (
        WorkflowActionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_Actions_WorkflowActionId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        TransitionId UNIQUEIDENTIFIER NOT NULL,
        Code NVARCHAR(80) NOT NULL,
        Name NVARCHAR(160) NOT NULL,
        Description NVARCHAR(250) NULL,
        ActionType NVARCHAR(80) NOT NULL,
        ExecutionMode NVARCHAR(80) NOT NULL,
        TargetModule NVARCHAR(120) NULL,
        TargetAction NVARCHAR(120) NULL,
        PayloadTemplateJson NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_Actions_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_Actions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_Actions PRIMARY KEY (WorkflowActionId),
        CONSTRAINT FK_workflow_Actions_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_Actions_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_Actions_Transitions FOREIGN KEY (TransitionId)
            REFERENCES workflow.Transitions (WorkflowTransitionId),
        CONSTRAINT UQ_workflow_Actions_Tenant_Workflow_Transition_Code
            UNIQUE (TenantId, WorkflowDefinitionId, TransitionId, Code),
        CONSTRAINT CK_workflow_Actions_ActionType CHECK (
            ActionType IN (
                'AUDIT',
                'NOTIFICATION_PLACEHOLDER',
                'DOMAIN_EVENT_PLACEHOLDER',
                'JOB_PLACEHOLDER',
                'WEBHOOK_PLACEHOLDER',
                'CUSTOM_PLACEHOLDER'
            )
        ),
        CONSTRAINT CK_workflow_Actions_ExecutionMode CHECK (
            ExecutionMode IN ('AFTER_TRANSITION', 'MANUAL', 'ASYNC_PLACEHOLDER')
        )
    );

    CREATE INDEX IX_workflow_Actions_Tenant_Workflow_Transition
        ON workflow.Actions (TenantId, WorkflowDefinitionId, TransitionId, IsActive);
END;
GO

IF OBJECT_ID('workflow.ActionExecutions', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.ActionExecutions (
        WorkflowActionExecutionId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_ActionExecutions_WorkflowActionExecutionId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        WorkflowActionId UNIQUEIDENTIFIER NOT NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        TransitionId UNIQUEIDENTIFIER NOT NULL,
        EntityStateId UNIQUEIDENTIFIER NOT NULL,
        EntityName NVARCHAR(160) NOT NULL,
        EntityId NVARCHAR(120) NOT NULL,
        Status NVARCHAR(40) NOT NULL,
        ActionType NVARCHAR(80) NOT NULL,
        ExecutionMode NVARCHAR(80) NOT NULL,
        PayloadJson NVARCHAR(MAX) NULL,
        ResultJson NVARCHAR(MAX) NULL,
        ErrorMessage NVARCHAR(500) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_ActionExecutions_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        RequestId NVARCHAR(80) NULL,
        CorrelationId NVARCHAR(80) NULL,
        CONSTRAINT PK_workflow_ActionExecutions PRIMARY KEY (WorkflowActionExecutionId),
        CONSTRAINT FK_workflow_ActionExecutions_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_ActionExecutions_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_workflow_ActionExecutions_Actions FOREIGN KEY (WorkflowActionId)
            REFERENCES workflow.Actions (WorkflowActionId),
        CONSTRAINT FK_workflow_ActionExecutions_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_ActionExecutions_Transitions FOREIGN KEY (TransitionId)
            REFERENCES workflow.Transitions (WorkflowTransitionId),
        CONSTRAINT FK_workflow_ActionExecutions_EntityStates FOREIGN KEY (EntityStateId)
            REFERENCES workflow.EntityStates (EntityStateId),
        CONSTRAINT CK_workflow_ActionExecutions_Status CHECK (
            Status IN ('PENDING', 'PREPARED', 'SKIPPED', 'FAILED')
        ),
        CONSTRAINT CK_workflow_ActionExecutions_ActionType CHECK (
            ActionType IN (
                'AUDIT',
                'NOTIFICATION_PLACEHOLDER',
                'DOMAIN_EVENT_PLACEHOLDER',
                'JOB_PLACEHOLDER',
                'WEBHOOK_PLACEHOLDER',
                'CUSTOM_PLACEHOLDER'
            )
        ),
        CONSTRAINT CK_workflow_ActionExecutions_ExecutionMode CHECK (
            ExecutionMode IN ('AFTER_TRANSITION', 'MANUAL', 'ASYNC_PLACEHOLDER')
        )
    );

    CREATE INDEX IX_workflow_ActionExecutions_Tenant_Entity
        ON workflow.ActionExecutions (TenantId, EntityName, EntityId, CreatedAt DESC);

    CREATE INDEX IX_workflow_ActionExecutions_Action
        ON workflow.ActionExecutions (TenantId, WorkflowActionId, CreatedAt DESC);

    CREATE INDEX IX_workflow_ActionExecutions_Status
        ON workflow.ActionExecutions (TenantId, Status, CreatedAt DESC);

    CREATE INDEX IX_workflow_ActionExecutions_CreatedAt
        ON workflow.ActionExecutions (CreatedAt DESC);
END;
GO
