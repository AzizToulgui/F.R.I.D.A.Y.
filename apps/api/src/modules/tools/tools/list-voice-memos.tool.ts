import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { VoiceMemosService } from '../../voice-memos/voice-memos.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({});

type Params = z.infer<typeof paramsSchema>;

// The one real backend tool of the voice-memo set - record/stop/play are
// client-intercepted in useLiveSession.ts (the backend never sees Live
// audio, see LiveController). This lets the model resolve an id/label
// before calling play_voice_memo, same list-before-target pattern as
// list_reminders/list_calendar_events.
@Injectable()
export class ListVoiceMemosTool implements ToolDefinition<Params> {
  readonly name = 'list_voice_memos';
  readonly description = "Lists the user's saved voice memos (id, label, duration, created date), most recent first.";
  readonly requiresConfirmation = false;
  readonly channels: ('text' | 'voice')[] = ['voice'];
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = { type: 'object', properties: {} };

  constructor(private readonly voiceMemosService: VoiceMemosService) {}

  async execute(ctx: ToolContext) {
    const memos = await this.voiceMemosService.findAllForUser(ctx.userId);
    return { memos };
  }
}
