import { IsBoolean } from 'class-validator';

export class SetToolEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
