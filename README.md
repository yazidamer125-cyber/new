# WakilPro — وكيل برو

Private, invite-only B2B platform connecting overseas manpower **source agencies** (Ethiopia,
Philippines, Sri Lanka, Kenya, Uganda, Bangladesh) with **licensed recruitment offices** in Jordan
and the Gulf.

**Stack:** Next.js 14 (App Router) · Turso (libSQL) + Drizzle ORM · Better Auth · Cloudflare R2 ·
Tailwind (RTL-first Arabic UI) · Vercel.

---

## Non-negotiable product rules (enforced in code)

1. **No public worker catalog.** Worker profiles are visible only to authenticated, verified
   organizations, and only through an active proposal or placement
   (`lib/db/guards.ts → canViewWorker()` is the single sanctioned path; CI greps `app/(public)`
   and fails on any worker reference).
2. **Signed consent before sharing.** A worker cannot leave `draft` without a consent document —
   enforced by the API (`assertWorkerTransition`), by proposal validation
   (`assertProposableWorkers`) **and** by a DB `CHECK` constraint.
3. **License verification gate.** Unverified orgs get `403 ORG_PENDING` from every business
   endpoint and see only the onboarding checklist.
4. **Full audit log.** Every cross-org worker read writes `worker.viewed` (who, when, proposal /
   placement context) to `audit_log`.
5. **Documents only via signed URLs.** All files live in R2 and are served exclusively through
   `GET /api/files/sign` → 10-minute signed URLs. No public bucket access.

---

## Local development

```bash
cp .env.example .env        # fill in values (see below)
npm install
npm run db:generate         # generate SQL migrations from lib/db/schema.ts (already committed)
npm run db:migrate          # apply migrations to the DB in TURSO_DATABASE_URL
npm run db:seed             # dev seed: admin + 2 verified demo orgs + workers + job order
npm run dev
```

Local DB without Turso: set `TURSO_DATABASE_URL="file:./local.db"` and leave the token empty.

## Turso setup (production)

```bash
# 1. Install CLI & sign in
curl -sSfL https://get.tur.so/install.sh | bash
turso auth login

# 2. Create the database (choose a region close to Vercel's, e.g. fra)
turso db create wakilpro --location fra

# 3. Get the connection URL  → TURSO_DATABASE_URL
turso db show wakilpro --url

# 4. Create an auth token    → TURSO_AUTH_TOKEN
turso db tokens create wakilpro

# 5. Run migrations from your machine (or CI)
TURSO_DATABASE_URL="libsql://wakilpro-<org>.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npm run db:migrate

# 6. (Optional) production demo data: admin, 1 verified Jordanian office,
#    1 verified Ethiopian agency, 3 draft workers (no consent), 1 open job order
TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... BETTER_AUTH_SECRET=... npm run db:seed:demo
```

## Cloudflare R2 setup

1. Create bucket `wakilpro` (R2 → Create bucket). **Do not enable public access.**
2. R2 → Manage API tokens → Create token, permission **Object Read & Write**, scoped to the bucket.
3. Fill `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
4. Add a CORS rule on the bucket allowing `PUT` from your app origin (uploads go browser → R2
   directly with signed URLs):

```json
[{ "AllowedOrigins": ["https://your-domain"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"] }]
```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | libSQL URL (`libsql://…` or `file:./local.db`) |
| `TURSO_AUTH_TOKEN` | Turso DB token (empty for local file DB) |
| `BETTER_AUTH_SECRET` | Session/crypto secret — `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Canonical app URL (e.g. `https://app.wakilpro.com`) |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Cloudflare R2 |
| `CRON_SECRET` | Protects `/api/cron/daily` (Vercel sends it automatically) |
| `SEED_PASSWORD` | Password for seeded demo accounts (optional) |

## Vercel deployment

1. Import the repo in Vercel (framework auto-detected; `vercel.json` adds the daily cron at 03:00 UTC).
2. Set all env vars above for Production (and Preview if wanted). Set `CRON_SECRET` to a random value.
3. All dashboard/API routes are `force-dynamic` (no ISR of authenticated data); R2 signing and auth
   run on the Node runtime.
4. Security headers (CSP, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin`, HSTS) ship from
   `next.config.mjs`; `robots.txt` allows only `/` and `/request-invite`.
5. GitHub Actions (`.github/workflows/ci.yml`) runs the privacy gate + lint + typecheck on every
   push and deploys `main` to Vercel when `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`
   secrets are configured. (Alternatively just use Vercel's Git integration and delete the deploy job.)

Health probe: `GET /api/health` → checks DB + R2, returns 200/503.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run db:generate` | Regenerate SQL migrations after editing `lib/db/schema.ts` |
| `npm run db:migrate` | Apply `./drizzle` migrations to the target DB |
| `npm run db:seed` | Dev seed (admin + 2 verified orgs + sample data incl. consented workers) |
| `npm run db:seed:demo` | Production demo seed (3 **draft** workers without consent, per launch plan) |
| `npm run check:privacy` | The CI privacy grep, runnable locally |

## Launch checklist

1. Deploy + run migrations + `db:seed:demo`; log in as `admin@wakilpro.local` and rotate its password.
2. From **/admin/invitations** create invitations for the first **3 recruitment offices** and
   **2 source agencies**; send each invite link privately.
3. As each org registers, review the uploaded license in **/admin** → verify (or reject with reason).
4. Walk one full flow end-to-end:
   office posts job order → agency activates a worker (upload signed consent first — the UI/API
   will refuse otherwise) → agency proposes → office shortlists (name reveal) → office accepts →
   placement appears → advance stages contract → visa → medical → ticketing → file OKB request →
   mark approved → traveled → **arrived**.
5. Confirm the audit trail: `audit_log` contains `worker.viewed` rows with the proposal context for
   every office view, and `org.verified` entries for each license approval.
6. Verify privacy posture: logged-out, only `/`, `/login`, `/register`, `/request-invite` render;
   `robots.txt` blocks everything else; no worker strings in public HTML (`npm run check:privacy`).
