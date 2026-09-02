import { IsBoolean, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateConversationDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  title?: string;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  // Free-form guidance folded into this conversation's system instruction on
  // every turn (e.g. "reply in French"). Send an empty string to clear it.
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  customInstructions?: string;
}
