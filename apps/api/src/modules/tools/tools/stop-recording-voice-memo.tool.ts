import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({});

type Params = z.infer<typeof paramsSchema>;

// Declaration-only - see record-voice-memo.tool.ts for why.
@Injectable()
export class StopRecordingVoiceMemoTool implements ToolDefinition<Params> {
  readonly name = 'stop_recording_voice_memo';
  readonly description =
    'Stops the in-progress voice memo recording started by record_voice_memo and saves it. Only call this after record_voice_memo, once the user gives a clear cue to stop.';
  readonly requiresConfirmation = false;
  readonly channels: ('text' | 'voice')[] = ['voice'];
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = { type: 'object', properties: {} };

  async execute(): Promise<never> {
    throw new Error(
      'stop_recording_voice_memo must be handled client-side by the voice session - this backend stub should never run.',
    );
  }
}
