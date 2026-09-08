import { MigrationInterface, QueryRunner } from 'typeorm';

export class VoiceMemos1788862403754 implements MigrationInterface {
  name = 'VoiceMemos1788862403754';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "voice_memos" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "label" text,
        "mime_type" varchar(64) NOT NULL DEFAULT 'audio/wav',
        "sample_rate_hz" integer NOT NULL,
        "duration_ms" integer NOT NULL,
        "audio_data" bytea NOT NULL
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_voice_memos_user_id" ON "voice_memos" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "voice_memos";`);
  }
}
