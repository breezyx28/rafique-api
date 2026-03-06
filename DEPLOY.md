# Deploy to server (npm run deploy)

This document describes how to deploy the **NestJS API** build to the server using **only** `npm run deploy`. No GitHub Actions, no manual FTP—just one command.

---

## What `npm run deploy` does

1. **Build** – Runs `npm run build` (NestJS/TypeScript compile). Output goes to the `dist/` folder.
2. **Production env** – Copies `.env.production` into `dist/.env` so the deployed app uses production config (DB, `NODE_ENV`, etc.).
3. **Package** – Copies `package.json` into `dist/` so the server has it for installs or process managers.
4. **Zip** – Creates a deploy zip with the **contents** of `dist/` (compiled JS, `.env`, and `package.json` at the root of the archive).
5. **Upload** – Copies the zip to the server via **SCP** (SSH key only, no password).
6. **Extract on server** – **SSH** into the server and:
   - Ensures `public_html/rafique/api/` exists
   - Clears that folder
   - Unzips the build into `public_html/rafique/api/`
   - Deletes the zip on the server
7. **Cleanup** – Deletes the local zip.

Result: the **API** is updated at **`public_html/rafique/api/`** with the latest build.

---

## Prerequisites

- **Node.js** (and npm) installed so `npm run build` works.
- **OpenSSH** (or Git for Windows) so `scp` and `ssh` are in your PATH.
- **SSH key** for `kattop@kat.sd` set up so you can log in without a password.

---

## One-time setup

### 1. SSH key for the server

You must be able to run:

```bash
ssh kattop@kat.sd
```

and get a shell **without** being asked for a password.

- If you already have a key (e.g. `~/.ssh/id_rsa` or `~/.ssh/id_ed25519`) and it’s added to the server’s `~/.ssh/authorized_keys`, you’re done.
- If not:
  - Generate a key: `ssh-keygen -t ed25519 -C "your@email"` (or `-t rsa`).
  - Copy it to the server: `ssh-copy-id kattop@kat.sd` (or add the contents of `~/.ssh/id_ed25519.pub` to `~/.ssh/authorized_keys` on the server).

Test:

```bash
ssh kattop@kat.sd "echo ok"
```

You should see `ok` and no password prompt.

### 2. Environment file (optional)

The deploy script uses these defaults:

- **Host:** `kat.sd`
- **User:** `kattop`
- **Remote path:** `public_html/rafique/api`

To override them (or to use a specific SSH key), create a `.env` file in the **project root** (same folder as `package.json`):

```env
# SCP deploy (SSH key only)
SSH_HOST=kat.sd
SSH_USER=kattop
REMOTE_DIR=public_html/rafique/api
```

Optional:

- **SSH_KEY** – Path to your private key if you don’t use the default (e.g. `~/.ssh/id_rsa` or `C:\Users\You\.ssh\id_rsa`).

Example with custom key:

```env
SSH_HOST=kat.sd
SSH_USER=kattop
REMOTE_DIR=public_html/rafique/api
SSH_KEY=C:\Users\YourName\.ssh\id_rsa
```

`.env` is in `.gitignore`; don’t commit it.

### 3. Production environment (`.env.production`)

The deploy script **replaces** the build’s env with production config by copying `.env.production` into `dist/.env` before zipping. That way the server receives a `.env` file with production database and app settings—no manual `.env` on the server.

- Create **`.env.production`** in the project root (same folder as `package.json`).
- Put production values in it: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `NODE_ENV=production`, `PORT`, and any other vars the app needs.
- **Do not commit** `.env.production`; add it to `.gitignore` (it contains secrets).

The API loads `.env` at startup via `dotenv`, so when you run `node main.js` on the server, it will use the `.env` that was bundled in the deploy zip.

---

## How to deploy

From the project root (where `package.json` is), run:

```bash
npm run deploy
```

That’s it. The script will:

1. Build the API
2. Zip the build
3. Upload via SCP
4. SSH in and extract into `public_html/rafique/api/`

No extra steps. Use **only** this command to deploy.

---

## Seeding the database (production)

After the first deploy (or when the production DB is empty), seed it from your **local machine** so the production database gets the default admin role and user. The seed uses your **`.env.production`** credentials to connect to the production DB.

From the project root:

```bash
npm run seed:prod
```

(or `bun run seed:prod`)

This runs the same seed as `npm run seed` but loads `.env.production` instead of `.env`, so it connects to the production database and creates the default Admin role and `admin` / `admin` user if they don’t exist.

- Run it **once** after the first deploy, or whenever you need to reset/restore default data.
- You do **not** need to SSH into the server; run it from your machine where the repo and `.env.production` live.

---

## Troubleshooting

| Problem | What to check |
|--------|----------------|
| `scp: command not found` or `ssh: command not found` | Install OpenSSH or use Git for Windows (Git Bash). Ensure `scp` and `ssh` are in your PATH. |
| Password prompt when running deploy | Your default SSH key isn’t used for `kattop@kat.sd`. Add your public key to the server’s `authorized_keys`, or set `SSH_KEY` in `.env` to the correct private key path. |
| `Permission denied (publickey)` | Same as above: fix SSH key setup for `kattop@kat.sd`. |
| Build fails | Run `npm run build` alone and fix any TypeScript/NestJS errors. |
| Remote path wrong | Set `REMOTE_DIR` in `.env` (e.g. `public_html/rafique/api`). Path is relative to the SSH user’s home directory. |

---

## Summary

- **One command:** `npm run deploy`
- **Auth:** SSH key only (no password)
- **Target on server:** `public_html/rafique/api/` (configurable via `REMOTE_DIR`)
- **Flow:** Build → zip → SCP upload → SSH extract and cleanup
