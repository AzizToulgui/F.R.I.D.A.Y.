import { IsBoolean, IsObject, IsOptional, IsUUID } from 'class-validator';

export class InvokeToolDto {
  @IsOptional()
  @IsObject()
  arguments?: Record<string, unknown>;

  // Scopes the audit log entry to a conversation - optional since a tool can
  // be invoked outside any conversation (e.g. a future standalone UI action).
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  // Must be explicitly set true by a real user action (e.g. a confirmation
  // dialog) - see ToolExecutionService.invoke.
  @IsOptional()
  @IsBoolean()
  confirmed?: boolean;
}
