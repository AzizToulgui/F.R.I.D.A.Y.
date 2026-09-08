import { ZodType } from 'zod';

export interface ToolContext {
  userId: string;
  conversationId: string | null;
}

// { name, description, parameterSchema: ZodSchema, handler, requiresConfirmation,
// requiredPermission } per ARCHITECTURE.md Section 10 - `requiredPermission` is
// implicit here (every tool only ever acts within `ctx.userId`'s own data; a
// tool needing something broader would add an explicit check inside `execute`).
export interface ToolDefinition<TArgs = unknown> {
  readonly name: string;
  readonly description: string;
  // Runtime validation - every call's arguments are parsed against this
  // before `execute` ever runs (see ToolExecutionService).
  readonly parameters: ZodType<TArgs>;
  // Hand-written rather than derived from `parameters` - the Gemini SDK's
  // `parametersJsonSchema` wants plain JSON Schema, and duplicating it
  // explicitly per tool is simpler and less fragile than a generic
  // zod-to-json-schema conversion for the handful of tools this registers.
  readonly parametersJsonSchema: Record<string, unknown>;
  // Anything destructive or side-effecting (e.g. "send a message", "delete a
  // reminder") - none of the Step 10 starting tools need this, but the gate
  // exists so a future tool can opt in without touching ToolExecutionService.
  readonly requiresConfirmation: boolean;
  // Restricts which channel(s) a tool is offered on - undefined means both
  // (every tool predating this field). Voice-only tools (e.g. the voice memo
  // record/play tools) rely on client-side capabilities (mic access) that
  // text chat has no equivalent for, so they'd otherwise appear as a
  // function the model could call and get a confusing stub result back.
  readonly channels?: ('text' | 'voice')[];
  execute(ctx: ToolContext, args: TArgs): Promise<unknown>;
}

export const TOOL_DEFINITIONS = Symbol('TOOL_DEFINITIONS');
