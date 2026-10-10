import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReceivablesAndSewingRate20261010000000 implements MigrationInterface {
  name = 'ReceivablesAndSewingRate20261010000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const rate = await queryRunner.query(
      `SHOW COLUMNS FROM order_items LIKE 'sewing_rate_applied'`,
    );
    if (!rate.length) {
      await queryRunner.query(
        `ALTER TABLE order_items ADD sewing_rate_applied DECIMAL(12,2) NULL`,
      );
    }

    const payments = await queryRunner.query(
      `SHOW TABLES LIKE 'order_payments'`,
    );
    if (!payments.length) {
      await queryRunner.query(`
        CREATE TABLE order_payments (
          id INT NOT NULL AUTO_INCREMENT,
          order_id INT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          payment_method ENUM('cash','mbok') NOT NULL,
          paid_at DATETIME NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (id),
          KEY IDX_order_payments_order_id (order_id),
          CONSTRAINT FK_order_payments_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        )
      `);
    }

    await queryRunner.query(
      `ALTER TABLE notifications MODIFY kind ENUM('due','stock','balance') NOT NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE notifications MODIFY kind ENUM('due','stock') NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS order_payments`);
    await queryRunner.query(
      `ALTER TABLE order_items DROP COLUMN sewing_rate_applied`,
    );
  }
}
