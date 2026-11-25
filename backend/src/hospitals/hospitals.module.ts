import { Module } from '@nestjs/common';
import { HospitalScopeGuard } from './hospital-scope.guard.js';
import { HospitalsService } from './hospitals.service.js';

@Module({ providers: [HospitalsService, HospitalScopeGuard], exports: [HospitalsService, HospitalScopeGuard] })
export class HospitalsModule {}
