import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AccessPolicyGuard } from './access-policy.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('ACCESS_TOKEN_SECRET'),
        signOptions: { expiresIn: config.get<number>('ACCESS_TOKEN_TTL_SECONDS', 900), algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  providers: [JwtAuthGuard, AccessPolicyGuard],
  exports: [JwtModule, JwtAuthGuard, AccessPolicyGuard],
})
export class SecurityModule {}
