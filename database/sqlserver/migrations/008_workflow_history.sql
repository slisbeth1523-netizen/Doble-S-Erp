IF OBJECT_ID('workflow.History', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.History (
        WorkflowHistoryId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_History_WorkflowHistoryId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        EntityStateId UNIQUEIDENTIFIER NOT NULL,
        EntityName NVARCHAR(160) NOT NULL,
        EntityId NVARCHAR(120) NOT NULL,
        TransitionId UNIQUEIDENTIFIER NULL,
        FromStateId UNIQUEIDENTIFIER NULL,
        ToStateId UNIQUEIDENTIFIER NOT NULL,
        ActionCode NVARCHAR(80) NOT NULL,
        Comment NVARCHAR(500) NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_History_CreatedAt DEFAULT SYSUTCDATETIME(),
        CreatedBy UNIQUEIDENTIFIER NULL,
        RequestId NVARCHAR(80) NULL,
        CorrelationId NVARCHAR(80) NULL,
        CONSTRAINT PK_workflow_History PRIMARY KEY (WorkflowHistoryId),
        CONSTRAINT FK_workflow_History_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_History_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_workflow_History_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_History_EntityStates FOREIGN KEY (EntityStateId)
            REFERENCES workflow.EntityStates (EntityStateId),
        CONSTRAINT FK_workflow_History_Transitions FOREIGN KEY (TransitionId)
            REFERENCES workflow.Transitions (WorkflowTransitionId),
        CONSTRAINT FK_workflow_History_FromStates FOREIGN KEY (FromStateId)
            REFERENCES workflow.States (WorkflowStateId),
        CONSTRAINT FK_workflow_History_ToStates FOREIGN KEY (ToStateId)
            REFERENCES workflow.States (WorkflowStateId)
    );

    CREATE INDEX IX_workflow_History_Tenant_Entity
        ON workflow.History (TenantId, EntityName, EntityId, CreatedAt DESC);

    CREATE INDEX IX_workflow_History_WorkflowDefinition
        ON workflow.History (TenantId, WorkflowDefinitionId, CreatedAt DESC);

    CREATE INDEX IX_workflow_History_EntityState
        ON workflow.History (TenantId, EntityStateId, CreatedAt DESC);

    CREATE INDEX IX_workflow_History_CreatedAt
        ON workflow.History (CreatedAt DESC);
END;
GO
