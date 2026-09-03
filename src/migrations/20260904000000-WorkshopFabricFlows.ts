import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkshopFabricFlows20260904000000 implements MigrationInterface {
  name = 'WorkshopFabricFlows20260904000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE products ADD sewing_price DECIMAL(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE fabrics
       ADD selling_price_per_meter DECIMAL(12,2) NOT NULL DEFAULT 0,
       ADD sewing_rate_per_meter DECIMAL(12,2) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE orders
       MODIFY type ENUM('custom','ready','fabric') NOT NULL,
       ADD receipt_number VARCHAR(50) NULL,
       ADD workshop_delivered_at DATETIME NULL,
       ADD ready_for_receive_at DATETIME NULL,
       ADD UNIQUE INDEX IDX_orders_receipt_number (receipt_number)`,
    );
    await queryRunner.query(
      `ALTER TABLE order_items
       ADD inventory_item_id INT NULL,
       ADD workshop_status ENUM('not_ready','ready') NOT NULL DEFAULT 'not_ready',
       ADD ready_at DATETIME NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE order_item_fabric_consumptions (
        id INT NOT NULL AUTO_INCREMENT,
        order_item_id INT NOT NULL,
        fabric_id INT NOT NULL,
        meters DECIMAL(12,2) NOT NULL,
        deducted_at DATETIME NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_consumption_order_item FOREIGN KEY (order_item_id)
          REFERENCES order_items(id) ON DELETE CASCADE,
        CONSTRAINT FK_consumption_fabric FOREIGN KEY (fabric_id)
          REFERENCES fabrics(id)
      ) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE order_fabric_sales (
        id INT NOT NULL AUTO_INCREMENT,
        order_id INT NOT NULL,
        fabric_id INT NOT NULL,
        meters DECIMAL(12,2) NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        subtotal DECIMAL(12,2) NOT NULL,
        PRIMARY KEY (id),
        CONSTRAINT FK_fabric_sale_order FOREIGN KEY (order_id)
          REFERENCES orders(id) ON DELETE CASCADE,
        CONSTRAINT FK_fabric_sale_fabric FOREIGN KEY (fabric_id)
          REFERENCES fabrics(id)
      ) ENGINE=InnoDB`,
    );
    await queryRunner.query(
      `CREATE TABLE fabric_stock_movements (
        id INT NOT NULL AUTO_INCREMENT,
        fabric_id INT NOT NULL,
        type ENUM('restock','adjustment','direct_sale','workshop_consumption','reversal') NOT NULL,
        meters DECIMAL(12,2) NOT NULL,
        order_id INT NULL,
        order_item_id INT NULL,
        note VARCHAR(255) NULL,
        created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (id),
        CONSTRAINT FK_fabric_movement_fabric FOREIGN KEY (fabric_id)
          REFERENCES fabrics(id)
      ) ENGINE=InnoDB`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE fabric_stock_movements`);
    await queryRunner.query(`DROP TABLE order_fabric_sales`);
    await queryRunner.query(`DROP TABLE order_item_fabric_consumptions`);
    await queryRunner.query(
      `ALTER TABLE order_items
       DROP COLUMN ready_at,
       DROP COLUMN workshop_status,
       DROP COLUMN inventory_item_id`,
    );
    await queryRunner.query(
      `ALTER TABLE orders
       DROP INDEX IDX_orders_receipt_number,
       DROP COLUMN ready_for_receive_at,
       DROP COLUMN workshop_delivered_at,
       DROP COLUMN receipt_number,
       MODIFY type ENUM('custom','ready') NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE fabrics
       DROP COLUMN sewing_rate_per_meter,
       DROP COLUMN selling_price_per_meter`,
    );
    await queryRunner.query(`ALTER TABLE products DROP COLUMN sewing_price`);
  }
}
