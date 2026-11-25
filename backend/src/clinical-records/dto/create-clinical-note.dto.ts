import { IsString, Length } from 'class-validator';

export class CreateClinicalNoteDto {
  @IsString() @Length(1, 120) title!: string;
  @IsString() @Length(1, 8000) content!: string;
}
