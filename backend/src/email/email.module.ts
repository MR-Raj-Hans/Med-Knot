import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createEmailTransport, EMAIL_TRANSPORT, EmailService } from './email.service.js';

@Module({
  providers: [
    {
      provide: EMAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createEmailTransport(config),
    },
    {
      provide: EmailService,
      inject: [EMAIL_TRANSPORT],
      useFactory: (transport: ConstructorParameters<typeof EmailService>[0]) => new EmailService(transport),
    },
  ],
  exports: [EmailService],
})
export class EmailModule {}
