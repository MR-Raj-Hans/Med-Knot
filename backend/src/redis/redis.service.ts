import { Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.getOrThrow<string>('REDIS_URL'), {
      lazyConnect: true,
      connectTimeout: 3_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  async onModuleInit() { await this.client.connect(); }
  async onModuleDestroy() { await this.client.quit(); }
  async check() { try { return (await this.client.ping()) === 'PONG'; } catch { return false; } }

  async hitRateLimit(key: string, windowSeconds: number) {
    try {
      return Number(await this.client.eval(
        "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
        1,
        key,
        windowSeconds,
      ));
    } catch {
      throw new ServiceUnavailableException('Authentication protection is temporarily unavailable.');
    }
  }
}
