import { MigrationInterface, QueryRunner } from 'typeorm';

export class Notes1788517901454 implements MigrationInterface {
  name = 'Notes1788517901454';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "notes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" text,
        "content" text NOT NULL
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_notes_user_id" ON "notes" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "notes";`);
  }
}
