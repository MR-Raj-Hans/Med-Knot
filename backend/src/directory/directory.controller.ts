import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccessPolicy } from '../common/access-policy.decorator.js';
import { AccessPolicyGuard } from '../common/access-policy.guard.js';
import { DirectoryService } from './directory.service.js';
import { DirectoryQueryDto } from './dto/directory-query.dto.js';

@ApiTags('directory')
@ApiBearerAuth()
@AccessPolicy({ roles: ['patient'] })
@UseGuards(JwtAuthGuard, AccessPolicyGuard)
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directory: DirectoryService) {}

  @Get('hospitals')
  @ApiOperation({ summary: 'Search approved hospitals, optionally sorted by distance from a foreground location' })
  hospitals(@Query() query: DirectoryQueryDto) { return this.directory.listHospitals(query); }

  @Get('doctors')
  @ApiOperation({ summary: 'Search approved doctor profiles using server-side filters and pagination' })
  doctors(@Query() query: DirectoryQueryDto) { return this.directory.listDoctors(query); }

  @Get('doctors/:doctorId')
  @ApiOperation({ summary: 'Return an approved doctor profile and verified qualifications' })
  doctor(@Param('doctorId', new ParseUUIDPipe({ version: '4' })) doctorId: string) { return this.directory.getDoctor(doctorId); }

  @Get('specialties')
  specialties() { return this.directory.listSpecialties(); }
}
