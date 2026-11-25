import { Transform } from 'class-transformer';
import { IsEmail, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendCodeDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() challengeId!: string;
  @ApiProperty({ example: 'riya@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() email!: string;
}
