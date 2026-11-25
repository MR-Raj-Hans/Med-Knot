import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator';

export class AvailabilitySlotInputDto {
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsOptional() @IsString() @Length(3, 64) timezone = 'UTC';
}

export class ManageSlotsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => AvailabilitySlotInputDto)
  slots!: AvailabilitySlotInputDto[];
}

export class SlotActionDto {
  @IsIn(['block', 'restore']) action!: 'block' | 'restore';
}
