import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class ChangeAppointmentDto {
  @IsIn(['cancel', 'reschedule']) action!: 'cancel' | 'reschedule';
  @IsOptional() @IsUUID() newSlotId?: string;
}
