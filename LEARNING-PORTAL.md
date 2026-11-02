# Learning portal at /learn/

The existing homepage, blog and assets are retained. `/learn/` is a public course overview; its **Learn** button opens the minimal sign-in screen at `/learn/#login`. The new portal adds server-checked username/password sign-in, student and instructor views, the completed Day 1 lesson, a Python lab download, three knowledge-check questions, a reflection journal and daily streaks. There is no signup, subscription, database or Supabase integration in this version.

## Vercel environment variables

In the Vercel project connected to this repository, open **Settings → Environment Variables**. Add the variables below to the Production environment and redeploy. Use separate credentials and the exact deployment origin when testing a Preview deployment.

| Variable | Value |
| --- | --- |
| `APP_ORIGIN` | `https://chandan.live` — no `/learn` path. Use the exact hostname students will visit; redirect alternate hosts to this canonical host. |
| `SESSION_SECRET` | A random secret of at least 32 characters; generate with `openssl rand -hex 32`. |
| `ADMIN_USERNAME` | Your lowercase username, e.g. `chandan`. |
| `ADMIN_PASSWORD` | Your instructor password, 12–256 characters. |
| `ADMIN_NAME` | `Chandan Kumar` (optional). |
| `STUDENT_USERNAME` | First student’s lowercase username. |
| `STUDENT_PASSWORD` | That student’s password, 12–256 characters. |
| `STUDENT_NAME` | Student’s display name (optional). |
| `COURSE_PUBLISHED` | `true` to allow student lesson access; `false` to keep it in instructor preview. Default: `true`. |
| `STUDENTS_JSON` | Optional additional student accounts, as a JSON array; example below. |

Use each person’s own username to keep progress separate. Usernames accept 3–40 lowercase letters, numbers, underscores, dots and hyphens. Do not give students the instructor credentials. Passwords are case sensitive; usernames are normalized to lowercase. Neither credentials nor the session secret belong in a `NEXT_PUBLIC_*` variable or Git.

Paste the following shape into the **value** field for `STUDENTS_JSON`, with real values of your choice. On Vercel, do **not** wrap the entire value in shell quotes:

```json
[{"username":"aarav","password":"replace-with-a-long-password","name":"Aarav Sharma"},{"username":"meera","password":"replace-with-another-password","name":"Meera Iyer"}]
```

For a single student, leave `STUDENTS_JSON` unset. You can also omit `STUDENT_USERNAME` and `STUDENT_PASSWORD` and put all students in the JSON array. Up to 100 additional accounts are supported for this small sample. The admin account remains required.

To add/remove an account, change its password, or change publication status, edit environment variables and redeploy. Existing sessions for a changed or removed account stop working on the updated deployment. Users reset forgotten passwords by contacting you. The instructor directory displays configured names and usernames, never passwords.

## Deployment

1. Commit and push the reviewed changes to the repository connected to Vercel.
2. Set the project’s **Root Directory** to the repository root. Use the **Express** framework preset (or let Vercel detect it). Remove any old static-site Output Directory override; Express serves generated `public/` assets itself through Vercel’s CDN.
3. The committed `vercel.json` runs `npm run build`. The build copies only the existing public website files and the portal frontend into `public/`; it does not copy server source, environment files or the lesson source directory.
4. Add the environment variables, then deploy/redeploy. `app.js` exports the Express application. The authenticated API is `/api/learn/*`; lesson source files are included in the function bundle.
5. Open `https://chandan.live/learn/`. Verify an instructor login and a student login. The homepage navigation has a **Learn AI** link.

Do not deploy this authenticated portal as a static-only GitHub Pages site: GitHub Pages cannot execute the Node login API. The repository name can remain `chandan-123kumar.github.io`; Vercel is the runtime host. The lesson source remains visible to readers of this public source repository; the login protects the running portal, not the GitHub repository.

Official references: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Vercel environment variables](https://vercel.com/docs/environment-variables), [environment variable redeployment](https://vercel.com/docs/environment-variables/managing-environment-variables).

## Local use

```sh
npm ci
cp .env.example .env
# Edit .env with your chosen credentials and a random SESSION_SECRET.
# Keep APP_ORIGIN=http://127.0.0.1:3047 for the local server.
npm run dev
```

Open `http://127.0.0.1:3047/learn/`. The original homepage is served at `/`. `.env` is ignored by Git. You do not need a local `.env` for a Vercel deployment; Vercel supplies `process.env` directly. `python3 -m http.server` can still preview the original static homepage, but cannot provide portal login.

```sh
npm test
npm run build
```

## How progress and streaks work

- Progress is scoped by username in browser local storage. A different device, browser or hostname starts with separate progress. Clearing site data removes it.
- A 3/3 score completes the available lesson. This is a self-study check, not proof of completing the independent Python assignment.
- A passing quiz or a saved reflection of at least 40 characters records one learning day. Repeating either activity on the same date does not add another day.
- Dates use the server clock in `Asia/Kolkata`. Today can be unfinished while yesterday’s consecutive run remains active. Missing a full day resets the current streak; best streak is retained.
- Reflections are sent to the server only for length validation and a date response. They are not saved on the server or explicitly logged by the application. Export the journal as Markdown for a durable personal copy.
- The instructor sees the configured account roster. Cross-device progress and cohort completion reporting need persistent storage and are deliberately not presented as available.

## Authentication details and limits

Credentials are read only on the server; passwords are compared through scrypt-derived hashes. Eight-hour signed sessions use HttpOnly, SameSite=Strict cookies, with Secure enabled on Vercel. Mutating requests require the configured origin; authenticated mutations also require a session-bound CSRF token. Role checks and lesson-publication checks run on the server. Protected responses have `Cache-Control: no-store`.

Signing out clears the browser cookie. With no database, a copied session token cannot be individually revoked before expiry; changing the corresponding password or rotating `SESSION_SECRET` and redeploying invalidates it. Login throttling is per running server instance, not a shared global counter across Vercel instances. For a publicly exposed cohort, use Vercel Firewall login rate limiting; a future persistent auth service can supply shared throttling and session revocation. Treat the browser’s editable progress as a personal study aid, not an auditable academic record.

## Content editing

- `content/learn/day-01.md`: complete learning material, highlighted keywords, examples, takeaways, discussion, exercises, assignment and conclusion.
- `content/learn/day-01-lab.py`: downloadable offline/live Hugging Face lab.
- `server/learn/api.js`: knowledge-check questions and server validation.
- `learn/`: portal frontend and local progress calculation.

Only Module 1’s Day 1 is currently available. The journal encourages a module-end blog while explicitly noting that only the first lesson is published. Live Hugging Face inference runs in the downloaded Python lab using the learner’s token; the portal does not make inference calls.
