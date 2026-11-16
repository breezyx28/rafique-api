import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkshopWagePayouts20261116140000 implements MigrationInterface {
  name = 'WorkshopWagePayouts20261116140000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`workshop_wage_payouts\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`amount\` decimal(12,2) NOT NULL,
        \`balance_before\` decimal(12,2) NOT NULL,
        \`balance_after\` decimal(12,2) NOT NULL,
        \`note\` text NULL,
        \`created_by_user_id\` int NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_workshop_wage_payouts_created_at\` (\`created_at\`),
        KEY \`IDX_workshop_wage_payouts_created_by\` (\`created_by_user_id\`),
        CONSTRAINT \`FK_workshop_wage_payouts_user\`
          FOREIGN KEY (\`created_by_user_id\`) REFERENCES \`users\`(\`id\`)
          ON DELETE RESTRICT ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`workshop_wage_payouts\``);
  }
}
