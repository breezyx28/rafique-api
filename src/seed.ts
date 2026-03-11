/**
 * Seed: one admin user only.
 * Username: admin
 * Password: admin
 *
 * Run once: bun run seed  (or npm run seed)
 * Creates Admin role if missing, then creates user "admin" / "admin" if that user doesn't exist.
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { typeOrmConfig } from './config/typeorm.config';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

async function seed() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: false });
  await ds.initialize();

  // Ensure Admin role exists
  let [roleRow] = await ds.query('SELECT id FROM roles WHERE name = ? LIMIT 1', ['Admin']);
  if (!roleRow) {
    await ds.query(
      `INSERT INTO roles (name, permissions) VALUES (?, ?)`,
      ['Admin', JSON.stringify(['*'])]
    );
    [roleRow] = await ds.query('SELECT id FROM roles WHERE name = ? LIMIT 1', ['Admin']);
  }
  const roleId = roleRow.id;

  // Create admin user only if it doesn't exist
  const [existing] = await ds.query('SELECT id FROM users WHERE username = ? LIMIT 1', [ADMIN_USERNAME]);
  if (!existing) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await ds.query(
      `INSERT INTO users (username, passwordHash, role_id) VALUES (?, ?, ?)`,
      [ADMIN_USERNAME, hash, roleId]
    );
    console.log(`Created admin user: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}`);
  } else {
    console.log(`Admin user "${ADMIN_USERNAME}" already exists, skip.`);
  }

  await ds.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
