export type DomainEventStatus = "PENDING" | "PROCESSED" | "FAILED" | "IGNORED";

export type EventContext = {
  tenantId: string;
  companyId?: string | null;
  userId?: string;
  requestId?: string;
  correlationId?: string;
};

export type DomainEvent = {
  domainEventId: string;
  tenantId: string;
  companyId?: string | null;
  eventName: string;
  eventType: string;
  sourceModule: string;
  sourceEntity: string;
  sourceEntityId: string;
  payloadJson?: string | null;
  metadataJson?: string | null;
  status: DomainEventStatus;
  createdAt: Date;
  processedAt?: Date | null;
  failedAt?: Date | null;
  errorMessage?: string | null;
  retryCount: number;
  requestId?: string | null;
  correlationId?: string | null;
  createdBy?: string | null;
};

export type DomainEventCreateInput = {
  tenantId: string;
  companyId?: string | null;
  eventName: string;
  eventType: string;
  sourceModule: string;
  sourceEntity: string;
  sourceEntityId: string;
  payload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: DomainEventStatus;
  requestId?: string;
  correlationId?: string;
  createdBy?: string;
};

export type DomainEventPublishInput = Omit<
  DomainEventCreateInput,
  "tenantId" | "companyId" | "requestId" | "correlationId" | "createdBy" | "status"
> & {
  companyId?: string | null;
};

export type DomainEventQuery = {
  tenantId: string;
  eventName?: string;
  status?: DomainEventStatus;
  sourceModule?: string;
  page: number;
  pageSize: number;
  offset: number;
};

export type DomainEventListResult = {
  items: DomainEvent[];
  totalItems: number;
};

export type EventSubscription = {
  eventSubscriptionId: string;
  tenantId?: string | null;
  eventName: string;
  subscriberModule: string;
  subscriberName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt?: Date | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type EventSubscriptionCreateInput = {
  tenantId?: string | null;
  eventName: string;
  subscriberModule: string;
  subscriberName: string;
  isActive?: boolean;
};
