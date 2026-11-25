import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';

type AccessClaims = { sub: string; sid: string };
type AuthenticatedRequest = Request & { user?: AuthPrincipal };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Authentication is required.');

    try {
      const claims = await this.jwt.verifyAsync<AccessClaims>(token);
      if (!claims.sub || !claims.sid) throw new Error('Invalid access token.');
      const session = await this.database.refreshSession.findUnique({
        where: { id: claims.sid },
        select: {
          userId: true,
          revokedAt: true,
          user: {
            select: {
              status: true,
              roles: { select: { role: { select: { code: true, permissions: { select: { permission: { select: { code: true } } } } } } } },
            },
          },
        },
      });
      if (!session || session.revokedAt || session.userId !== claims.sub || session.user.status !== 'ACTIVE') {
        throw new Error('Session is not active.');
      }
      const roleGrants = session.user.roles.map((item) => item.role);
      request.user = {
        id: claims.sub,
        sessionId: claims.sid,
        roles: roleGrants.map((role) => role.code),
        permissions: [...new Set(roleGrants.flatMap((role) => role.permissions.map((entry) => entry.permission.code)))],
      };
      return true;
    } catch {
      throw new UnauthorizedException('Your session is invalid or expired. Please sign in again.');
    }
  }
}
