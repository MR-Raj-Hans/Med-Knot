import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AccessPolicyGuard } from './access-policy.guard.js';
import type { AuthPrincipal } from './auth-principal.js';

function context(user?: AuthPrincipal) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AccessPolicyGuard', () => {
  it('allows a principal with the required role and permissions', () => {
    const reflector = { getAllAndOverride: () => ({ roles: ['patient'], permissions: ['patient:read:self'] }) };
    const guard = new AccessPolicyGuard(reflector as never);
    const patient: AuthPrincipal = { id: 'user-id', sessionId: 'session-id', roles: ['patient'], permissions: ['patient:read:self'] };
    expect(guard.canActivate(context(patient))).toBe(true);
  });

  it('denies a principal without the required role', () => {
    const reflector = { getAllAndOverride: () => ({ roles: ['admin'] }) };
    const guard = new AccessPolicyGuard(reflector as never);
    const patient: AuthPrincipal = { id: 'user-id', sessionId: 'session-id', roles: ['patient'], permissions: [] };
    expect(() => guard.canActivate(context(patient))).toThrow(ForbiddenException);
  });
});
