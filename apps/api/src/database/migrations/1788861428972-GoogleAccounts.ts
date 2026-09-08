import { MigrationInterface, QueryRunner } from 'typeorm';

export class GoogleAccounts1788861428972 implements MigrationInterface {
  name = 'GoogleAccounts1788861428972';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Accounts created via "Continue with Google" never set a password.
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE "google_accounts" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
        "google_user_id" varchar(255) NOT NULL,
        "google_email" varchar(255) NOT NULL,
        "access_token_encrypted" text NOT NULL,
        "refresh_token_encrypted" text,
        "access_token_expires_at" timestamptz NOT NULL,
        "scopes" text NOT NULL
      );
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_google_accounts_user_id" ON "google_accounts" ("user_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "google_accounts";`);
    // Not reversed: NOT NULL can't be safely restored without knowing which
    // rows have a null password_hash from Google-only accounts created while
    // this migration was active.
  }
}
