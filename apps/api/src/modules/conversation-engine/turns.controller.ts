import { Body, Controller, Logger, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app.config';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ConversationEngineService } from './conversation-engine.service';
import { CreateTurnDto } from './dto/create-turn.dto';

// Streams one conversation turn as Server-Sent Events: `delta` frames as
// text arrives, then one `done` (with the persisted message id + token
// usage) or `error` frame, then the stream closes. Ownership is checked
// *before* the SSE headers are written, so a bad conversationId still comes
// back as a normal 404 - only failures once generation is already streaming
// surface as an `error` frame instead.
@Controller('conversations/:conversationId/turns')
export class TurnsController {
  private readonly logger = new Logger(TurnsController.name);
  private readonly corsOrigin: string;

  constructor(
    private readonly engine: ConversationEngineService,
    configService: ConfigService,
  ) {
    this.corsOrigin = configService.get<AppConfig>('app')!.corsOrigin;
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: CreateTurnDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const conversation = await this.engine.getOwnedConversation(user.id, conversationId);

    // Writing directly to the raw Node response bypasses Fastify's normal
    // send pipeline (that's what makes true incremental streaming possible
    // here), but that also skips the onSend hook @fastify/cors uses to add
    // CORS headers to every other response - without these, the browser
    // still receives a real 200 body but blocks the page from reading it,
    // which surfaces to the frontend as a bare "Failed to fetch".
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': this.corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    });

    let aborted = false;
    req.raw.on('close', () => {
      aborted = true;
    });

    const write = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const stream = this.engine.streamTurn(conversation, dto.content);
    try {
      while (true) {
        const step = await stream.next();
        if (step.done) {
          write('done', step.value);
          break;
        }
        if (aborted) {
          // Value is discarded - we're abandoning the turn, just letting the
          // generator's cleanup (if any) run instead of leaking it.
          await stream.return(undefined!);
          break;
        }
        write('delta', { text: step.value });
      }
    } catch (error) {
      this.logger.error('Turn generation failed', error instanceof Error ? error.stack : error);
      if (!aborted) write('error', { message: 'Something went wrong generating a response.' });
    } finally {
      reply.raw.end();
    }
  }
}
