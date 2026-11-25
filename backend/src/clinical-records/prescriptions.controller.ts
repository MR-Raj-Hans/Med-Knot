import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { PrescriptionsService } from './prescriptions.service.js';

type RequestWithId = Request & { id?: string };

@ApiTags('prescriptions')
@ApiBearerAuth()
@AccessPolicy({ roles: ['patient'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('prescriptions')
export class PatientPrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Get()
  list(@CurrentUser() user: AuthPrincipal) { return this.prescriptions.listPatientPrescriptions(user.id); }

  @Get(':prescriptionId')
  get(@Param('prescriptionId', new ParseUUIDPipe({ version: '4' })) prescriptionId: string, @CurrentUser() user: AuthPrincipal) {
    return this.prescriptions.getPatientPrescription(user.id, prescriptionId);
  }
}

@ApiTags('clinician prescriptions')
@ApiBearerAuth()
@Controller('clinician')
export class ClinicianPrescriptionsController {
  constructor(private readonly prescriptions: PrescriptionsService) {}

  @Post('hospitals/:hospitalId/appointments/:appointmentId/prescriptions')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  @ApiOperation({ summary: 'Create an encrypted prescription draft linked to the clinician’s completed visit' })
  createDraft(
    @Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreatePrescriptionDto,
    @Req() request: RequestWithId,
  ) {
    return this.prescriptions.createClinicianDraft(hospitalId, appointmentId, user.id, dto, request.id);
  }

  @Post('hospitals/:hospitalId/prescriptions/:prescriptionId/release')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  releaseDraft(
    @Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string,
    @Param('prescriptionId', new ParseUUIDPipe({ version: '4' })) prescriptionId: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() request: RequestWithId,
  ) {
    return this.prescriptions.releaseClinicianDraft(hospitalId, prescriptionId, user.id, request.id);
  }
}
