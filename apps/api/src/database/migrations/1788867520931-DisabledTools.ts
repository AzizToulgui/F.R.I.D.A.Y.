import { MigrationInterface, QueryRunner } from 'typeorm';

export class DisabledTools1788867520931 implements MigrationInterface {
  name = 'DisabledTools1788867520931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "disabled_tools" text[] NOT NULL DEFAULT '{}';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "disabled_tools";
    `);
  }
}
