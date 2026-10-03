# Deploying Silora Academy

Everything runs on **one AWS Lightsail server** (Mumbai, 2 GB) with Docker Compose:

| Service | What it does |
| --- | --- |
| `caddy` | HTTPS for `app.siloraacademy.com`; gets and renews the certificate by itself |
| `app` | The Next.js app |
| `worker` | Class monitor: reminders, alerts and lesson outcomes, every minute |
| `db` | PostgreSQL 17, the only data kept on the server |
| `backup` | Database backup to Cloudflare R2 every night at 3:00 AM India time |
| `migrate` | Applies database changes before the app starts, then exits |

Chat files and backups live in **Cloudflare R2**, and all settings live in `deploy/.env`. The server can be resized or replaced without changing the code.

## Before the server: accounts and settings

You create these yourself, in Silora's name. None of the values ever go into chat or into git.

1. **Cloudflare R2.** Create a private bucket named `silora-files`, with public access left off. Then:
   - Create an API token with *Object Read & Write* on that bucket only. Note the Account ID, Access Key ID and Secret Access Key.
   - Add a lifecycle rule to the bucket: delete objects with prefix `backups/` after **30 days**. This keeps a month of nightly backups.
2. **Google sign-in (Google Cloud Console).**
   - Create a project, then create an OAuth client of type *Web application*.
   - Authorised redirect URIs: `https://app.siloraacademy.com/api/auth/google/callback`. For testing on your computer, also add `http://localhost:3000/api/auth/google/callback`.
   - OAuth consent screen: user type *External*, scopes `openid`, `email` and `profile` only. Set the publishing status to **In production**; in *Testing* mode only listed test users can sign in. These basic scopes need no Google review.
3. **Sentry** (free plan). Create a *Next.js* project and copy its DSN.
4. **GitHub.** Create a private repository and push this code (see "Code hosting" below).

## Connecting the server (at the end)

1. Create the server in Lightsail: Mumbai (ap-south-1), Linux, **Ubuntu 24.04**, the 2 GB plan.
   - Attach a **static IP**.
   - In *Networking*, allow HTTPS (443) next to the default SSH (22) and HTTP (80).
2. Ask the website developer for one DNS record:
   `app.siloraacademy.com` → **A** record → the static IP. If their DNS is on Cloudflare, turn the proxy off (grey cloud).
3. On the server, get the code. Add the server's SSH key as a read-only *Deploy key* on the GitHub repository first.
   ```bash
   git clone git@github.com:<owner>/<repo>.git ~/silora && cd ~/silora
   bash deploy/setup-server.sh        # Docker, swap, firewall, automatic security updates, deploy/.env
   nano deploy/.env                   # fill in the Google, R2 and Sentry values
   # log out and back in once, then:
   bash deploy/deploy.sh
   ```
4. Open `https://app.siloraacademy.com`. The first certificate takes about a minute once DNS has updated.
5. Create the first Super Admin, using the Gmail you will sign in with. Signing in with Google never creates accounts.
   ```bash
   docker compose -f deploy/compose.yaml run --rm app node scripts/create-admin.mjs you@gmail.com "Your Name"
   ```
6. **Uptime check (UptimeRobot, free).** Add an HTTP monitor for `https://app.siloraacademy.com/api/health` every 5 minutes, with email alerts. It turns red if the app, the database, the class monitor or last night's backup has a problem.
7. **Automatic updates.** In the GitHub repository, add the secrets `DEPLOY_HOST` (the static IP), `DEPLOY_USER` (`ubuntu`), `DEPLOY_KEY` (a private SSH key allowed on the server) and `DEPLOY_PATH` (`/home/ubuntu/silora`). After that, every push to `main` that passes the checks deploys itself.

## Everyday operations

```bash
cd ~/silora
bash deploy/deploy.sh                                   # update now (also runs automatically from GitHub)
docker compose -f deploy/compose.yaml ps                # what is running
docker compose -f deploy/compose.yaml logs -f app       # app logs (also: worker, backup, caddy, db)
bash deploy/restore.sh --list                           # list backups in R2
bash deploy/restore.sh                                  # restore the newest backup (asks first)
```

Every deploy takes a database backup first, so a bad release can be rolled back with `git checkout <previous commit>`, `deploy.sh`, and if needed `restore.sh`.

## Upgrading the server

- **More memory or CPU (same server):** In Lightsail, create a snapshot of the server, then create a new server from the snapshot on a bigger plan (4 GB, 8 GB, ...). Move the static IP to it and delete the old one. Nothing in the code or settings changes, and DNS stays the same because the static IP moves.
- **Brand-new server (e.g. a different provider):** Run steps 3–4 above on the new server and copy `deploy/.env` across. Run `bash deploy/restore.sh` to load last night's backup from R2, then point DNS at the new address. Chat files are already in R2, so nothing else needs copying.
- **Later, if Silora grows a lot:** The database can move to a managed service (e.g. Lightsail or RDS Postgres). Change `DATABASE_URL` in `deploy/compose.yaml` and remove the `db` service; the app itself does not change.

## Code hosting

```bash
git remote add origin git@github.com:<owner>/<repo>.git
git push -u origin main
```

GitHub Actions runs the type check, lint, tests and a production build on every push (`.github/workflows/ci.yml`). Deploys run only after those pass (`.github/workflows/deploy.yml`).
