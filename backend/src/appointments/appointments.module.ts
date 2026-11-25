import { Module } from '@nestjs/common';
import { SecurityModule } from '../common/security.module.js';
import { HospitalsModule } from '../hospitals/hospitals.module.js';
import { AppointmentsController, ClinicianAvailabilityController, DoctorAdminAvailabilityController } from './appointments.controller.js';
import { AppointmentsService } from './appointments.service.js';

@Module({
  imports: [SecurityModule, HospitalsModule],
  controllers: [AppointmentsController, DoctorAdminAvailabilityController, ClinicianAvailabilityController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
