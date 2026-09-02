import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConversationEngine1788385582122 implements MigrationInterface {
  name = 'ConversationEngine1788385582122';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "conversations" ADD COLUMN "summary_up_to_message_id" uuid;
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations" ADD COLUMN "custom_instructions" text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "custom_instructions";`);
    await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "summary_up_to_message_id";`);
  }
}
