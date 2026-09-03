import { MigrationInterface, QueryRunner } from 'typeorm';

export class Memory1788428391478 implements MigrationInterface {
  name = 'Memory1788428391478';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The dev/prod Postgres image is pgvector/pgvector (see docker-compose.yml)
    // specifically so this extension is available.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);

    await queryRunner.query(`
      CREATE TABLE "memories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "content" text NOT NULL,
        -- Fixed width to match GeminiConfig.embeddingDimensions (768 by
        -- default) - every embedding is generated with that same
        -- outputDimensionality, so this never mismatches at insert time.
        "embedding" vector(768) NOT NULL,
        "source_conversation_id" uuid,
        "confidence" float NOT NULL DEFAULT 1,
        "last_used_at" timestamptz
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_memories_user_id" ON "memories" ("user_id");
    `);
    // HNSW over cosine distance - matches the `<=>` operator used by
    // MemoriesService for both dedup and top-k retrieval.
    await queryRunner.query(`
      CREATE INDEX "IDX_memories_embedding_hnsw" ON "memories" USING hnsw ("embedding" vector_cosine_ops);
    `);

    await queryRunner.query(`
      ALTER TABLE "conversations" ADD COLUMN "memory_extracted_up_to_message_id" uuid;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "memory_extracted_up_to_message_id";`);
    await queryRunner.query(`DROP TABLE "memories";`);
  }
}
