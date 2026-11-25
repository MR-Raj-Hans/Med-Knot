import { Module } from '@nestjs/common';
import { SecurityModule } from '../common/security.module.js';
import { HospitalsModule } from '../hospitals/hospitals.module.js';
import { DirectoryHospitalAdminController, DirectorySystemAdminController } from './directory-admin.controller.js';
import { DirectoryController } from './directory.controller.js';
import { DirectoryService } from './directory.service.js';

@Module({
  imports: [SecurityModule, HospitalsModule],
  controllers: [DirectoryController, DirectorySystemAdminController, DirectoryHospitalAdminController],
  providers: [DirectoryService],
})
export class DirectoryModule {}
