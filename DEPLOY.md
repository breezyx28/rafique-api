# Deploy to server

Deployment is done via **GitHub Actions** to **rafique-api.kat-jr.com**. The workflow does **not** build on the runner; it SSHs to the server and runs **git pull**, then **decode env**, **install**, **build**, and **PM2** there.

- **Server:** `rafique-api.kat-jr.com` (IP: `178.104.33.83`)
- **Deploy path (app root on server):** `/var/www/html/rafique/api`
- **Triggers:** Push to `master`, or run manually via **Actions → Deploy API → Run workflow**

---

## Deployment flow (on the server)

1. **git pull origin master** – get latest code.
2. **Decode** `.env.production.enc` → `.env` in the repo root (using `ENV_SECRET` from GitHub Secrets).
3. **npm install** – install dependencies.
4. **npx nest build** – build the app (output in `dist/`).
5. **PM2** – `pm2 reload rafique-api` or `pm2 start dist/main.js --name rafique-api`, then `pm2 save` and `pm2 startup`.

Production env stays encrypted in the repo (`.env.production.enc`); only the password is in GitHub Secrets. The server never stores the plain env in the repo; it is decoded at deploy time.

---

## One-time setup

**1. Clone the repo on the server**

SSH into the server and clone the repository at the deploy path. Ensure the server can **git pull** (e.g. HTTPS with token, or SSH deploy key added to the repo):

```bash
ssh your-user@rafique-api.kat-jr.com
sudo mkdir -p /var/www/html/rafique
sudo chown your-user:your-user /var/www/html/rafique
cd /var/www/html/rafique
git clone <your-repo-url> api
cd api
git checkout master
```

(Replace `<your-repo-url>` with the repo URL. If the repo is private, configure access: deploy key, token, etc.)

**2. Install Node.js and PM2 on the server**

The workflow runs `npm install` and `npx nest build`, and PM2 to run the app. The server only needs **Node.js** and **npm** (no Bun). Example (adjust for your OS):

```bash
# Node (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2
```

**3. Encode production env and commit the encrypted file**

Production env is **not** stored in GitHub in plain form. You encrypt `.env.production` with a password and commit the encrypted file; only the **password** is stored as a secret.

From your **local** project root (with `.env.production` present and **not** committed):

```bash
ENV_SECRET=your-secret-password node scripts/encode-env.js
```

This creates **`.env.production.enc`**. Commit and push it. Ensure `.env.production` stays in `.gitignore`.

**4. Add GitHub Actions secrets**

In the repo: **Settings → Secrets and variables → Actions**, add:

| Secret             | Description |
|--------------------|-------------|
| `SSH_PRIVATE_KEY`  | The **private** key that the **server** accepts for SSH (same key you use to `ssh user@rafique-api.kat-jr.com`). Put its contents here. No passphrase. |
| `SSH_USER`         | SSH username for the server. |
| `ENV_SECRET`       | The **password** you used when running `scripts/encode-env.js`. The workflow uses it on the server to decode `.env.production.enc` → `.env` before build. |

After that, every push to `master` (or a manual run of the workflow) will trigger: on the server, **git pull** → **decode .env** → **npm install** → **npx nest build** → **PM2** start/reload.

**Changing production env later:** Edit `.env.production` locally, run `ENV_SECRET=your-password node scripts/encode-env.js` again, commit the updated `.env.production.enc`, and push.

**5. PM2 startup (one-time)**

After the first deploy, if `pm2 startup` prints a command with `sudo`, run that once on the server so the app starts on reboot.

---

## Seeding the database (production)

After the first deploy (or when the production DB is empty), run the seed.

### On the server

You have the full repo on the server. From the app directory:

```bash
cd /var/www/html/rafique/api
npx ts-node src/seed.ts
```

(Or install Bun and run `bun run seed`.) The app uses the `.env` in that directory (decoded at deploy time). If you prefer not to run the seed on the server, use "From your machine" below.

### From your machine

From the project root (with `.env.production` present):

```bash
npm run seed:prod
```

(or `bun run seed:prod`). This connects to the production DB using `.env.production` and runs the same seed logic.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| `Permission denied (publickey)` | Ensure `SSH_PRIVATE_KEY` is the private key the server accepts (same as your SSH key to the server). |
| `git pull` fails | Ensure the repo is cloned and the server can pull (deploy key, token, or HTTPS credentials). |
| `.env.production.enc not found` | Run `scripts/encode-env.js` locally, commit `.env.production.enc`, and push. |
| Decode fails | Ensure `ENV_SECRET` in GitHub Secrets matches the password used with `scripts/encode-env.js`. |
| Build fails on server | SSH in and run `npm install` and `npx nest build` manually; fix any errors. Ensure Node.js and npm are installed. |
