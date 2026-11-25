import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class HospitalsService {
  constructor(private readonly database: DatabaseService) {}

  hasActiveMembership(userId: string, hospitalId: string) {
    return this.database.hospitalMembership.findUnique({
      where: { userId_hospitalId: { userId, hospitalId } },
      select: { status: true },
    }).then((membership) => membership?.status === 'ACTIVE');
  }
}
