import { MigrationInterface, QueryRunner } from 'typeorm';

export class VoicePreferences1788520779652 implements MigrationInterface {
  name = 'VoicePreferences1788520779652';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "voice_name" varchar(64),
        ADD COLUMN "voice_delivery_style" varchar(64);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
        DROP COLUMN "voice_name",
        DROP COLUMN "voice_delivery_style";
    `);
  }
}
