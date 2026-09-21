# PIMH Academy — Learning Management System

A real, working LMS: public landing page + login/register (email/password and Google) +
Student, Faculty, Admin, and Super Admin portals, backed by a persistent SQLite database.
Every tab, button, and form in the app is wired to a real backend endpoint — nothing here
is a static mockup.

## Why it has zero npm dependencies

This build runs on **Node.js 22+ only**, using nothing but built-in modules
(`node:http`, `node:sqlite`, `node:crypto`). There is no `package.json`, no `npm install`,
no build step. Just:

```bash
node server.js
```

...and the app is live at `http://localhost:3000` (or `$PORT` if set). On first boot it
automatically creates `data/pimh.db` and seeds it with demo accounts and sample course
content (see below). On every later boot it detects the existing data and leaves it alone.

This also means deployment is trivial: copy the folder to any machine with Node 22+,
run `node server.js`, done. No dependency drift, ever.

## Demo accounts

All seeded accounts use the password `Password123!`:

| Role | Email |
|---|---|
| Super Admin | nadia.farooq@pimh.edu.pk |
| Admin | imran.qureshi@pimh.edu.pk |
| Faculty (assigned to all 3 courses) | usama.zubair@pimh.edu.pk |
| Faculty (no courses yet — tests the empty state) | sana.ibrahim@pimh.edu.pk |
| Student | ayesha.zaman@student.pimh.edu.pk (+ 5 more — see `lib/seed.js`) |

New students can also self-register from `/register` with email/password.

## Roles

- **Student** — dashboard, enrolled courses with module progress/locking, materials,
  schedule, grades, discussion boards, announcements, notifications, printable
  certificates on course completion, profile.
- **Faculty** — dashboard, their assigned classes (add modules/materials/schedule),
  grading queue for assignments, discussion, course announcements, class roster, profile.
- **Admin** — program-level staff: manage courses, enrollment, faculty assignment,
  academy/course announcements, activity log, own profile. Cannot create/edit
  Faculty/Admin/Super-Admin accounts or change system settings.
- **Super Admin** — everything Admin can do, plus staff account management (create/edit/
  deactivate Faculty, Admin, Super Admin accounts) and system settings.

## Google Sign-In

The Google button is present on `/login` and `/register` but is automatically disabled
(with a tooltip) unless these environment variables are set:

```bash
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
```

Set them, restart the server, and the button activates — no code changes required.
The redirect URI must be registered in your Google Cloud OAuth client and must be
reachable over HTTPS on your public domain (Google will not redirect to `localhost`
in production). This flow could not be live-tested in the sandbox this app was built
in (outbound access to Google's OAuth endpoints was blocked there), so test it once
in your real deployment before relying on it.

## Architecture notes

- **Database**: `node:sqlite` (`DatabaseSync`), WAL mode, foreign keys enforced.
  Schema in `lib/db.js`. Data lives in `data/pimh.db` — back this file up like any
  production database.
- **Auth**: passwords hashed with `scrypt` (`node:crypto`), session tokens are random
  32-byte hex values stored in a `sessions` table with a 30-day expiry, sent as an
  HttpOnly cookie.
- **Routing**: a small hand-rolled router (`lib/router.js`) supporting `:param` segments.
  Page routes in `routes/pages.js`, JSON API in `routes/api.js`.
- **Frontend**: server-rendered HTML shells (`views/`) + vanilla JS per portal
  (`public/js/{student,faculty,admin,auth,common}.js`) driving a single-page-app-style
  view switcher, talking to the JSON API. No framework, no bundler.
- **Progress/locking**: a module's unlock/complete state for a student is computed live
  on every request (`moduleStateForStudent` in `lib/queries.js`) from stored progress
  percentages — never a stale cached flag.
- **Quizzes**: auto-graded server-side against stored correct answers, with a per-quiz
  attempt limit enforced in the API.
- **Materials**: link-type materials (pasted URLs) work as real clickable links today.
  There is no file-upload/storage backend in this build — materials created as "file"
  type without a real URL render as a clearly disabled, non-clickable item labeled
  "not uploaded yet" rather than a broken link. Wire up real file storage (S3, local
  disk, etc.) before relying on file uploads in production.

## QA

`qa/smoke.js` is an automated Playwright end-to-end test covering the landing page,
registration, and every sidebar view + core interactive flow (quiz-taking, grading,
discussion posting, course/enrollment/user management, settings, faculty reassignment)
across all five portals. Run it against a live server with:

```bash
node server.js &          # start the app
node qa/smoke.js          # run the test (needs Playwright installed separately)
```

It was last run to a fully clean pass (54/54 checks, zero genuine errors — only expected
console noise from the test's own deliberate font-request blocking). An independent
review pass was also done separately, focused on RBAC boundaries, session/logout
correctness, invalid-login handling, and mobile layout; the two issues it found
(a mobile layout overflow on the landing page, and the file-material dead-link issue
above) have both been fixed.

**Note:** running `qa/smoke.js` creates test accounts, a test course, and test posts
in the database. Delete `data/pimh.db*` and restart the server afterward to get back
to a clean seeded state before using the app for real.
