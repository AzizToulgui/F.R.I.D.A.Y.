import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTurnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;
}
