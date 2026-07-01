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
