import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  write(input: {
    actorId?: string | null;
    action: string;
    targetType: string;
    targetId?: string | null;
    requestId?: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.database.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        requestId: input.requestId,
        metadata: input.metadata,
      },
    });
  }
}
