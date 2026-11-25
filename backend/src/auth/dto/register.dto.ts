import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Riya Sharma', maxLength: 120 })
  @IsString() @MinLength(2) @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'riya@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(320)
  email!: string;

  @ApiProperty({ example: '+919876543210' })
  @Transform(({ value }) => typeof value === 'string' ? value.replace(/[\s().-]/g, '') : value)
  @IsString() @Matches(/^\+?[1-9]\d{7,14}$/)
  phone!: string;

  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString() @MinLength(8) @MaxLength(128)
  password!: string;

  @ApiProperty({ example: true })
  @IsBoolean() @Equals(true)
  acceptedTerms!: boolean;
}
