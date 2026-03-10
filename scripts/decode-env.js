/**
 * Decrypt env file using ENV_SECRET.
 * - CI: decrypt .env.production.enc -> dist/.env
 * - Server (--inplace): decrypt .env.enc -> .env in current directory
 *
 * Usage (CI): ENV_SECRET=... node scripts/decode-env.js
 * Usage (server): cd /var/www/html/rafique/api && ENV_SECRET=... node decode-env.js --inplace
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const ALGO = 'aes-256-cbc';
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 16;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

function main() {
  const password = process.env.ENV_SECRET;
  if (!password) {
    console.error('ENV_SECRET is not set.');
    process.exit(1);
  }

  const inplace = process.argv.includes('--inplace');
  const encPath = inplace ? path.join(process.cwd(), '.env.enc') : path.join(ROOT, '.env.production.enc');
  const outPath = inplace ? path.join(process.cwd(), '.env') : path.join(ROOT, 'dist', '.env');

  if (!fs.existsSync(encPath)) {
    console.error(inplace ? '.env.enc not found in current directory.' : '.env.production.enc not found.');
    process.exit(1);
  }

  const buf = fs.readFileSync(encPath);
  const salt = buf.subarray(0, SALT_LEN);
  const iv = buf.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const ciphertext = buf.subarray(SALT_LEN + IV_LEN);
  const key = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, plain);
  console.log('Decrypted', path.basename(encPath), '->', path.basename(outPath));
}

main();
