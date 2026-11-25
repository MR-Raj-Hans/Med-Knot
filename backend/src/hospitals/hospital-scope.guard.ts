import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { HospitalsService } from './hospitals.service.js';

type ScopedRequest = Request & { user?: AuthPrincipal };

@Injectable()
export class HospitalScopeGuard implements CanActivate {
  constructor(private readonly hospitals: HospitalsService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ScopedRequest>();
    const hospitalId = request.params.hospitalId;
    if (request.user?.roles.includes('admin') && request.user.permissions.includes('hospital:manage:any')) return true;
    if (!request.user?.roles.includes('hospital_admin') || !request.user.permissions.includes('hospital:manage:scoped') || typeof hospitalId !== 'string' || !await this.hospitals.hasActiveMembership(request.user.id, hospitalId)) {
      throw new ForbiddenException('You do not have access to this hospital.');
    }
    return true;
  }
}
