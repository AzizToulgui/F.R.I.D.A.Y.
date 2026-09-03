import { MigrationInterface, QueryRunner } from 'typeorm';

export class Rag1788435269219 implements MigrationInterface {
  name = 'Rag1788435269219';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "documents_format_enum" AS ENUM ('pdf', 'docx', 'md', 'txt');
    `);
    await queryRunner.query(`
      CREATE TYPE "documents_status_enum" AS ENUM ('indexing', 'indexed', 'error');
    `);
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(255) NOT NULL,
        "format" "documents_format_enum" NOT NULL,
        "status" "documents_status_enum" NOT NULL DEFAULT 'indexing',
        "error_message" text,
        "content_hash" varchar(64) NOT NULL,
        "size_bytes" int NOT NULL,
        "chunk_count" int NOT NULL DEFAULT 0
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_user_id" ON "documents" ("user_id");
    `);
    // Backs DocumentsService.createFromUpload's re-upload short-circuit.
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_documents_user_id_content_hash" ON "documents" ("user_id", "content_hash");
    `);

    await queryRunner.query(`
      CREATE TABLE "document_chunks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL,
        "content" text NOT NULL,
        -- Same fixed width as memories.embedding - both come from
        -- GeminiConfig.embeddingDimensions (768 by default).
        "embedding" vector(768) NOT NULL,
        "chunk_index" int NOT NULL,
        "heading_path" text
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_chunks_document_id" ON "document_chunks" ("document_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_chunks_user_id" ON "document_chunks" ("user_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_document_chunks_embedding_hnsw" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "document_chunks";`);
    await queryRunner.query(`DROP TABLE "documents";`);
    await queryRunner.query(`DROP TYPE "documents_status_enum";`);
    await queryRunner.query(`DROP TYPE "documents_format_enum";`);
  }
}
