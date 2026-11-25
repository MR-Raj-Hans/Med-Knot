import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { ClinicalRecordsService } from './clinical-records.service.js';
import { CreateClinicalNoteDto } from './dto/create-clinical-note.dto.js';

type RequestWithId = Request & { id?: string };

@ApiTags('clinical records')
@ApiBearerAuth()
@AccessPolicy({ roles: ['patient'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('clinical-records')
export class PatientClinicalRecordsController {
  constructor(private readonly records: ClinicalRecordsService) {}

  @Get()
  @ApiOperation({ summary: 'List the patient’s released, encrypted health records' })
  list(@CurrentUser() user: AuthPrincipal) { return this.records.listPatientRecords(user.id); }

  @Get(':recordId')
  get(@Param('recordId', new ParseUUIDPipe({ version: '4' })) recordId: string, @CurrentUser() user: AuthPrincipal) {
    return this.records.getPatientRecord(user.id, recordId);
  }

  @Post('notes')
  @ApiOperation({ summary: 'Create a private note entered by the patient' })
  createPatientNote(@CurrentUser() user: AuthPrincipal, @Body() dto: CreateClinicalNoteDto, @Req() request: RequestWithId) {
    return this.records.createPatientNote(user.id, dto, request.id);
  }
}

@ApiTags('clinician clinical records')
@ApiBearerAuth()
@Controller('clinician')
export class ClinicianClinicalRecordsController {
  constructor(private readonly records: ClinicalRecordsService) {}

  @Post('hospitals/:hospitalId/appointments/:appointmentId/notes')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  createDraft(
    @Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string,
    @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string,
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: CreateClinicalNoteDto,
    @Req() request: RequestWithId,
  ) {
    return this.records.createClinicianDraft(hospitalId, appointmentId, user.id, dto, request.id);
  }

  @Post('hospitals/:hospitalId/clinical-records/:recordId/release')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  releaseDraft(
    @Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string,
    @Param('recordId', new ParseUUIDPipe({ version: '4' })) recordId: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() request: RequestWithId,
  ) {
    return this.records.releaseClinicianDraft(hospitalId, recordId, user.id, request.id);
  }
}
