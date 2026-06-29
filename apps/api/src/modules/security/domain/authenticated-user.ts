export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  companyId?: string;
  email: string;
  roles: string[];
};
