import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { WeatherService } from '../../weather/weather.service';
import { ToolContext, ToolDefinition } from '../tool.interface';

const paramsSchema = z.object({
  location: z.string().min(1).max(200),
});

type Params = z.infer<typeof paramsSchema>;

@Injectable()
export class GetWeatherTool implements ToolDefinition<Params> {
  readonly name = 'get_weather';
  readonly description =
    "Gets the current weather (temperature, feels-like, condition, humidity, wind) for a city or place. Use this whenever the user asks about the weather - never guess or rely on your training data, since conditions change constantly.";
  readonly requiresConfirmation = false;
  readonly parameters = paramsSchema;
  readonly parametersJsonSchema = {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City or place name, e.g. "Paris" or "Tunis, Tunisia". Ask the user if they did not give one.',
      },
    },
    required: ['location'],
  };

  constructor(private readonly weatherService: WeatherService) {}

  async execute(_ctx: ToolContext, args: Params) {
    return this.weatherService.getCurrentWeather(args.location);
  }
}
