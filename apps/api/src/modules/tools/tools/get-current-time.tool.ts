import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  timezone: z.string().optional(),
});

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class GetCurrentTimeTool implements ToolDefinition<Params> {
  readonly name = 'get_current_time';
  readonly description =
    "Returns the current date and time, optionally in a specific IANA timezone (e.g. 'Europe/Paris', 'Asia/Tunis'). Use this whenever the user asks what time or date it is - never guess or rely on your training data for the current date.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: "IANA timezone name, e.g. 'Europe/Paris'. Defaults to UTC if omitted.",
      },
    },
  };

  async execute(_ctx: ToolContext, args: Params): Promise<{ iso: string; formatted: string; timezone: string }> {
    const timezone = args.timezone ?? 'UTC';
    const now = new Date();
    let formatted: string;
    try {
      formatted = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: timezone,
      }).format(now);
    } catch {
      throw new Error(`"${timezone}" is not a recognized IANA timezone.`);
    }
    return { iso: now.toISOString(), formatted, timezone };
  }
}
