import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Length, Max, Min, Matches } from 'class-validator';

export class CreateHospitalDto {
  @IsString() @Length(2, 160) name!: string;
  @IsString() @Length(2, 96) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsOptional() @IsString() @Length(2, 200) addressLine1?: string;
  @IsOptional() @IsString() @Length(2, 100) city?: string;
  @IsOptional() @IsString() @Length(2, 100) region?: string;
  @IsOptional() @IsString() @Length(2, 24) postalCode?: string;
  @IsOptional() @IsString() @Length(2, 100) country?: string;
  @IsOptional() @IsString() @Length(5, 24) phone?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
