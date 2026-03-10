/**
 * Encrypt dist/.env into dist/.env.enc for deploy (same format as encode-env).
 * Used in CI before rsync so only encrypted env is deployed.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'dist', '.env');
const OUT = path.join(ROOT, 'dist', '.env.enc');

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

  if (!fs.existsSync(SRC)) {
    console.error('dist/.env not found.');
    process.exit(1);
  }

  const plain = fs.readFileSync(SRC, 'utf8');
  const salt = crypto.randomBytes(SALT_LEN);
  const key = crypto.scryptSync(password, salt, KEY_LEN, SCRYPT_OPTS);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const out = Buffer.concat([salt, iv, encrypted]);
  fs.writeFileSync(OUT, out);
  fs.unlinkSync(SRC);
  console.log('Encrypted dist/.env -> dist/.env.enc (removed .env)');
}

main();
