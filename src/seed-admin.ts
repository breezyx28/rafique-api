/**
 * Admin seed: creates only the admin user (and Admin role if missing).
 * Does not touch any other tables.
 *
 * Run: bun run seed:admin  (or npm run seed:admin)
 * Username: admin / Password: admin
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { typeOrmConfig } from './config/typeorm.config';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

async function seedAdmin() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: false });
  await ds.initialize();

  // Ensure Admin role exists (only table we touch besides users)
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

seedAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
