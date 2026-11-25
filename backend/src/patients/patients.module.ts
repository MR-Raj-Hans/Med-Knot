import { Module } from '@nestjs/common';
import { SecurityModule } from '../common/security.module.js';
import { PatientHomeController } from './patient-home.controller.js';
import { PatientsController } from './patients.controller.js';

@Module({ imports: [SecurityModule], controllers: [PatientsController, PatientHomeController] })
export class PatientsModule {}
