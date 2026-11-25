import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { HospitalScopeGuard } from '../hospitals/hospital-scope.guard.js';
import { AppointmentsService } from './appointments.service.js';
import { AvailabilityQueryDto } from './dto/availability-query.dto.js';
import { AppointmentsQueryDto } from './dto/appointments-query.dto.js';
import { BookAppointmentDto } from './dto/book-appointment.dto.js';
import { ChangeAppointmentDto } from './dto/change-appointment.dto.js';
import { ManageSlotsDto, SlotActionDto } from './dto/manage-slots.dto.js';

type RequestWithId = Request & { id?: string };

@ApiTags('appointments')
@ApiBearerAuth()
@AccessPolicy({ roles: ['patient'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Get('availability/:doctorId')
  @ApiOperation({ summary: 'List available appointment slots for a verified doctor' })
  availability(@Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string, @Query() query: AvailabilityQueryDto) {
    return this.appointments.listAvailability(doctorId, query);
  }

  @Get()
  list(@CurrentUser() user: AuthPrincipal, @Query() query: AppointmentsQueryDto) {
    return this.appointments.listPatientAppointments(user.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Book an available in-person slot with an idempotency key' })
  book(@CurrentUser() user: AuthPrincipal, @Body() dto: BookAppointmentDto, @Req() request: RequestWithId) {
    return this.appointments.book(user.id, dto, request.id);
  }

  @Get(':appointmentId')
  get(@Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string, @CurrentUser() user: AuthPrincipal) {
    return this.appointments.getPatientAppointment(user.id, appointmentId);
  }

  @Patch(':appointmentId')
  change(@Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string, @CurrentUser() user: AuthPrincipal, @Body() dto: ChangeAppointmentDto, @Req() request: RequestWithId) {
    return this.appointments.changePatientAppointment(user.id, appointmentId, dto, request.id);
  }
}

@ApiTags('doctor availability')
@ApiBearerAuth()
@AccessPolicy({ roles: ['admin', 'hospital_admin'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard, HospitalScopeGuard)
@Controller('admin/hospitals/:hospitalId/doctors/:doctorId/slots')
export class DoctorAdminAvailabilityController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post()
  create(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string, @Body() dto: ManageSlotsDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.appointments.createDoctorSlots(hospitalId, doctorId, dto, user.id, request.id);
  }
}

@ApiTags('clinician availability')
@ApiBearerAuth()
@Controller('clinician/hospitals/:hospitalId')
export class ClinicianAvailabilityController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Post('accept')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  accept(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.appointments.acceptHospitalInvite(hospitalId, user.id, request.id);
  }

  @Post('availability')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  create(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Body() dto: ManageSlotsDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.appointments.createMySlots(hospitalId, user.id, dto, request.id);
  }

  @Patch('availability/:slotId')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  change(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Param('slotId', new ParseUUIDPipe({ version: '4' })) slotId: string, @Body() dto: SlotActionDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.appointments.changeMySlot(hospitalId, slotId, user.id, dto.action, request.id);
  }

  @Get('appointments')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  listAppointments(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @CurrentUser() user: AuthPrincipal, @Query() query: AppointmentsQueryDto) {
    return this.appointments.listMyAppointments(hospitalId, user.id, query);
  }

  @Patch('appointments/:appointmentId/complete')
  @AccessPolicy({ roles: ['clinician'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard)
  completeAppointment(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Param('appointmentId', new ParseUUIDPipe({ version: '4' })) appointmentId: string, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.appointments.completeMyAppointment(hospitalId, appointmentId, user.id, request.id);
  }
}
