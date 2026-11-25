import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import type { AuthPrincipal } from '../common/auth-principal.js';
import { CurrentUser } from '../common/current-user.decorator.js';
import { HospitalScopeGuard } from '../hospitals/hospital-scope.guard.js';
import { DirectoryService } from './directory.service.js';
import { CreateDepartmentDto } from './dto/create-department.dto.js';
import { CreateDoctorDto } from './dto/create-doctor.dto.js';
import { CreateHospitalDto } from './dto/create-hospital.dto.js';
import { CreateSpecialtyDto } from './dto/create-specialty.dto.js';
import { VerificationActionDto } from './dto/verification-action.dto.js';

type RequestWithId = Request & { id?: string };

@ApiTags('directory administration')
@ApiBearerAuth()
@AccessPolicy({ roles: ['admin'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('admin/directory')
export class DirectorySystemAdminController {
  constructor(private readonly directory: DirectoryService) {}

  @Post('hospitals')
  createHospital(@Body() dto: CreateHospitalDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.directory.createHospital(dto, user.id, request.id);
  }

  @Patch('hospitals/:hospitalId/verification')
  verifyHospital(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Body() dto: VerificationActionDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.directory.verifyHospital(hospitalId, dto.action, user.id, request.id);
  }

  @Post('specialties')
  createSpecialty(@Body() dto: CreateSpecialtyDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.directory.createSpecialty(dto, user.id, request.id);
  }
}

@ApiTags('hospital directory administration')
@ApiBearerAuth()
@Controller('admin/hospitals/:hospitalId')
export class DirectoryHospitalAdminController {
  constructor(private readonly directory: DirectoryService) {}

  @Post('departments')
  @AccessPolicy({ roles: ['admin', 'hospital_admin'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard, HospitalScopeGuard)
  createDepartment(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Body() dto: CreateDepartmentDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.directory.createDepartment(hospitalId, dto, user.id, request.id);
  }

  @Post('doctors')
  @AccessPolicy({ roles: ['admin', 'hospital_admin'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard, HospitalScopeGuard)
  createDoctor(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Body() dto: CreateDoctorDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.directory.createDoctor(hospitalId, dto, user.id, request.id);
  }

  @Patch('doctors/:doctorId/verification')
  @AccessPolicy({ roles: ['admin', 'hospital_admin'] })
  @UseGuards(JwtAuthGuard, AccessPolicyGuard, HospitalScopeGuard)
  verifyDoctor(@Param('hospitalId', new ParseUUIDPipe({ version: '4' })) hospitalId: string, @Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string, @Body() dto: VerificationActionDto, @CurrentUser() user: AuthPrincipal, @Req() request: RequestWithId) {
    return this.directory.verifyDoctor(hospitalId, doctorId, dto.action, user.id, request.id);
  }
}
