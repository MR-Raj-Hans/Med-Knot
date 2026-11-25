import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseService } from '../database/database.service.js';
import { RedisService } from '../redis/redis.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService, private readonly redis: RedisService) {}

  @Get('live')
  @ApiOperation({ summary: 'Process liveness probe' })
  live() { return { status: 'ok', service: 'medknot-api', timestamp: new Date().toISOString() }; }

  @Get('ready')
  @ApiOperation({ summary: 'Database and Redis readiness probe' })
  async ready() {
    const [database, redis] = await Promise.all([
      this.database.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      this.redis.check(),
    ]);
    const status = database && redis ? 'ok' : 'unavailable';
    if (status !== 'ok') throw new ServiceUnavailableException({ status, checks: { database, redis } });
    return { status, checks: { database, redis }, timestamp: new Date().toISOString() };
  }
}
