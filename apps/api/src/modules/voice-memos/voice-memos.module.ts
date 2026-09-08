import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoiceMemo } from './entities/voice-memo.entity';
import { VoiceMemosController } from './voice-memos.controller';
import { VoiceMemosService } from './voice-memos.service';

@Module({
  imports: [TypeOrmModule.forFeature([VoiceMemo])],
  controllers: [VoiceMemosController],
  providers: [VoiceMemosService],
  exports: [VoiceMemosService],
})
export class VoiceMemosModule {}
