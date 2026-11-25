export type AuthPrincipal = {
  id: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
};
