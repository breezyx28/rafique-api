/**
 * Encrypt .env.production into .env.production.enc using a password.
 * Password from ENV_SECRET env var or first argument.
 * Commit .env.production.enc; store the password in GitHub Secrets as ENV_SECRET.
 *
 * Usage: ENV_SECRET=yourpassword node scripts/encode-env.js
 *    or: node scripts/encode-env.js yourpassword
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '.env.production');
const OUT = path.join(ROOT, '.env.production.enc');

const ALGO = 'aes-256-cbc';
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 16;
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };

function main() {
  const password = process.env.ENV_SECRET || process.argv[2];
  if (!password) {
    console.error('Set ENV_SECRET or pass password as first argument.');
    process.exit(1);
  }

  if (!fs.existsSync(SRC)) {
    console.error('.env.production not found.');
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
  console.log('Wrote .env.production.enc (commit this file; add ENV_SECRET to GitHub Secrets).');
}

main();
