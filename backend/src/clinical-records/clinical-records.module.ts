import { Module } from '@nestjs/common';
import { SecurityModule } from '../common/security.module.js';
import { PatientClinicalRecordsController, ClinicianClinicalRecordsController } from './clinical-records.controller.js';
import { ClinicalRecordsCrypto } from './clinical-records.crypto.js';
import { ClinicalRecordsService } from './clinical-records.service.js';
import { ClinicianPrescriptionsController, PatientPrescriptionsController } from './prescriptions.controller.js';
import { PrescriptionsService } from './prescriptions.service.js';

@Module({
  imports: [SecurityModule],
  controllers: [PatientClinicalRecordsController, ClinicianClinicalRecordsController, PatientPrescriptionsController, ClinicianPrescriptionsController],
  providers: [ClinicalRecordsCrypto, ClinicalRecordsService, PrescriptionsService],
})
export class ClinicalRecordsModule {}
