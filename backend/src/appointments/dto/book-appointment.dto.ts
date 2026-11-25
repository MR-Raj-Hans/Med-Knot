import { IsIn, IsUUID } from 'class-validator';

export class BookAppointmentDto {
  @IsUUID() doctorId!: string;
  @IsUUID() slotId!: string;
  @IsUUID() idempotencyKey!: string;
  @IsIn(['IN_PERSON', 'ONLINE_VIDEO']) consultationMode!: 'IN_PERSON' | 'ONLINE_VIDEO';
}
