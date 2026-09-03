import { IsString, Length } from 'class-validator';

export class UpdateMemoryDto {
  @IsString()
  @Length(1, 2000)
  content!: string;
}
