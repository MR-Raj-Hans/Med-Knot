import { createHash } from 'node:crypto';
import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { RedisService } from '../redis/redis.service.js';

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService, private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { id?: string }>();
    const windowSeconds = this.config.get<number>('RATE_LIMIT_WINDOW_SECONDS', 60);
    const maxRequests = this.config.get<number>('RATE_LIMIT_MAX_REQUESTS', 10);
    const route = request.route?.path ?? request.path;
    const identity = String((request.body as Record<string, unknown> | undefined)?.email ?? (request.body as Record<string, unknown> | undefined)?.challengeId ?? '');
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    const counts = await Promise.all([
      this.redis.hitRateLimit(`auth:ip:${hash(`${route}:${request.ip ?? 'unknown'}`)}`, windowSeconds),
      ...(identity ? [this.redis.hitRateLimit(`auth:identity:${hash(`${route}:${identity.toLowerCase()}`)}`, windowSeconds)] : []),
    ]);
    if (counts.some((count) => count > maxRequests)) throw new HttpException('Too many authentication attempts. Please wait and try again.', HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}
