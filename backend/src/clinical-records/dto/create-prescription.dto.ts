import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Length, Max, Min, ValidateNested } from 'class-validator';

export class PrescriptionMedicationDto {
  @IsString() @Length(1, 160) medicineName!: string;
  @IsOptional() @IsString() @Length(1, 80) strength?: string;
  @IsString() @Length(1, 200) dosage!: string;
  @IsOptional() @IsString() @Length(1, 80) route?: string;
  @IsString() @Length(1, 120) frequency!: string;
  @IsOptional() @IsString() @Length(1, 120) duration?: string;
  @IsOptional() @IsString() @Length(1, 80) quantity?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(5) refills = 0;
}

export class CreatePrescriptionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => PrescriptionMedicationDto)
  medications!: PrescriptionMedicationDto[];

  @IsOptional() @IsString() @Length(1, 2000) instructions?: string;
}
