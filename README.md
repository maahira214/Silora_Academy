# Silora Academy — Tutoring Operations Platform

The operations layer between Silora Academy, its teachers, its students and Google Meet:

- **Admin / Operations**: users, classes, recurring schedules, the live dashboard, exception alerts, chat review, audit log and settings.
- **Teachers**: today's classes, **Join class**, class details, messaging and files with assigned students.
- **Students**: the same, from the student side, and built for phones first.

The product spec is `Silora_Academy_Software_Requirements_Specification.md`.

## Core rule: one class = one relationship = one Meet link

A **class** (`Course`) is one Silora-managed relationship: **Student + Teacher + Subject** for one-to-one, or one group class.
Each class owns exactly **one permanent Google Meet link**, **one chat** and its schedules. Every lesson reuses that link.

```
Aisha + Rahul + Mathematics      → Meet A
Aisha + Kiran + Python           → Meet B
Aisha + Kiran + Cybersecurity    → Meet C
```

- A Meet link can never be attached to two classes (enforced by the database).
- Replacing the teacher creates a **new** class with a new Meet link and a new chat. The old teacher loses access.
- Teachers and students never receive the raw link. They use `/join/<lesson>`, which checks the live assignment and records the join before redirecting to Meet.

## Run locally (Windows, macOS or Linux; no Docker needed)

```bash
npm install
npm run db          # terminal 1: local PostgreSQL on :5433 (data in .pgdata/)
npm run db:deploy   # apply migrations
npm run db:seed     # demo data (wipes the DB)
npm run dev         # terminal 2: http://localhost:3000
npm run worker      # terminal 3: class monitor (reminders, alerts, outcomes) every minute
```

With `DEV_LOGIN="true"` in `.env`, the login page lists the seeded users so you can sign in as any role.
This option is hard-disabled in production builds.

Checks: `npm test` (unit tests), `npm run typecheck`, `npm run lint`, `npm run build`.

Backups: `npm run backup` saves a copy of the database to `./backups` (newest 14 kept), `npm run backup:list` lists them, and `npm run backup:restore` restores the newest one.
This needs the PostgreSQL command-line tools (version 17 or newer). On Windows they are found automatically in `C:Program FilesPostgreSQL`.
Chat files stay in `./storage`. Cloudflare R2 is used only in production (`STORAGE_DRIVER="r2"`).

## How it works

| Area | Where |
| --- | --- |
| Data model | `prisma/schema.prisma` |
| Permissions (server-side, every request) | `src/lib/authz.ts` |
| Login (Google OAuth, DB sessions, httpOnly cookie) | `src/lib/auth/*`, `src/app/api/auth/google/*` |
| Classes, schedules, lessons, teacher replacement | `src/server/courses.ts` |
| Join Class (authorization, attendance, redirect) | `src/app/join/[sessionId]/route.ts` |
| Live status rules (open / live / not joined / outcome) | `src/lib/session-status.ts` |
| Monitor: reminders, alerts, outcomes, schedule extension | `src/server/monitor.ts`, `POST /api/cron/tick` |
| Chat, moderation, private files | `src/server/chat.ts`, `src/lib/moderation.ts`, `src/server/storage.ts` |
| Audit log | `src/lib/audit.ts` |

**Roles**: Super Admin (everything), Operations (day-to-day classes and alerts; no settings, chat reading, suspensions or audit log), Teacher, Student.

## Google setup

**Google sign-in** (required for real users): create an OAuth client in Google Cloud Console (Web application). Set the redirect URI to `<APP_URL>/api/auth/google/callback`, then put the client ID and secret in `.env`.
Users can only sign in if Silora has created their account with that Google email. Signing in never creates accounts.

**Google Meet**, two modes:

1. **Manual (works with free Google Meet today).** Staff create one meeting per class from Silora's Google account (*New meeting → Create a meeting for later*) and paste the link once.
   Limits of free Meet: the meeting owner (Silora's account) still has to admit people the meeting doesn't recognize, and **calls with 3 or more people end after 60 minutes**. That covers group classes and any 1:1 where a Silora employee also joins.
   Attendance comes from Join Class clicks in Silora.
2. **Google Workspace API (recommended).** One paid Workspace account (for example `classes@siloraacademy.com`) owns every Meet space. The app creates spaces through the Meet REST API and adds the teacher and student Gmail accounts as members, so they join without knocking.
   It also reads Meet participant data for real attendance. Workspace removes the 60-minute limit. Teachers and students keep their personal Gmail. The code is ready for this (`meetMode`, `meetSpaceName`), but it needs real Workspace credentials to build and test.

## Production

Production runs on one AWS Lightsail server (Mumbai) with Docker Compose: app, class monitor, PostgreSQL, nightly backups to Cloudflare R2, and Caddy for HTTPS.
Chat files are stored in R2 (`STORAGE_DRIVER="r2"`). Errors go to Sentry, and `/api/health` is the uptime check.
Full steps, including how to upgrade the server: **[deploy/README.md](deploy/README.md)**.

Still to do (later phases): email notifications, rate limiting on sign-in and uploads, malware scanning of uploads, a load test of the 6 PM peak, and the privacy policy and consent text (students are often minors).
