import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { VoiceMemosService } from './voice-memos.service';

// @fastify/multipart's `MultipartValue` type is only reachable through its
// `export =` namespace import, not as a named export - a minimal structural
// type is simpler here than importing the whole plugin just for this shape.
function fieldValue(fields: Record<string, unknown>, name: string): string | undefined {
  const field = fields[name] as { value?: unknown } | undefined;
  return typeof field?.value === 'string' ? field.value : undefined;
}

// Same @fastify/multipart pattern as DocumentsController.upload, extended to
// also read the label/durationMs/sampleRateHz form fields the client sends
// alongside the WAV blob - see useLiveSession.ts's stop_recording_voice_memo
// interception, the only caller of this endpoint.
@Controller('voice-memos')
export class VoiceMemosController {
  constructor(private readonly voiceMemosService: VoiceMemosService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.voiceMemosService.findAllForUser(user.id);
  }

  @Post()
  async upload(@CurrentUser() user: AuthenticatedUser, @Req() req: FastifyRequest) {
    const file = await req.file({ limits: { fileSize: this.maxUploadBytes() } });
    if (!file) {
      throw new BadRequestException('No audio was uploaded.');
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch {
      throw new BadRequestException('The recording is too large or the upload failed.');
    }

    const durationMs = Number(fieldValue(file.fields, 'durationMs') ?? 0);
    const sampleRateHz = Number(fieldValue(file.fields, 'sampleRateHz') ?? 16000);
    const label = fieldValue(file.fields, 'label') || null;
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      throw new BadRequestException('A valid durationMs field is required.');
    }

    const memo = await this.voiceMemosService.create(user.id, {
      label,
      mimeType: file.mimetype || 'audio/wav',
      sampleRateHz: Number.isFinite(sampleRateHz) ? sampleRateHz : 16000,
      durationMs,
      audioData: buffer,
    });
    return { id: memo.id, label: memo.label, durationMs: memo.durationMs, createdAt: memo.createdAt.toISOString() };
  }

  @Get(':id/audio')
  async audio(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    const memo = await this.voiceMemosService.findOneOwned(user.id, id);
    res.header('Content-Type', memo.mimeType);
    return new StreamableFile(memo.audioData);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.voiceMemosService.remove(user.id, id);
  }

  private maxUploadBytes(): number {
    return Number(process.env.VOICE_MEMO_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
  }
}
