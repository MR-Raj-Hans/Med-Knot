import { Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';

@ApiTags('patients')
@ApiBearerAuth()
@AccessPolicy({ roles: ['patient'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly database: DatabaseService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthPrincipal) {
    const profile = await this.database.patientProfile.findUnique({
      where: { userId: user.id },
      include: { user: { select: { fullName: true, email: true, phone: true, createdAt: true } } },
    });
    if (!profile) throw new NotFoundException('Patient profile not found.');
    return { id: profile.id, fullName: profile.user.fullName, email: profile.user.email, phone: profile.user.phone, createdAt: profile.createdAt };
  }

  @Get(':patientId')
  async getPatient(@Param('patientId', new ParseUUIDPipe({ version: '4' })) patientId: string, @CurrentUser() user: AuthPrincipal) {
    const profile = await this.database.patientProfile.findUnique({
      where: { id: patientId },
      include: { user: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true } } },
    });
    if (!profile) throw new NotFoundException('Patient profile not found.');
    if (profile.user.id !== user.id) throw new ForbiddenException('You do not have access to this patient profile.');
    return { id: profile.id, fullName: profile.user.fullName, email: profile.user.email, phone: profile.user.phone, createdAt: profile.createdAt };
  }
}
