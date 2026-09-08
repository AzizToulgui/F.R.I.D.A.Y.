import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTurnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  content!: string;

  // IANA timezone name (e.g. 'Africa/Tunis'), read client-side from
  // Intl.DateTimeFormat().resolvedOptions().timeZone - see
  // ConversationEngineService.describeTimezone for why the model needs this.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  timezone?: string;
}
