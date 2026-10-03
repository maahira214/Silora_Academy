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
- The siloraacademy.com DNS is managed by the **website developer**, not the user; the single `app.` record is requested from them when hosting is connected.

## Build plan (user must confirm before each phase)

0. Working prototype — done.
1. Test site online (server, HTTPS, Google sign-in, backups, R2, error alerts) — decisions answered; **waiting for user to confirm the re-scoped Phase 1** (server-independent parts now, actual server + DNS at the end).
2. Make it simple (screen changes listed in the build plan doc).
3. Connect Google Meet (free-Meet test, then Workspace automation if chosen).
4. Real data (CSV import), email notifications, rate limits, security test pass.
5. Pilot with 5–10 real classes for 2 weeks.
6. Full rollout and handover.

Planning docs (Claude Docs): product "What You Get" https://claude.ai/code/artifact/00153a9f-aa8a-47f0-a308-f4d3ba3400af · cost plan https://claude.ai/code/artifact/85c7edda-d777-48a6-8d56-fe2e4397fd06 · build plan https://claude.ai/code/artifact/0e4c6964-d328-42fa-82e6-14bd9df6ef85

## Working notes

- The user is a developer; they do account creation, secrets (.env), DNS and payments themselves. Never ask them to paste secrets into chat.
- Local DB: `npm run db` (embedded Postgres on :5433). Then `npm run dev`, `npm run worker`. Checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `prisma migrate dev` fails in this non-interactive environment and `migrate reset` is blocked; create migrations with `npx prisma migrate diff --from-url <DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script` into a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then `npx prisma migrate deploy`.
- npm 11 blocks install scripts: new packages with postinstall need `npm approve-scripts <pkg>`.
- Git repository not initialised yet (first step of Phase 1).
