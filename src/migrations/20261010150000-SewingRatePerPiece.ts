import { MigrationInterface, QueryRunner } from 'typeorm';

export class SewingRatePerPiece20261010150000 implements MigrationInterface {
  name = 'SewingRatePerPiece20261010150000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const column = await queryRunner.query(
      `SHOW COLUMNS FROM order_items LIKE 'sewing_rate_applied'`,
    );
    if (!column.length) return;
    await queryRunner.query(
      `UPDATE order_items SET sewing_rate_applied = NULL`,
    );
  }

  async down(): Promise<void> {
    return;
  }
}
