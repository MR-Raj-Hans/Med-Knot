import { Transform } from 'class-transformer';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'riya@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() email!: string;
  @ApiProperty({ example: '246810' }) @IsString() @Matches(/^\d{6}$/) code!: string;
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString() @MinLength(8) @MaxLength(128) newPassword!: string;
}
