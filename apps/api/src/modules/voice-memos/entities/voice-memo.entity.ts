import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('voice_memos')
export class VoiceMemo extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'text', nullable: true })
  label!: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 64, default: 'audio/wav' })
  mimeType!: string;

  @Column({ name: 'sample_rate_hz', type: 'integer' })
  sampleRateHz!: number;

  @Column({ name: 'duration_ms', type: 'integer' })
  durationMs!: number;

  // Postgres bytea - no object storage exists anywhere in this app yet, and
  // personal-scale short voice clips don't justify introducing one. Excluded
  // from list queries (see VoiceMemosService.findAllForUser) so listing
  // memos never pulls audio bytes over the wire.
  @Column({ name: 'audio_data', type: 'bytea' })
  audioData!: Buffer;
}
