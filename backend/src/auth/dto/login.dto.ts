import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'riya@example.test' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail() email!: string;
  @ApiProperty({ minLength: 8, maxLength: 128 })
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
