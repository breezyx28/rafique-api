/**
 * Run seed against production DB by loading .env.production, then running the seed script.
 * From project root: npm run seed:prod  or  node scripts/seed-prod.js
 */
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env.production') });
// So typeorm.config's dotenv/config loads .env.production in the child
process.env.DOTENV_CONFIG_PATH = '.env.production';

console.log('Seeding production DB...');
execSync('bun run src/seed.ts', { stdio: 'inherit', cwd: ROOT, env: process.env });
