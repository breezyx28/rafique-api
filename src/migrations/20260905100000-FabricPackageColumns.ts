import { MigrationInterface, QueryRunner } from 'typeorm';

export class FabricPackageColumns20260905100000 implements MigrationInterface {
  name = 'FabricPackageColumns20260905100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const meters = await queryRunner.query(
      `SHOW COLUMNS FROM fabrics LIKE 'package_meters'`,
    );
    if (!meters.length) {
      await queryRunner.query(
        `ALTER TABLE fabrics
         ADD package_meters DECIMAL(12,2) NOT NULL DEFAULT 20`,
      );
    }
    const price = await queryRunner.query(
      `SHOW COLUMNS FROM fabrics LIKE 'package_price'`,
    );
    if (!price.length) {
      await queryRunner.query(
        `ALTER TABLE fabrics
         ADD package_price DECIMAL(12,2) NOT NULL DEFAULT 0`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE fabrics
       DROP COLUMN package_price,
       DROP COLUMN package_meters`,
    );
  }
}
