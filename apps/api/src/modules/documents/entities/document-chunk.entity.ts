import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../database/entities/base.entity';
import { Document } from './document.entity';

// Deliberately does NOT map the `embedding vector(n)` column - same reasoning
// as the Memory entity: TypeORM has no native pgvector column type, so every
// write or similarity read of it goes through raw SQL in DocumentsService
// and DocumentIndexingProcessor instead.
@Entity('document_chunks')
export class DocumentChunk extends BaseEntity {
  @Index()
  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document?: Document;

  // Denormalized from documents.user_id - Section 11: "every chunk row
  // carries owner_user_id... all retrieval queries are scoped by that
  // column", so retrieval never has to join through `documents` just to
  // enforce tenant isolation.
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  // Nearest markdown/heading context above this chunk, if any - shown
  // alongside citations so "cite the source" means something more specific
  // than just the document title.
  @Column({ name: 'heading_path', type: 'text', nullable: true })
  headingPath!: string | null;
}
