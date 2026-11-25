import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { AuthRateLimitGuard } from './auth-rate-limit.guard.js';
import type { RedisService } from '../redis/redis.service.js';

function executionContext(request: object) {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

describe('AuthRateLimitGuard', () => {
  const config = { get: (_key: string, fallback: number) => fallback };

  it('checks both the caller IP and normalized account identity', async () => {
    const calls: string[] = [];
    const redis = { hitRateLimit: async (key: string) => { calls.push(key); return 1; } } as unknown as RedisService;
    const guard = new AuthRateLimitGuard(redis, config as never);
    const request = { route: { path: '/login' }, path: '/auth/login', ip: '127.0.0.1', body: { email: 'PATIENT@example.test' } };

    await expect(guard.canActivate(executionContext(request))).resolves.toBe(true);
    expect(calls).toHaveLength(2);
  });

  it('rejects requests that exceed the configured limit', async () => {
    const values = [1, 11];
    const redis = { hitRateLimit: async () => values.shift() ?? 0 } as unknown as RedisService;
    const guard = new AuthRateLimitGuard(redis, config as never);
    const request = { route: { path: '/login' }, path: '/auth/login', ip: '127.0.0.1', body: { email: 'patient@example.test' } };

    await expect(guard.canActivate(executionContext(request))).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
  });

  it('fails closed when Redis is unavailable', async () => {
    const redis = { hitRateLimit: async () => { throw new Error('Redis offline'); } } as unknown as RedisService;
    const guard = new AuthRateLimitGuard(redis, config as never);
    const request = { route: { path: '/login' }, path: '/auth/login', ip: '127.0.0.1', body: { email: 'patient@example.test' } };

    await expect(guard.canActivate(executionContext(request))).rejects.toThrow('Redis offline');
  });
});
