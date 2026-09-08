import { Inject, Injectable } from '@nestjs/common';
import { ToolDeclaration } from '../ai-provider/ai-provider.types';
import { TOOL_DEFINITIONS, ToolDefinition } from './tool.interface';

// Holds every registered ToolDefinition (see ToolsModule's TOOL_DEFINITIONS
// provider) and exposes them both for lookup (ToolExecutionService) and as
// provider-agnostic declarations (AIProvider.generateText/generateTextStream,
// AIProvider.mintLiveSessionToken).
@Injectable()
export class ToolRegistryService {
  private readonly byName = new Map<string, ToolDefinition>();

  constructor(@Inject(TOOL_DEFINITIONS) tools: ToolDefinition[]) {
    for (const tool of tools) this.byName.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.byName.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.byName.values()];
  }

  getDeclarations(channel: 'text' | 'voice' = 'text', disabledToolNames: string[] = []): ToolDeclaration[] {
    const disabled = new Set(disabledToolNames);
    return this.list()
      .filter((tool) => !tool.channels || tool.channels.includes(channel))
      .filter((tool) => !disabled.has(tool.name))
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        parametersJsonSchema: tool.parametersJsonSchema,
      }));
  }
}
