import { MigrationInterface, QueryRunner } from 'typeorm';

export class Utf8mb4Charset20261116010000 implements MigrationInterface {
  name = 'Utf8mb4Charset20261116010000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dbRows: Array<{ db?: string }> = await queryRunner.query(
      'SELECT DATABASE() AS db',
    );
    const database = String(dbRows[0]?.db || '').trim();
    if (!database) return;

    await queryRunner.query(
      `ALTER DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );

    const tables: Array<{ name?: string }> = await queryRunner.query(
      `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
         AND TABLE_TYPE = 'BASE TABLE'`,
      [database],
    );

    for (const row of tables) {
      const table = String(row.name || '').trim();
      if (!table) continue;
      await queryRunner.query(
        `ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      );
    }
  }

  async down(): Promise<void> {
    return;
  }
}
