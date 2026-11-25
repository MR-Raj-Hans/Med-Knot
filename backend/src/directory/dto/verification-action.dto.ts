import { IsIn } from 'class-validator';

export class VerificationActionDto {
  @IsIn(['approve', 'reject']) action!: 'approve' | 'reject';
}
