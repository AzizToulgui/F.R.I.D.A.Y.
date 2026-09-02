import { IsEnum, IsString, MaxLength } from 'class-validator';
import { MessageRole } from '../entities/message.entity';

export class CreateMessageDto {
  @IsEnum(MessageRole)
  role!: MessageRole;

  @IsString()
  @MaxLength(32000)
  content!: string;
}
