import { Module } from '@nestjs/common';
import { AuthRateLimitGuard } from '../common/auth-rate-limit.guard.js';
import { SecurityModule } from '../common/security.module.js';
import { EmailModule } from '../email/email.module.js';
import { RolesModule } from '../roles/roles.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    RolesModule,
    SecurityModule,
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitGuard],
  exports: [SecurityModule],
})
export class AuthModule {}
