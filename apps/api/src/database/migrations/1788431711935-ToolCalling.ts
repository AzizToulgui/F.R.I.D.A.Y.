import { MigrationInterface, QueryRunner } from 'typeorm';

export class ToolCalling1788431711935 implements MigrationInterface {
  name = 'ToolCalling1788431711935';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reminders" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "text" text NOT NULL,
        "due_at" timestamptz,
        "completed_at" timestamptz
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_reminders_user_id" ON "reminders" ("user_id");
    `);

    await queryRunner.query(`
      CREATE TYPE "tool_invocations_status_enum" AS ENUM ('success', 'error', 'blocked');
    `);
    await queryRunner.query(`
      CREATE TABLE "tool_invocations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "conversation_id" uuid,
        "tool_name" varchar(128) NOT NULL,
        "arguments" jsonb NOT NULL,
        "result" jsonb,
        "status" "tool_invocations_status_enum" NOT NULL
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_tool_invocations_user_id" ON "tool_invocations" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tool_invocations";`);
    await queryRunner.query(`DROP TYPE "tool_invocations_status_enum";`);
    await queryRunner.query(`DROP TABLE "reminders";`);
  }
}
