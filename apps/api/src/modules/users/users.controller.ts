import { BadRequestException, Body, Controller, Get, Header, Param, Patch, Res, StreamableFile } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { SAMPLE_VERSION, VoiceSamplesService } from '../ai-provider/voice-samples.service';
import { PREBUILT_VOICE_NAMES, PREBUILT_VOICES, PrebuiltVoiceName, VOICE_DELIVERY_STYLES } from '../ai-provider/voice-options';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateVoiceSettingsDto } from './dto/update-voice-settings.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly voiceSamplesService: VoiceSamplesService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  // The fixed catalog Settings > Voice picks from - kept server-side (see
  // voice-options.ts) so the frontend never hardcodes a list that could
  // drift from what GeminiProvider actually accepts.
  @Get('voice-options')
  voiceOptions() {
    return {
      voices: PREBUILT_VOICES,
      deliveryStyles: VOICE_DELIVERY_STYLES.map(({ key, label }) => ({ key, label })),
      // The frontend appends this to the sample URL as a cache-buster - see
      // VoiceSamplesService.SAMPLE_VERSION for why that's necessary.
      sampleVersion: SAMPLE_VERSION,
    };
  }

  // A short spoken clip in the given prebuilt voice, as a playable WAV -
  // cached server-side after the first request (see VoiceSamplesService), so
  // previewing the same voice repeatedly doesn't re-hit Gemini every time.
  @Get('voice-options/:voiceName/sample')
  @Header('Content-Type', 'audio/wav')
  async voiceSample(
    @Param('voiceName') voiceName: string,
    // Cache-Control is set here (success path only), not as a @Header()
    // decorator - a decorator applies to every response from this handler
    // including a thrown error, and the browser then caches that error for
    // the same 24h, masking a later fix (this bit us in dev - a stale
    // cached 500 kept reappearing for the same URL after the real bug was
    // already fixed server-side).
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    if (!PREBUILT_VOICE_NAMES.includes(voiceName as PrebuiltVoiceName)) {
      throw new BadRequestException(`"${voiceName}" is not a known voice.`);
    }
    const sample = await this.voiceSamplesService.getSample(voiceName);
    res.header('Cache-Control', 'private, max-age=86400');
    // A plain Buffer return trips Fastify's payload-type guard ("Attempted
    // to send payload of invalid type 'object'") - StreamableFile is Nest's
    // adapter-agnostic wrapper for binary responses, verified working here.
    return new StreamableFile(sample.buffer);
  }

  @Get('me/voice-settings')
  async voiceSettings(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.usersService.findById(user.id);
    return { voiceName: full?.voiceName ?? null, voiceDeliveryStyle: full?.voiceDeliveryStyle ?? null };
  }

  @Patch('me/voice-settings')
  async updateVoiceSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateVoiceSettingsDto) {
    const updated = await this.usersService.updateVoiceSettings(user.id, dto);
    return { voiceName: updated.voiceName, voiceDeliveryStyle: updated.voiceDeliveryStyle };
  }
}
