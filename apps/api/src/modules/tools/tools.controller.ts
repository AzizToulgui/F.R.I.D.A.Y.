import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { SetToolEnabledDto } from './dto/set-tool-enabled.dto';
import { InvokeToolDto } from './dto/invoke-tool.dto';
import { ToolExecutionService } from './tool-execution.service';
import { ToolRegistryService } from './tool-registry.service';

// This is also the endpoint the Live voice relay calls (ARCHITECTURE.md
// Section 3): the client forwards a Gemini tool_call event here, gets the
// result back, and relays it into the Live session - the model never
// executes anything itself, this backend does, authenticated and audited.
@Controller('tools')
export class ToolsController {
  constructor(
    private readonly registry: ToolRegistryService,
    private readonly execution: ToolExecutionService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const fullUser = await this.usersService.findById(user.id);
    const disabled = new Set(fullUser?.disabledTools ?? []);
    return this.registry.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiresConfirmation: tool.requiresConfirmation,
      enabled: !disabled.has(tool.name),
    }));
  }

  @Patch(':name/enabled')
  async setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('name') name: string,
    @Body() dto: SetToolEnabledDto,
  ) {
    if (!this.registry.get(name)) {
      throw new NotFoundException(`Unknown tool "${name}".`);
    }
    const updated = await this.usersService.setToolEnabled(user.id, name, dto.enabled);
    return { name, enabled: !updated.disabledTools.includes(name) };
  }

  @Post(':name/invoke')
  async invoke(
    @CurrentUser() user: AuthenticatedUser,
    @Param('name') name: string,
    @Body() dto: InvokeToolDto,
  ) {
    const result = await this.execution.invoke(
      { userId: user.id, conversationId: dto.conversationId ?? null },
      name,
      dto.arguments ?? {},
      dto.confirmed ?? false,
    );
    if (result.error) throw new BadRequestException(result.error);
    return { output: result.output };
  }
}
