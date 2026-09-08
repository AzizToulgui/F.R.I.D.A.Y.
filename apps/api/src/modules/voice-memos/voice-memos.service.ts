import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VoiceMemo } from './entities/voice-memo.entity';

export interface VoiceMemoSummary {
  id: string;
  label: string | null;
  durationMs: number;
  createdAt: string;
}

@Injectable()
export class VoiceMemosService {
  constructor(
    @InjectRepository(VoiceMemo)
    private readonly repository: Repository<VoiceMemo>,
  ) {}

  async create(
    userId: string,
    params: { label: string | null; mimeType: string; sampleRateHz: number; durationMs: number; audioData: Buffer },
  ): Promise<VoiceMemo> {
    const memo = this.repository.create({ userId, ...params });
    return this.repository.save(memo);
  }

  // Excludes audioData - listing memos should never pull audio bytes over
  // the wire (see play_voice_memo/GET :id/audio for that).
  async findAllForUser(userId: string): Promise<VoiceMemoSummary[]> {
    const memos = await this.repository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      select: { id: true, label: true, durationMs: true, createdAt: true },
    });
    return memos.map((m) => ({
      id: m.id,
      label: m.label,
      durationMs: m.durationMs,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  async findOneOwned(userId: string, id: string): Promise<VoiceMemo> {
    const memo = await this.repository.findOne({ where: { id, userId } });
    if (!memo) {
      throw new NotFoundException('Voice memo not found.');
    }
    return memo;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOneOwned(userId, id);
    await this.repository.delete({ id, userId });
  }
}
