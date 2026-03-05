/**
 * Run this once to create default role and admin user.
 * From api folder: bun run seed
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { typeOrmConfig } from './config/typeorm.config';

async function seed() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: true });
  await ds.initialize();

  const roles = await ds.query('SELECT id FROM roles LIMIT 1');
  let roleId = roles[0]?.id;
  if (!roleId) {
    await ds.query(
      `INSERT INTO roles (name, permissions) VALUES (?, ?)`,
      ['Admin', JSON.stringify(['*'])]
    );
    const [row] = await ds.query('SELECT id FROM roles WHERE name = ?', ['Admin']);
    roleId = row.id;
  }

  const users = await ds.query('SELECT id FROM users LIMIT 1');
  if (users.length === 0) {
    const hash = await bcrypt.hash('admin', 10);
    await ds.query(
      `INSERT INTO users (username, passwordHash, role_id) VALUES (?, ?, ?)`,
      ['admin', hash, roleId]
    );
    console.log('Created default user: admin / admin');
  } else {
    console.log('Users already exist, skip seed.');
  }
  await ds.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
