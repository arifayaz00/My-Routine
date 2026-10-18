# Campus Planner

Routine-PDF parser, colour-coded weekly schedule, CGPA tracker, and student/admin panels.
**FastAPI** · **PostgreSQL** · **React + Vite + Tailwind + Framer Motion + Recharts** · **Docker** · English and Bengali · light and dark theme · installable offline app (PWA).

## 1. Architecture

```
 Browser (React SPA / PWA)                      Docker network
 ┌────────────────────────┐   :80   ┌─────────┐  /api/*   ┌───────────────┐  SQL   ┌────────────┐
 │ Routine · CGPA · Admin │ ──────▶ │  nginx  │ ────────▶ │ FastAPI (api) │ ─────▶ │ PostgreSQL │
 └───────────▲────────────┘         │  (web)  │           │  + pdfplumber │        └────────────┘
             │ SSE /api/routine/stream └─────┘            └───────┬───────┘
             └──────────────────────────────────────────────────────┘   uploads volume (original PDFs)
```

* **Auth:** email + password (bcrypt). The session is an **httpOnly cookie** (JavaScript can't read it) with a CSRF header on writes; API clients can use the returned bearer token. Roles `user` / `admin`. Changing or resetting a password signs out every other device (`token_version`). The first admin is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
* **Publishing pipeline:** upload PDF → parsed into a **draft** (nothing live changes) → admin reviews rows, parser warnings and schedule clashes → **publish** → can be **rolled back**. Classes an admin edited by hand are never overwritten or duplicated by a later upload.
* **Live updates:** publish, entry edit or notice → Server-Sent Event → every open Routine page refetches and shows a toast. Optional Telegram post for the same events. (Single-process broadcaster; see `events.py` for the Redis swap with several workers.)
* **Offline:** a service worker keeps the app shell and the last public routine, so students can open it without a connection. Sign-in, CGPA and admin calls are never cached.

```
campus-planner/
├── docker-compose.yml  .env.example
├── scripts/                backup.sh  restore.sh
├── .github/workflows/ci.yml   tests + build + boots the Docker stack on PostgreSQL
├── shared/cgpa-vectors.json   CGPA test cases run by BOTH backend and frontend tests
├── backend/
│   ├── Dockerfile  docker-entrypoint.sh (migrate, then serve)  alembic/  requirements.txt
│   ├── app/
│   │   ├── main.py  config.py  database.py  models.py  schemas.py  security.py  ratelimit.py  events.py
│   │   ├── routers/    auth.py  routine.py  cgpa.py  admin.py
│   │   └── services/   pdf_parser.py  ingest.py  conflicts.py  cgpa.py  ics.py  audit.py  notify.py  settings.py
│   └── tests/test_api.py
└── frontend/
    ├── Dockerfile  nginx.conf  security-headers.conf  public/ (sw.js, manifest, theme-init.js)
    ├── tests/      cgpa.test.mjs  i18n.test.mjs
    └── src/
        ├── App.jsx  main.jsx  index.css
        ├── lib/        api.js  auth.jsx  prefs.jsx  i18n.js  cgpa.js  theme.js  demo.js
        ├── components/ RoutineGrid  FilterBar  CgpaTracker  CgpaChart  TargetPlanner
        └── pages/      RoutinePage  CgpaPage  AccountPage  AdminPage  AuthPage
```

## 2. Database schema

| Table | Key columns | Notes |
|---|---|---|
| `users` | email (unique), name, password_hash, role, token_version, pref_department/batch/section | prefs = auto-saved schedule filter |
| `batches` | department, batch_no, section · unique together | one row per class group |
| `courses` | code (unique), title, kind, credits | |
| `uploads` | filename, term, status, entries_count, batches_count, log, payload, snapshot, uploaded_by, created_at, published_at | status: `draft → published → rolled_back`, or `failed` / `discarded`. `payload` = parsed draft, `snapshot` = what a publish replaced (for rollback) |
| `routine_entries` | batch_id, course_id, day, start_time, end_time, room, teacher, kind, is_manual, origin_key, upload_id, updated_at | `origin_key` = `batch\|code\|day\|start` as first created; keeps hand-edited classes from being duplicated |
| `notices` | title, body, level, created_at | `info / change / urgent` |
| `settings` | key, value | semester start and end dates |
| `audit_log` | user_email, action, detail, created_at | who uploaded, published, edited, reset |
| `semesters` / `grade_entries` | user_id → semester → course_name, credits, grade | each user's own CGPA log (cascade delete) |

The schema is managed by **Alembic** (`backend/alembic/`). A test checks that the migrations match the models.

## 3. API

🔓 public · 🔒 signed in · 🛡 admin. Interactive docs at `/docs` in development (hidden in production).

| Method & path | Who | Purpose |
|---|---|---|
| `POST /api/auth/register` `login` `logout` | 🔓 | rate-limited; sets the session cookie |
| `GET /api/auth/me` · `PUT /api/auth/preferences` · `POST /api/auth/change-password` | 🔒 | |
| `GET /api/routine?department&batch&section&teacher` | 🔓 | filtered classes |
| `GET /api/routine/filters` · `/teachers` · `/meta` | 🔓 | dropdown data · teacher list · last update + semester dates |
| `GET /api/routine/export.ics?…` | 🔓 | calendar file **and** live subscribe link (Google/Apple/Outlook) |
| `GET /api/routine/stream` | 🔓 | Server-Sent Events |
| `GET /api/notices` | 🔓 | latest notices |
| `GET /api/cgpa` · `POST /api/cgpa/semesters` · `PUT/DELETE /api/cgpa/semesters/{id}` · `GET /api/cgpa/report.pdf` | 🔒 | own data only |
| `POST /api/admin/uploads` | 🛡 | upload and parse into a draft |
| `GET /api/admin/uploads[/{id}[/preview]]` | 🛡 | history · log · rows, warnings, clashes, per-batch changes |
| `POST /api/admin/uploads/{id}/publish` `/discard` `/rollback` | 🛡 | |
| `GET/POST /api/admin/entries` · `PATCH/DELETE /api/admin/entries/{id}` | 🛡 | manual edits |
| `GET /api/admin/conflicts` | 🛡 | teacher / room / batch double-bookings in live data |
| `POST/DELETE /api/admin/notices` | 🛡 | broadcast |
| `GET/PUT /api/admin/settings` | 🛡 | semester start/end |
| `GET /api/admin/users` · `POST /api/admin/users/{id}/reset-password` | 🛡 | temporary password to hand to the student |
| `GET /api/admin/audit` · `/stats` | 🛡 | activity log · dashboard numbers |
| `GET /api/health` | 🔓 | checks the database |

### How PDF parsing works

0. **Central routine layout (tested on a real Metropolitan University SWE PDF):** one table with day separator rows (`Sunday | SWE`), a row per batch (`5th`, student count) and time slots of *course short form / room / faculty short form*. Each slot becomes one class; the term ("Autumn 2026") is read from the title. Short forms are stored as the course code and faculty initials as the teacher. A row that is not a batch (e.g. `ACM`) is imported with a warning. Calendar export merges two-slot labs into one event.
1. **Page context (other layouts):** department, batch and section come from the page header text (`Department of … Batch 40 Section A`, or a code like `SWE`). A continuation page inherits the previous one.
2. **Tables:** both layouts (days down the side or across the top). Merged cells (a lab spanning two slots) are carried across. Several courses in one cell become several classes.
3. **Cells:** course code, room, teacher and type (lab / project / elective / exam keywords). Times accept 12h and 24h; with no AM/PM, hours 1–7 are read as afternoon.
4. **Nothing is dropped silently:** anything unreadable becomes a warning. A scanned PDF with no text layer gets a clear message (run `ocrmypdf` first).
5. **Publish** replaces the PDF-derived classes of each batch found in the file; hand-edited classes are kept; rollback restores exactly what that publish replaced.

> ⚠️ The parser is tested on generated PDFs and on one real routine (`backend/tests/fixtures/swe_autumn_2026.pdf`: 94 classes, no clashes), not on every university's layout. Check the **review screen** the first time you upload your real routine, and send me a real (anonymised) PDF if entries come out wrong.

## 4. CGPA rules (all configurable)

Default 4.00 scale: A+ 4.00, A 3.75, A− 3.50, B+ 3.25, B 3.00, B− 2.75, C+ 2.50, C 2.25, D 2.00, F 0. Override with the `GRADE_SCALE` JSON variable.
CGPA = Σ(points × credits) / Σ credits, computed from unrounded points and rounded only for display. **Retakes:** with `RETAKE_POLICY=latest` (default) a course entered again under the same name counts once, using its latest grade; `all` counts every attempt. `P`, `W`, `I` are ignored; `T` (transfer) adds earned credits without grade points. **Status:** Critical if CGPA < 3.00 or the latest SGPA < 2.50; Improving if the latest SGPA is more than 0.05 above the previous; otherwise Good. Badge colours: emerald > 3.75, blue > 3.50, amber > 3.00, red otherwise. The **target planner** shows the SGPA needed next semester to reach a chosen CGPA. Backend and frontend share test vectors (`shared/cgpa-vectors.json`) so the two calculations can't drift apart.

## 5. Run it

### On your computer, for development
```bash
# backend (uses a local SQLite file; admin = admin@example.com / admin12345 in development only)
cd backend && python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload                                        # http://localhost:8000
python -m pytest                                                     # backend tests

# frontend (proxies /api to :8000)
cd frontend && npm install && npm run dev                            # http://localhost:5173
npm test                                                             # frontend tests
VITE_DEMO=1 npm run dev                                              # UI only, with sample data, no backend needed
```

### On a server with Docker (DigitalOcean, EC2, any VPS)
```bash
cp .env.example .env     # then fill in DB_PASSWORD, JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
docker compose logs -f api
```
Open `http://<server>/`, sign in as the admin, then **PDF uploads**. The API container applies database migrations on every start and runs with `APP_ENV=production`, which **refuses to start** with a missing/short `JWT_SECRET` or a weak admin password and hides `/docs`. `docker compose` waits for the database and API health checks before starting the website.

* **HTTPS (do this before real users):** put Caddy or Traefik in front of the `web` service, then set `CORS_ORIGINS=https://your.domain`. Cookies become `Secure` automatically behind HTTPS.
* **Backups:** `./scripts/backup.sh 14` writes a database dump and the uploaded PDFs to `./backups` and keeps 14 days. Run it nightly from cron: `30 2 * * * cd /opt/campus-planner && ./scripts/backup.sh 14`. Restore with `./scripts/restore.sh backups/db-….sql.gz`. **Test a restore once** before you depend on it.
* **Update:** `git pull && docker compose up -d --build`.
* **Telegram alerts (optional):** set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
* **Render / Railway:** use a managed PostgreSQL, deploy `backend/` and `frontend/` from their Dockerfiles, and point the `proxy_pass` lines in `frontend/nginx.conf` at the API service URL.
* **More than one API process:** replace `events.py` (and the per-process login limiter in `ratelimit.py`, though nginx already limits shared traffic) with Redis.

## 6. Security summary

httpOnly session cookie + CSRF header, bcrypt, per-IP and per-email login throttling plus nginx `limit_req`, strict security headers and a Content-Security-Policy, admin role check on every admin route, uploads validated (type, size, magic bytes) and stored under random names, users can only read their own CGPA data, audit log for admin actions, secrets required in production.

## 7. Known limits (read before launch)

* **Parser accuracy depends on your PDF's layout.** See the warning above.
* **No email verification or email-based password reset.** An admin issues a temporary password from **Students**. Add an email service if you need self-service reset.
* **Not run on real PostgreSQL in this development environment.** The CI workflow builds both images and boots the full stack against PostgreSQL on every push; run it (or `docker compose up`) once on your machine and watch `docker compose logs api` before going live.
* **Bengali covers the student screens.** The admin panel and server error messages are English. Class times use AM/PM in both languages.
* **Live updates need the page to be open.** Closed tabs rely on Telegram alerts or the calendar subscribe link.
* **The Docker health check and nginx rate limits are configured but untested under load.**
