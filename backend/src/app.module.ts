import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { DirectoryModule } from './directory/directory.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { ClinicalRecordsModule } from './clinical-records/clinical-records.module.js';
import { HospitalsModule } from './hospitals/hospitals.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { RedisModule } from './redis/redis.module.js';
import { RolesModule } from './roles/roles.module.js';
import { SecurityModule } from './common/security.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationOptions: { abortEarly: false, allowUnknown: true, stripUnknown: false },
      validationSchema: Joi.object({
        APP_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        EMAIL_PROVIDER: Joi.string().valid('development', 'resend').default('development').when('APP_ENV', {
          is: 'production', then: Joi.valid('resend').required(),
        }),
        EMAIL_FROM: Joi.string().email().when('EMAIL_PROVIDER', {
          is: 'resend', then: Joi.required(), otherwise: Joi.allow(''),
        }),
        EMAIL_API_KEY: Joi.string().min(1).when('EMAIL_PROVIDER', {
          is: 'resend', then: Joi.required(), otherwise: Joi.allow(''),
        }),
        EMAIL_TIMEOUT_MS: Joi.number().integer().min(1000).max(30000).default(8000),
        VIDEO_PROVIDER: Joi.string().valid('none', 'daily', 'twilio').default('none'),
        RECORD_ENCRYPTION_KEY: Joi.alternatives().conditional('APP_ENV', {
          is: 'production',
          then: Joi.string().custom(validateRecordEncryptionKey).required(),
          otherwise: Joi.string().allow('').custom((value, helpers) => value === '' ? value : validateRecordEncryptionKey(value, helpers)).default(''),
        }),
        PORT: Joi.number().integer().min(1).max(65535).default(4000),
        DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
        REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
        ACCESS_TOKEN_SECRET: Joi.string().min(32).required(),
        ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).max(900).default(900),
        REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(90).default(30),
        OTP_TTL_MINUTES: Joi.number().integer().min(2).max(30).default(10),
        OTP_RESEND_COOLDOWN_SECONDS: Joi.number().integer().min(10).max(300).default(30),
        PASSWORD_RESET_TTL_MINUTES: Joi.number().integer().min(2).max(30).default(15),
        RATE_LIMIT_WINDOW_SECONDS: Joi.number().integer().min(10).max(600).default(60),
        RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).max(100).default(10),
        CORS_ORIGINS: Joi.string().allow('').default(''),
        SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
      }),
    }),
    DatabaseModule,
    RedisModule,
    SecurityModule,
    AuditModule,
    RolesModule,
    HospitalsModule,
    PatientsModule,
    AuthModule,
    HealthModule,
    DirectoryModule,
    AppointmentsModule,
    ClinicalRecordsModule,
  ],
})
export class AppModule {}

function validateRecordEncryptionKey(value: string, helpers: Joi.CustomHelpers) {
  const decoded = Buffer.from(value, 'base64');
  if (decoded.length !== 32 || decoded.toString('base64') !== value) return helpers.error('any.invalid');
  return value;
}
