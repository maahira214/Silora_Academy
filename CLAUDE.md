@AGENTS.md

# Silora Academy — project context

Tutoring operations platform for Silora Academy (siloraacademy.com): admin/operations, teacher and student portals, Google Meet join flow, teacher↔student chat with contact-leak protection, exception-based class monitoring. Product spec and how the code is organised: see README.md.

## Decisions already made with the user

- **One permanent Meet link per Student + Teacher + Subject relationship** (or per group class), reused for every lesson. Replacing a teacher creates a new class with a new link and chat.
- Silora currently uses **free Google Meet**; teachers and students use **personal Gmail**. App supports MANUAL Meet links now; GOOGLE_API mode (one Workspace Base account, ₹99/month) is planned for Phase 3 if the user approves.
- **Simplicity first**: students/teachers get a 3-item menu (Home, Messages, My classes), one big Join button, plain words, phone-first.
- **Low budget**: one AWS Lightsail 2 GB server in Mumbai (app + Postgres + monitor), Cloudflare R2 for files/backups, Resend free email. ≈ ₹1,360/month incl. GST.
- Branding: gold #E8B112, navy #0A2D4A, Montserrat.
- Approved 2026-10-03: the build plan and simplicity rules; hosting on AWS Lightsail Mumbai 2 GB with Cloudflare R2 for files; app address `app.siloraacademy.com`; **English only** for v1.
- **Hosting is connected last.** Build everything server-independent first; keep deployment portable (Docker Compose, all config in env, files and backups in R2, nothing stateful on the box except Postgres) so the Lightsail instance can be resized or replaced without architecture changes.
- **Local-first until development is tested (2026-10-04):** files, database and backups all stay on this computer (`STORAGE_DRIVER="local"`, `./storage`, `./backups`). R2 and Lightsail are production-only; the user will not add a payment card or create R2/Google/Sentry accounts until local testing is done. Never make R2 required for local development. PostgreSQL 18 command-line tools are installed (`C:\Program Files\PostgreSQL\18\bin`, auto-detected by scripts/backup.mjs); real backup + restore verified 2026-10-04.
- **Classes are video recorded** (decided 2026-10-09): only Silora Academy can watch recordings, never teachers or students. The user will pay for a Google Workspace plan that includes Meet recording (Base/Starter don't; Business Standard or higher does), which also affects the Phase 3 Meet choice. Policy text: RECORDINGS in src/lib/legal.ts. Built 2026-10-09: Super Admins attach Drive links per lesson (Recording model, "recordings.view" = SUPER_ADMIN only, audited opens via /admin/recordings/[id]); the monitor expires them after RECORDING_KEEP_DAYS (90) and lists them for deletion from Drive. Automatic attach via the Meet API comes with the paid plan (Phase 3).
- The siloraacademy.com DNS is managed by the **website developer**, not the user; the single `app.` record is requested from them when hosting is connected.

## Build plan (user must confirm before each phase)

0. Working prototype — done.
1. Test site online — confirmed 2026-10-03 and re-scoped: server-independent parts built (git, R2 storage, Sentry, /api/health, R2 backups, Docker Compose + Caddy, CI/deploy workflows, create-admin script; see deploy/README.md). **Remaining, at the end:** user creates accounts (R2, Google OAuth, Sentry, GitHub), then Lightsail server + one DNS record via the website developer.
2. Make it simple — built locally 2026-10-04 (all 11 screen changes from the build plan doc). Waiting for the user's own local test; the "done when" check (a teacher and a student join and send a photo with no instructions) happens once it's online.
3. Connect Google Meet (free-Meet test, then Workspace automation if chosen).
4. Real data (CSV import), email notifications, rate limits, security test pass — local parts built 2026-10-09 (confirmed by user): CSV import (/admin/people/import), email outbox (EmailLog, EMAIL_DRIVER log/resend, Admin → More → Emails), in-memory rate limits (src/lib/rate-limit.ts), `npm run test:security` (real DB, also in CI). **Still to do:** import the user's real teacher/student list, approve privacy + parent-consent text, Resend account at the end.
   Privacy (2026-10-09): draft policy, consent points and parent-consent form live in `src/lib/legal.ts` (pages /privacy, /privacy/parent-consent). Teachers/students must agree before using the app (re-asked when `POLICY_VERSION` changes); staff record parent consent on the student page. Silora records class video (RECORDINGS in legal.ts); privacy contact is Sameeha (founder), no privacy inbox yet. **User must confirm:** wording, recording details (where kept, who can watch, 90 days), response days, retention periods (retention is documented, not yet enforced by automatic deletion).
   Phase 3 (Google Meet) moved to the end with the other connections, since it needs Silora's real Google account.
5. Pilot with 5–10 real classes for 2 weeks.
6. Full rollout and handover.

Planning docs (Claude Docs): product "What You Get" https://claude.ai/code/artifact/00153a9f-aa8a-47f0-a308-f4d3ba3400af · cost plan https://claude.ai/code/artifact/85c7edda-d777-48a6-8d56-fe2e4397fd06 · build plan https://claude.ai/code/artifact/0e4c6964-d328-42fa-82e6-14bd9df6ef85

## Working notes

- The user is a developer; they do account creation, secrets (.env), DNS and payments themselves. Never ask them to paste secrets into chat.
- Local DB: `npm run db` (embedded Postgres on :5433). Then `npm run dev`, `npm run worker`. Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `prisma migrate dev` fails in this non-interactive environment and `migrate reset` is blocked; create migrations with `npx prisma migrate diff --from-url <DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script` into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy`.
- npm 11 blocks install scripts: new packages with postinstall need `npm approve-scripts <pkg>`.
- Git: branch `main`. Code is hosted in a **private** GitHub repo on the user's "Maahira Begum S" GitHub account (commit identity Maahira Begum S); the user creates the repo, then it is added as `origin`. `.gitattributes` forces LF so deploy scripts run on Linux.
- Production config lives in `deploy/` (compose.yaml, Caddyfile, .env.production.example, setup/deploy/restore scripts). Docker is not installed on the dev machine, so the Docker stack is only exercised on the server.
- Chat uploads go through a Server Action: `next.config.ts` raises `serverActions.bodySizeLimit` and `proxyClientMaxBodySize` to 51mb (defaults 1 MB / 10 MB).
