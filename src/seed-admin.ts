/**
 * Admin seed: creates only the admin user (and Admin role if missing).
 * Does not touch any other tables. Uses a connection-only DataSource (no entities)
 * so other entity files (Order, Product, etc.) are never loaded.
 *
 * Run: bun run seed:admin  (or npm run seed:admin)
 * Username: admin / Password: admin
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: process.env.DOTENV_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.DOTENV_CONFIG_PATH)
    : path.resolve(process.cwd(), '.env'),
});

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';

async function seedAdmin() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'rafique_tailors_db',
    entities: [],
    synchronize: false,
  });
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
