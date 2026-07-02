export type AuthenticatedUser = {
  userId: string;
  tenantId: string;
  companyId?: string;
  jwtId: string;
  email: string;
  roles: string[];
};
