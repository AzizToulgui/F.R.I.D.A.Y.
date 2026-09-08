import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FunctionCallRequest, FunctionCallResponse } from '../ai-provider/ai-provider.types';
import { UsersService } from '../users/users.service';
import { ToolInvocation, ToolInvocationStatus } from './entities/tool-invocation.entity';
import { ToolContext } from './tool.interface';
import { ToolRegistryService } from './tool-registry.service';

export interface ToolInvocationResult {
  output?: unknown;
  error?: string;
}

// The pipeline from ARCHITECTURE.md Section 10:
//   Gemini -> tool_call request -> Tool Registry lookup -> Zod validation
//   -> Auth/permission check -> (confirmation step if sensitive) -> Execute
//   -> Audit log write -> Result -> back to Gemini
// Every branch (unknown tool, bad arguments, blocked, execution error,
// success) is audited - not just the success path.
@Injectable()
export class ToolExecutionService {
  private readonly logger = new Logger(ToolExecutionService.name);

  constructor(
    private readonly registry: ToolRegistryService,
    private readonly usersService: UsersService,
    @InjectRepository(ToolInvocation)
    private readonly invocationsRepository: Repository<ToolInvocation>,
  ) {}

  /**
   * `confirmed` must come from an explicit user action (e.g. a UI
   * confirmation dialog) - callers that execute tools on the model's
   * initiative alone (the text-mode round-trip loop, the voice relay) must
   * always pass `false`, so a future `requiresConfirmation` tool can never
   * fire without a real human confirming it first.
   */
  async invoke(ctx: ToolContext, name: string, rawArgs: unknown, confirmed: boolean): Promise<ToolInvocationResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      return { error: `Unknown tool "${name}".` };
    }

    // Defense in depth: a disabled tool is already excluded from what
    // ToolRegistryService.getDeclarations offers Gemini (see
    // ConversationEngineService/LiveController), but this catches a call
    // that still slips through - e.g. a Live session's tool set was locked
    // in before the user flipped the switch.
    const user = await this.usersService.findById(ctx.userId);
    if (user?.disabledTools.includes(name)) {
      await this.audit(ctx, name, rawArgs, { blocked: 'tool_disabled' }, ToolInvocationStatus.BLOCKED);
      return { error: `"${name}" is turned off in Settings.` };
    }

    const parsed = tool.parameters.safeParse(rawArgs ?? {});
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join(', ');
      await this.audit(ctx, name, rawArgs, { error: message }, ToolInvocationStatus.BLOCKED);
      return { error: `Invalid arguments for ${name}: ${message}` };
    }

    if (tool.requiresConfirmation && !confirmed) {
      await this.audit(ctx, name, parsed.data, { blocked: 'confirmation_required' }, ToolInvocationStatus.BLOCKED);
      return { error: `"${name}" requires explicit user confirmation before it can run.` };
    }

    try {
      const output = await tool.execute(ctx, parsed.data);
      await this.audit(ctx, name, parsed.data, this.toJsonRecord(output), ToolInvocationStatus.SUCCESS);
      return { output };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed.';
      this.logger.warn(`Tool "${name}" execution failed`, error instanceof Error ? error.stack : error);
      await this.audit(ctx, name, parsed.data, { error: message }, ToolInvocationStatus.ERROR);
      return { error: message };
    }
  }

  /** Resolves every function call from one model turn - never auto-confirms (see `invoke`). */
  async invokeAll(ctx: ToolContext, calls: FunctionCallRequest[]): Promise<FunctionCallResponse[]> {
    return Promise.all(
      calls.map(async (call): Promise<FunctionCallResponse> => {
        const result = await this.invoke(ctx, call.name, call.args, false);
        return {
          name: call.name,
          id: call.id,
          response: result.error ? { error: result.error } : { output: result.output },
        };
      }),
    );
  }

  private toJsonRecord(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    return { value };
  }

  private async audit(
    ctx: ToolContext,
    toolName: string,
    args: unknown,
    result: Record<string, unknown> | null,
    status: ToolInvocationStatus,
  ): Promise<void> {
    const invocation = this.invocationsRepository.create({
      userId: ctx.userId,
      conversationId: ctx.conversationId,
      toolName,
      arguments: this.toJsonRecord(args) ?? {},
      result,
      status,
    });
    await this.invocationsRepository.save(invocation);
  }
}
