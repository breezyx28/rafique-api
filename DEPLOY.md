# Deploy to server

Deployment is done via **GitHub Actions** to **rafique-api.kat-jr.com** at `/var/www/html/rafique/api` (push to `master` or manual run).

---

## GitHub Actions (automated deploy)

The workflow in `.github/workflows/deploy.yml` does the following:

1. **Build** the app (output in `dist/`).
2. **Add production env to the build** – decodes `.env.production.enc` and writes it as `dist/.env`.
3. **Encrypt** `dist/.env` → `dist/.env.enc` and remove plain `dist/.env` (so only the encrypted file is deployed).
4. **Deploy** the build folder to the server via rsync (contents of `dist/` go to `/var/www/html/rafique/api`).
5. **On the server:** decrypt `.env.enc` → `.env` in the deploy directory.
6. **On the server:** run the API with PM2 (`pm2 start main.js --name rafique-api` or `pm2 reload rafique-api`), then `pm2 save` and `pm2 startup`.

- **Server:** `rafique-api.kat-jr.com` (IP: `178.104.33.83`)
- **Deploy path:** `/var/www/html/rafique/api`
- **Triggers:** Push to `master`, or run manually via **Actions → Deploy API → Run workflow**

### One-time setup

**1. Create the deploy path on the server**

SSH into the server (from your local device) and ensure the directory exists and is writable by the user you use in the workflow:

```bash
ssh your-user@rafique-api.kat-jr.com
sudo mkdir -p /var/www/html/rafique/api
sudo chown your-user:your-user /var/www/html/rafique/api
```

(Replace `your-user` with the same user you put in the `SSH_USER` secret below.)

**2. Encode production env and commit the encrypted file**

Production env is **not** stored in GitHub. You encrypt `.env.production` with a password and commit the encrypted file; only the **password** is stored as a secret.

From the project root (with `.env.production` present and **not** committed):

```bash
# Pick a strong password and use it both here and in GitHub Secrets (step 3).
ENV_SECRET=your-secret-password node scripts/encode-env.js
```

This creates **`.env.production.enc`**. Commit this file (it is safe to commit; it is encrypted). Ensure `.env.production` stays in `.gitignore`.

**3. Add GitHub Actions secrets**

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret             | Description |
|--------------------|-------------|
| `SSH_PRIVATE_KEY`  | **Which key?** The **private** key that the **server** accepts for SSH login. That is usually the **same key you use on your local device** when you run `ssh user@rafique-api.kat-jr.com`. So: copy the contents of that private key (e.g. `~/.ssh/id_ed25519` or `~/.ssh/id_rsa`) into this secret. The server already has the matching **public** key in `~/.ssh/authorized_keys`. Do not use the server's own key; use the key that can **log into** the server. No passphrase, or the workflow cannot use it. |
| `SSH_USER`         | SSH username for the server (e.g. `root`, `ubuntu`, or the user you use when you SSH from your laptop). |
| `ENV_SECRET`       | The **password** you used when running `scripts/encode-env.js`. The workflow uses it to decode `.env.production.enc` → `dist/.env`, then encrypt to `dist/.env.enc` for deploy, and on the server to decrypt `.env.enc` → `.env`. |

After that, every push to `master` (or a manual run of the workflow) will build, encrypt env, deploy, decrypt on the server, and start or reload the API with PM2 (`rafique-api`).

**Changing production env later:** Edit `.env.production` locally, run `ENV_SECRET=your-password node scripts/encode-env.js` again, then commit the updated `.env.production.enc`.

**4. PM2 on the server (one-time)**

The workflow runs `pm2 start main.js --name rafique-api` (or `pm2 reload rafique-api`) and then `pm2 save` and `pm2 startup`. Ensure PM2 is installed on the server (e.g. `npm install -g pm2`). If `pm2 startup` prints a command with `sudo`, run that once on the server so the app starts on reboot.

---

## Seeding the database (production)

After the first deploy (or when the production DB is empty), run the seed so the production database gets the default Admin role and `admin` / `admin` user. You can do it **on the server** or **from your machine**.

### On the server (recommended)

The deploy includes a compiled `seed.js`. SSH into the server, go to the API directory (e.g. `/var/www/html/rafique/api/`), then run:

```bash
npm run seed:server
```

or:

```bash
node seed.js
```

The app uses the `.env` in that folder (production credentials from the deploy).

### From your machine

From the **project root** (where you have the repo and `.env.production`), run:

```bash
npm run seed:prod
```

(or `bun run seed:prod`). This connects to the production DB using `.env.production` and runs the same seed logic.

Run the seed **once** after the first deploy, or whenever you need to restore default data.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| `Permission denied (publickey)` | Ensure `SSH_PRIVATE_KEY` is the private key that the server accepts (same key you use to SSH from your laptop). |
| Build fails | Run `bun run build` (or `npm run build`) locally and fix any errors. |
| Workflow fails at decode/encrypt | Ensure `.env.production.enc` is committed and `ENV_SECRET` matches the password used with `scripts/encode-env.js`. |
