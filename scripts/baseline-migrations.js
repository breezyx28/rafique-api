/**
 * Marks already-applied schema as migrated so production DBs created
 * with synchronize (or leftover InitialSchema files) can deploy cleanly.
 */
const fs = require('fs')
const path = require('path')
const mysql = require('mysql2/promise')

const ROOT = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    if (process.env[key] == null) process.env[key] = value
  }
}

const KNOWN = [
  {
    timestamp: 1773190406192,
    name: 'InitialSchema1773190406192',
    check: "SHOW TABLES LIKE 'roles'",
  },
  {
    timestamp: 260904000000,
    name: 'WorkshopFabricFlows20260904000000',
    check: "SHOW COLUMNS FROM orders LIKE 'workshop_delivered_at'",
  },
  {
    timestamp: 260904100000,
    name: 'ReadyProductDetails20260904100000',
    check: "SHOW COLUMNS FROM inventory_items LIKE 'color'",
  },
  {
    timestamp: 260905100000,
    name: 'FabricPackageColumns20260905100000',
    check: "SHOW COLUMNS FROM fabrics LIKE 'package_meters'",
  },
]

async function main() {
  loadEnv()
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  })

  await conn.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INT NOT NULL AUTO_INCREMENT,
      timestamp BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB
  `)

  for (const row of KNOWN) {
    try {
      const [found] = await conn.query(row.check)
      if (!found || found.length === 0) continue
    } catch {
      continue
    }
    const [existing] = await conn.query('SELECT id FROM migrations WHERE name = ? LIMIT 1', [row.name])
    if (existing.length) continue
    await conn.query('INSERT INTO migrations (timestamp, name) VALUES (?, ?)', [row.timestamp, row.name])
    console.log(`Baselined ${row.name}`)
  }

  await conn.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
