import { Matches, IsString, Length } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Length(2, 96) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
}
