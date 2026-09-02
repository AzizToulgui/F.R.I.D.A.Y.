import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitSchema1788264214733 implements MigrationInterface {
  name = 'InitSchema1788264214733';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "email" varchar(255) NOT NULL,
        "password_hash" text NOT NULL,
        "display_name" varchar(120) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_users_email" ON "users" ("email");
    `);

    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "selector" varchar(32) NOT NULL,
        "token_hash" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "replaced_by_token_id" uuid,
        "user_agent" text,
        "ip_address" varchar(64)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id");
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_refresh_tokens_selector" ON "refresh_tokens" ("selector");
    `);

    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title" varchar(200) NOT NULL DEFAULT 'New conversation',
        "summary" text,
        "archived_at" timestamptz
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_user_id" ON "conversations" ("user_id");
    `);

    await queryRunner.query(`
      CREATE TYPE "messages_role_enum" AS ENUM ('user', 'assistant', 'system', 'tool');
    `);
    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
        "role" "messages_role_enum" NOT NULL,
        "content" text NOT NULL,
        "token_count" int,
        "metadata" jsonb
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversation_id" ON "messages" ("conversation_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages";`);
    await queryRunner.query(`DROP TYPE "messages_role_enum";`);
    await queryRunner.query(`DROP TABLE "conversations";`);
    await queryRunner.query(`DROP TABLE "refresh_tokens";`);
    await queryRunner.query(`DROP TABLE "users";`);
  }
}
