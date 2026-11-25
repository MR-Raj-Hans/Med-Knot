import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AppointmentsQueryDto {
  @IsOptional() @IsIn(['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW']) status?: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'NO_SHOW';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 20;
}
