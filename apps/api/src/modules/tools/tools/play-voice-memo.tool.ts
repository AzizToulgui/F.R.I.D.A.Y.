import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  id: z.string().optional(),
  label: z.string().max(200).optional(),
});

type Params = z.infer<typeof paramsSchema>;

// Declaration-only - see record-voice-memo.tool.ts for why.
@Injectable()
export class PlayVoiceMemoTool implements ToolDefinition<Params> {
  readonly name = 'play_voice_memo';
  readonly description =
    "Plays back a saved voice memo out loud. Pass an id from list_voice_memos if you have one; otherwise pass a label to match by, or omit both to play the most recent memo.";
  readonly requiresConfirmation = false;
  readonly channels: ('text' | 'voice')[] = ['voice'];
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'The exact memo id, from list_voice_memos.' },
      label: { type: 'string', description: 'A label to match against, if no id is known.' },
    },
  };

  async execute(): Promise<never> {
    throw new Error(
      'play_voice_memo must be handled client-side by the voice session - this backend stub should never run.',
    );
  }
}
