import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthPrincipal } from './auth-principal.js';
import { ACCESS_POLICY_KEY, type AccessPolicy } from './access-policy.decorator.js';

@Injectable()
export class AccessPolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const policy = this.reflector.getAllAndOverride<AccessPolicy>(ACCESS_POLICY_KEY, [context.getHandler(), context.getClass()]);
    if (!policy) return true;
    const user = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>().user;
    if (!user) throw new ForbiddenException('An authenticated account is required.');
    if (policy.roles?.length && !policy.roles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException('Your account role does not allow this action.');
    }
    if (policy.permissions?.length && !policy.permissions.every((permission) => user.permissions.includes(permission))) {
      throw new ForbiddenException('Your account permissions do not allow this action.');
    }
    return true;
  }
}
