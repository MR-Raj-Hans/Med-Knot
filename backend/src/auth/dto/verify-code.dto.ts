import { IsString, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyCodeDto {
  @ApiProperty({ format: 'uuid' }) @IsUUID() challengeId!: string;
  @ApiProperty({ example: '246810' }) @IsString() @Matches(/^\d{6}$/) code!: string;
}
