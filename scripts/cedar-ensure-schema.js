/**
 * Empty database: create the current tables, then record migrations as already applied.
 * Database that already has users: apply pending migrations only.
 * Neither path deletes existing rows.
 */
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')
const { DataSource } = require('typeorm')

require('dotenv').config({ path: path.join(__dirname, '../.env') })

const { typeOrmConfig } = require('../dist/config/typeorm.config')

function tableName(row) {
  return String(Object.values(row)[0] || '').toLowerCase()
}

async function tables() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: false })
  await ds.initialize()
  const rows = await ds.query('SHOW TABLES')
  await ds.destroy()
  return rows.map(tableName)
}

async function createCurrentSchema() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: true })
  await ds.initialize()
  await ds.destroy()
}

async function recordMigrations() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: false })
  await ds.initialize()
  await ds.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT NOT NULL AUTO_INCREMENT,
      timestamp BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB
  `)
  const dir = path.join(__dirname, '../dist/migrations')
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.js'))
  for (const file of files) {
    const imported = require(path.join(dir, file))
    const classes = Object.values(imported).filter((value) => typeof value === 'function')
    for (const Migration of classes) {
      let name = Migration.name
      try {
        const instance = new Migration()
        if (instance && typeof instance.name === 'string' && instance.name) name = instance.name
      } catch {
        continue
      }
      const timestamp = Number.parseInt(String(name).slice(-13), 10)
      if (!Number.isFinite(timestamp)) continue
      const existing = await ds.query('SELECT id FROM migrations WHERE name = ? LIMIT 1', [name])
      if (existing.length) continue
      await ds.query('INSERT INTO migrations (timestamp, name) VALUES (?, ?)', [timestamp, name])
      console.log(`Recorded migration ${name}`)
    }
  }
  await ds.destroy()
}

async function runPendingMigrations() {
  const ds = new DataSource({ ...typeOrmConfig, synchronize: false })
  await ds.initialize()
  const applied = await ds.runMigrations()
  for (const migration of applied) console.log(`Applied migration ${migration.name}`)
  if (!applied.length) console.log('No pending migrations')
  await ds.destroy()
}

async function main() {
  const names = await tables()
  if (!names.includes('users')) {
    console.log('No user tables yet. Creating the current schema.')
    await createCurrentSchema()
    await recordMigrations()
    return
  }
  console.log('User tables already exist. Applying pending migrations.')
  const baseline = spawnSync(process.execPath, [path.join(__dirname, 'baseline-migrations.js')], {
    stdio: 'inherit',
  })
  if (baseline.status !== 0) process.exit(baseline.status || 1)
  await runPendingMigrations()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
