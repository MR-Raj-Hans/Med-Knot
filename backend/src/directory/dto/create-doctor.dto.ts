import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateNested } from 'class-validator';

export class DoctorQualificationDto {
  @IsString() @Length(2, 160) qualification!: string;
  @IsString() @Length(2, 160) institution!: string;
  @IsOptional() @IsInt() @Min(1900) @Max(2100) yearCompleted?: number;
}

export class CreateDoctorDto {
  @IsUUID() userId!: string;
  @IsUUID() departmentId!: string;
  @IsUUID() specialtyId!: string;
  @IsString() @Length(2, 100) licenseNumber!: string;
  @IsOptional() @IsString() @Length(2, 2000) biography?: string;
  @IsOptional() @IsInt() @Min(0) @Max(80) yearsExperience?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) consultationFeeMinor?: number;
  @IsOptional() @IsString() @Length(3, 3) currency?: string;
  @IsOptional() @IsBoolean() onlineConsultation = false;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => DoctorQualificationDto)
  qualifications!: DoctorQualificationDto[];
}
