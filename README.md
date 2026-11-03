# STMS: Shantikunjo Tenant Management System

A web app for a landlord to manage tenants, apartments, leases, rent, electricity bills and dues. It works on phones and desktops.

- **Requirements:** [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- **Brand:** [docs/STMS Brand Style Guide Board.png](docs/STMS%20Brand%20Style%20Guide%20Board.png) (rendered at `/styleguide`)

| Folder | Stack |
|---|---|
| [backend/](backend/) | Express 5, TypeScript, Prisma 6, PostgreSQL 16, S3 uploads |
| [frontend/](frontend/) | Next.js 15 (App Router, SSR), React 19, Tailwind CSS 4, Recharts |

The browser talks only to Next.js. Next proxies `/api/*` to Express, so the app has a single origin, needs no CORS, and uses a first-party session cookie.

## Run locally

Requires Node 22+ and Docker (for Postgres).

```bash
# 1. Database
cp .env.example .env
docker compose up -d

# 2. API  (http://127.0.0.1:4000)
cd backend
cp .env.example .env          # set SESSION_SECRET, ADMIN_*, and S3_* if you use S3
npm install
npx prisma migrate dev        # creates tables
npm run db:seed               # admin user + sample apartments, tenants and 8 months of history
npm run dev

# 3. Web  (http://localhost:3000)
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`.

- `npm run db:seed -- --force` wipes business data and reseeds. It does **not** delete files already in S3.
- To reset the admin password: `npm run build && ADMIN_PASSWORD=... node dist/scripts/create-admin.js --reset`.
- If `S3_BUCKET` is empty, uploads are stored in `backend/uploads/`.

## How billing works

- On the **1st of each month** (Asia/Dhaka) the API creates one invoice per active lease, with rent and service charge. Generation is idempotent, also runs at startup, and can be triggered from **Billing → Generate invoices**.
- Rent is **due on the 10th** (configurable in Settings). Unpaid bills after that date show as **Overdue**.
- Recording a **meter reading** adds an electricity line to that month's invoice. The amount is entered manually; if it is left empty, it is estimated from the slab table in Settings.
- A **payment** is applied to the chosen invoice first, then to the oldest open invoices. Anything left over becomes advance credit, which is applied automatically to the next bill.
- The first and last months of a lease are **prorated by days**. Voiding an invoice returns its payments to credit.

## Scripts

| | backend | frontend |
|---|---|---|
| dev server | `npm run dev` | `npm run dev` |
| production build | `npm run build && npm start` | `npm run build && npm start` |
| typecheck | `npm run typecheck` | `npm run typecheck` |
| DB | `db:migrate`, `db:deploy`, `db:seed`, `db:studio` | |

## Deployment

The target is Dokploy. The packaging approach hasn't been decided yet.
