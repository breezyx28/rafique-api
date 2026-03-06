/**
 * Deploy script: build → zip dist → SCP → SSH extract.
 * Uses .env: SSH_HOST, SSH_USER, REMOTE_DIR, (optional) SSH_KEY.
 * Run: npm run deploy  (or bun run deploy)
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const ZIP_NAME = 'deploy.zip';
const ZIP_PATH = path.join(ROOT, ZIP_NAME);

const SSH_HOST = process.env.SSH_HOST || 'kat.sd';
const SSH_USER = process.env.SSH_USER || 'kattop';
const REMOTE_DIR = process.env.REMOTE_DIR || 'public_html/rafique/api';
const SSH_KEY = process.env.SSH_KEY;

const sshTarget = `${SSH_USER}@${SSH_HOST}`;
const scpOpts = SSH_KEY ? `-i "${SSH_KEY}"` : '';
const sshOpts = SSH_KEY ? `-i "${SSH_KEY}"` : '';

function run(cmd, opts = {}) {
  console.log('>', cmd);
  return execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function zipDir(dirPath, outPath) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(dirPath)) {
      reject(new Error(`Dist folder not found: ${dirPath}. Run build first.`));
      return;
    }
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => resolve());
    archive.on('error', reject);
    archive.pipe(output);
    // Put contents of dist at root of archive (no "dist/" prefix)
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

const ENV_PRODUCTION = path.join(ROOT, '.env.production');

async function main() {
  console.log('1. Building...');
  run('bun run build');

  console.log('2. Replacing .env in build with .env.production...');
  if (!fs.existsSync(ENV_PRODUCTION)) {
    throw new Error('.env.production not found. Create it with production DB and app config.');
  }
  fs.copyFileSync(ENV_PRODUCTION, path.join(DIST, '.env'));

  console.log('3. Zipping dist...');
  await zipDir(DIST, ZIP_PATH);
  console.log('   Created', ZIP_PATH);

  console.log('4. Uploading via SCP...');
  const scpCmd = scpOpts
    ? `scp ${scpOpts} "${ZIP_PATH}" ${sshTarget}:~/deploy.zip`
    : `scp "${ZIP_PATH}" ${sshTarget}:~/deploy.zip`;
  run(scpCmd);

  console.log('5. Extracting on server...');
  const remoteCmd = `mkdir -p "${REMOTE_DIR}" && rm -rf "${REMOTE_DIR}"/* && unzip -o ~/deploy.zip -d "${REMOTE_DIR}" && rm ~/deploy.zip`;
  const sshCmd = sshOpts
    ? `ssh ${sshOpts} ${sshTarget} "${remoteCmd}"`
    : `ssh ${sshTarget} "${remoteCmd}"`;
  run(sshCmd);

  console.log('6. Cleanup local zip...');
  fs.unlinkSync(ZIP_PATH);

  console.log('Done. API deployed to', `${sshTarget}:${REMOTE_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
