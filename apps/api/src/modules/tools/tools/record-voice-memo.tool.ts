import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  label: z.string().max(200).optional(),
});

type Params = z.infer<typeof paramsSchema>;

// Declaration-only: the actual recording happens client-side (useLiveSession
// intercepts this call name before it ever reaches /tools/:name/invoke - the
// backend has no access to Live audio at all, see LiveController). Still
// registered as a real ToolDefinition so it participates in
// ToolRegistryService.getDeclarations('voice') for Live-token minting, and so
// a bug in the client-side interception fails loudly instead of hanging.
@Injectable()
export class RecordVoiceMemoTool implements ToolDefinition<Params> {
  readonly name = 'record_voice_memo';
  readonly description =
    "Starts recording a personal voice memo from the user's microphone. Only call this in a live voice session. After calling this, stay silent and don't call any other tool until the user gives a clear cue to stop, then call stop_recording_voice_memo.";
  readonly requiresConfirmation = false;
  readonly channels: ('text' | 'voice')[] = ['voice'];
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      label: { type: 'string', description: "Optional short label for the memo, e.g. \"grocery list\"." },
    },
  };

  async execute(): Promise<never> {
    throw new Error(
      'record_voice_memo must be handled client-side by the voice session - this backend stub should never run.',
    );
  }
}
