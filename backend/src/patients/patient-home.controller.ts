import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { DatabaseService } from '../database/database.service.js';

@ApiTags('patient')
@ApiBearerAuth()
@AccessPolicy({ roles: ['patient'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('patient')
export class PatientHomeController {
  constructor(private readonly database: DatabaseService) {}

  @Get('home')
  async home(@CurrentUser() user: AuthPrincipal) {
    const patient = await this.database.user.findUnique({
      where: { id: user.id, status: 'ACTIVE' },
      select: { fullName: true, patientProfile: { select: { id: true } } },
    });
    if (!patient?.patientProfile) throw new NotFoundException('Patient profile not found.');
    const patientProfileId = patient.patientProfile.id;
    const now = new Date();
    const summary = await this.database.$transaction(async (tx) => {
      const [appointment, prescriptionCount] = await Promise.all([
        tx.appointment.findFirst({
          where: { patientProfileId, status: 'CONFIRMED', slot: { startAt: { gt: now } } },
          select: {
            id: true,
            slot: { select: { startAt: true, endAt: true, timezone: true } },
            doctorProfile: { select: { user: { select: { fullName: true } }, specialty: { select: { name: true } }, hospital: { select: { name: true } } } },
          },
          orderBy: { slot: { startAt: 'asc' } },
        }),
        tx.prescription.count({ where: { patientProfileId, status: 'RELEASED' } }),
      ]);
      await tx.auditLog.create({ data: { actorId: user.id, action: 'patient.home.viewed', targetType: 'PatientProfile', targetId: patientProfileId } });
      return { appointment, prescriptionCount };
    });
    const slot = summary.appointment?.slot;
    return {
      patientName: patient.fullName,
      nextAppointment: slot && summary.appointment ? {
        id: summary.appointment.id,
        doctorName: summary.appointment.doctorProfile.user.fullName,
        specialty: summary.appointment.doctorProfile.specialty.name,
        dateLabel: new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: slot.timezone }).format(slot.startAt),
        timeLabel: new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: slot.timezone }).format(slot.startAt),
        location: summary.appointment.doctorProfile.hospital.name,
        status: 'confirmed' as const,
      } : null,
      prescriptionCount: summary.prescriptionCount,
      followUpLabel: null,
    };
  }
}
