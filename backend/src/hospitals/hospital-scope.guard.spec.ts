import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { HospitalScopeGuard } from './hospital-scope.guard.js';
import type { AuthPrincipal } from '../common/auth-principal.js';

function context(user?: AuthPrincipal, hospitalId = 'hospital-a') {
  return { switchToHttp: () => ({ getRequest: () => ({ params: { hospitalId }, user }) }) } as unknown as ExecutionContext;
}

describe('HospitalScopeGuard', () => {
  it('allows a global administrator with the global hospital permission', async () => {
    const hospitals = { hasActiveMembership: async () => false };
    const guard = new HospitalScopeGuard(hospitals as never);
    const admin: AuthPrincipal = { id: 'admin', sessionId: 'session', roles: ['admin'], permissions: ['hospital:manage:any'] };

    await expect(guard.canActivate(context(admin))).resolves.toBe(true);
  });

  it('allows a hospital administrator only for an active membership', async () => {
    const hospitals = { hasActiveMembership: async (_userId: string, hospitalId: string) => hospitalId === 'hospital-a' };
    const guard = new HospitalScopeGuard(hospitals as never);
    const admin: AuthPrincipal = { id: 'manager', sessionId: 'session', roles: ['hospital_admin'], permissions: ['hospital:manage:scoped'] };

    await expect(guard.canActivate(context(admin, 'hospital-a'))).resolves.toBe(true);
    await expect(guard.canActivate(context(admin, 'hospital-b'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies a patient even when a membership row exists', async () => {
    const hospitals = { hasActiveMembership: async () => true };
    const guard = new HospitalScopeGuard(hospitals as never);
    const patient: AuthPrincipal = { id: 'patient', sessionId: 'session', roles: ['patient'], permissions: [] };

    await expect(guard.canActivate(context(patient))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
