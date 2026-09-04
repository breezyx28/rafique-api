import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReadyProductDetails20260904100000 implements MigrationInterface {
  name = 'ReadyProductDetails20260904100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE inventory_items
       ADD color VARCHAR(80) NULL,
       ADD note TEXT NULL,
       ADD fabric_id INT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE inventory_items
       ADD CONSTRAINT FK_inventory_item_fabric
       FOREIGN KEY (fabric_id) REFERENCES fabrics(id) ON DELETE SET NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE inventory_items DROP FOREIGN KEY FK_inventory_item_fabric`,
    );
    await queryRunner.query(
      `ALTER TABLE inventory_items
       DROP COLUMN color,
       DROP COLUMN note,
       DROP COLUMN fabric_id`,
    );
  }
}
