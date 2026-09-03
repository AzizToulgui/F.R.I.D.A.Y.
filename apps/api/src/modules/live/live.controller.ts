import { Controller, Logger, Post } from '@nestjs/common';
import { AIProvider } from '../ai-provider/ai-provider.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ToolRegistryService } from '../tools/tool-registry.service';

@Controller('live')
export class LiveController {
  private readonly logger = new Logger(LiveController.name);

  constructor(
    private readonly aiProvider: AIProvider,
    private readonly toolRegistry: ToolRegistryService,
  ) {}

  // Mints a single-use, short-lived Gemini Live credential for the
  // authenticated user. The browser uses this to open a WebSocket directly
  // to Gemini - this backend never proxies the audio stream (see
  // ARCHITECTURE.md Section 3) and never returns the permanent API key.
  // Tools are locked into the session here (server-side) rather than passed
  // by the client when it connects - see AIProvider.mintLiveSessionToken.
  @Post('session')
  async createSession(@CurrentUser() user: AuthenticatedUser) {
    this.logger.log(`Minting Gemini Live session token for user ${user.id}`);
    return this.aiProvider.mintLiveSessionToken(this.toolRegistry.getDeclarations());
  }
}
