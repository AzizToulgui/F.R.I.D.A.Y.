import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { User } from '../../users/entities/user.entity';

export enum DocumentFormat {
  PDF = 'pdf',
  DOCX = 'docx',
  MARKDOWN = 'md',
  TEXT = 'txt',
}

export enum DocumentStatus {
  INDEXING = 'indexing',
  INDEXED = 'indexed',
  ERROR = 'error',
}

@Entity('documents')
export class Document extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'enum', enum: DocumentFormat })
  format!: DocumentFormat;

  @Column({ type: 'enum', enum: DocumentStatus, default: DocumentStatus.INDEXING })
  status!: DocumentStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  // sha256 of the raw uploaded bytes - lets a re-upload of the same file
  // short-circuit to the existing row instead of re-parsing/re-embedding it
  // (ARCHITECTURE.md Section 11: "re-embedding is skipped for unchanged documents").
  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes!: number;

  @Column({ name: 'chunk_count', type: 'int', default: 0 })
  chunkCount!: number;
}
