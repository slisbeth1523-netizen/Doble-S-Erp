IF OBJECT_ID('workflow.EntityStates', 'U') IS NULL
BEGIN
    CREATE TABLE workflow.EntityStates (
        EntityStateId UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_workflow_EntityStates_EntityStateId DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        CompanyId UNIQUEIDENTIFIER NULL,
        WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
        EntityName NVARCHAR(160) NOT NULL,
        EntityId NVARCHAR(120) NOT NULL,
        CurrentStateId UNIQUEIDENTIFIER NOT NULL,
        IsActive BIT NOT NULL
            CONSTRAINT DF_workflow_EntityStates_IsActive DEFAULT (1),
        CreatedAt DATETIME2(7) NOT NULL
            CONSTRAINT DF_workflow_EntityStates_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2(7) NULL,
        CreatedBy UNIQUEIDENTIFIER NULL,
        UpdatedBy UNIQUEIDENTIFIER NULL,
        CONSTRAINT PK_workflow_EntityStates PRIMARY KEY (EntityStateId),
        CONSTRAINT FK_workflow_EntityStates_Tenants FOREIGN KEY (TenantId)
            REFERENCES core.Tenants (TenantId),
        CONSTRAINT FK_workflow_EntityStates_Companies FOREIGN KEY (CompanyId)
            REFERENCES core.Companies (CompanyId),
        CONSTRAINT FK_workflow_EntityStates_Definitions FOREIGN KEY (WorkflowDefinitionId)
            REFERENCES workflow.Definitions (WorkflowDefinitionId),
        CONSTRAINT FK_workflow_EntityStates_CurrentStates FOREIGN KEY (CurrentStateId)
            REFERENCES workflow.States (WorkflowStateId)
    );

    CREATE INDEX IX_workflow_EntityStates_Tenant_Entity
        ON workflow.EntityStates (TenantId, EntityName, EntityId);

    CREATE UNIQUE INDEX UX_workflow_EntityStates_Active_Entity
        ON workflow.EntityStates (TenantId, EntityName, EntityId)
        WHERE IsActive = 1;

    CREATE INDEX IX_workflow_EntityStates_Tenant_Workflow_State
        ON workflow.EntityStates (TenantId, WorkflowDefinitionId, CurrentStateId, IsActive);
END;
GO
