export type WorkflowDefinition = {
  workflowDefinitionId: string;
  tenantId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type WorkflowState = {
  workflowStateId: string;
  tenantId: string;
  workflowDefinitionId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type WorkflowTransition = {
  workflowTransitionId: string;
  tenantId: string;
  workflowDefinitionId: string;
  fromStateId: string;
  toStateId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type WorkflowContext = {
  tenantId: string;
  companyId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
};

export type WorkflowDefinitionCreateInput = {
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
};

export type WorkflowStateCreateInput = WorkflowDefinitionCreateInput;

export type WorkflowTransitionCreateInput = WorkflowDefinitionCreateInput & {
  fromStateId: string;
  toStateId: string;
};

export type WorkflowEntityState = {
  entityStateId: string;
  tenantId: string;
  companyId?: string | null;
  workflowDefinitionId: string;
  entityName: string;
  entityId: string;
  currentStateId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type WorkflowExecutionRequest = {
  workflowDefinitionId: string;
  entityName: string;
  entityId: string;
  transitionId: string;
  comment?: string | null;
};

export type WorkflowTransitionExecutionContext = WorkflowContext & {
  workflowDefinitionId: string;
  entityName: string;
  entityId: string;
};

export type WorkflowExecutionResult = {
  entityState: WorkflowEntityState;
  previousStateId: string;
  newStateId: string;
  transition: WorkflowTransition;
};

export type WorkflowHistoryEntry = {
  workflowHistoryId: string;
  tenantId: string;
  companyId?: string | null;
  workflowDefinitionId: string;
  entityStateId: string;
  entityName: string;
  entityId: string;
  transitionId?: string | null;
  fromStateId?: string | null;
  toStateId: string;
  actionCode: string;
  comment?: string | null;
  metadataJson?: string | null;
  createdAt: Date;
  createdBy?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
};

export type WorkflowHistoryCreateInput = {
  tenantId: string;
  companyId?: string | null;
  workflowDefinitionId: string;
  entityStateId: string;
  entityName: string;
  entityId: string;
  transitionId?: string | null;
  fromStateId?: string | null;
  toStateId: string;
  actionCode: "WORKFLOW_INITIALIZED" | "WORKFLOW_TRANSITION_EXECUTED";
  comment?: string | null;
  metadata?: Record<string, unknown>;
  createdBy?: string;
  requestId?: string;
  correlationId?: string;
};

export type WorkflowHistoryQuery = {
  tenantId: string;
  workflowDefinitionId?: string;
  entityStateId?: string;
  entityName?: string;
  entityId?: string;
  page: number;
  pageSize: number;
  offset: number;
  from?: string;
  to?: string;
};

export type WorkflowHistoryListResult = {
  items: WorkflowHistoryEntry[];
  totalItems: number;
};
