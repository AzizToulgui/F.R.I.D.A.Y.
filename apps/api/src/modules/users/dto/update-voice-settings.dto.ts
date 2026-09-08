import { IsIn, IsOptional } from 'class-validator';
import { PREBUILT_VOICE_NAMES, VOICE_DELIVERY_STYLE_KEYS } from '../../ai-provider/voice-options';

export class UpdateVoiceSettingsDto {
  // `null` clears the preference back to Gemini's default voice/delivery;
  // `undefined` (the field simply omitted) leaves it untouched - see
  // UsersService.updateVoiceSettings.
  @IsOptional()
  @IsIn([...PREBUILT_VOICE_NAMES, null])
  voiceName?: string | null;

  @IsOptional()
  @IsIn([...VOICE_DELIVERY_STYLE_KEYS, null])
  voiceDeliveryStyle?: string | null;
}
