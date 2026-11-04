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
- Recording a **meter reading** adds an electricity line to that month's invoice. The amount can be typed in; if it is left empty, it is estimated from the electricity settings:
  - **Flat rate** (on by default): up to 200 units, the bill is units × ৳8.50 with no demand charge or VAT.
  - **Slab rates:** above that limit, the tiered slab table applies, plus the demand charge and VAT.

  The limit, the flat rate and the slab table are all editable in **Settings**.
- A **payment** is applied to the chosen invoice first, then to the oldest open invoices. Anything left over becomes advance credit, which is applied automatically to the next bill.
- The first and last months of a lease are **prorated by days**. Voiding an invoice returns its payments to credit.
- **Invoice totals are whole taka.** Charges keep their paisa, and a system-managed **Rounding** line (half up, always under ৳1) brings the total to a whole number. It updates on every change and can't be added or removed by hand. Invoices already paid to the paisa are left as they are.
  - Invoices created before this rule: run `npm run round-invoices -- --dry-run` to preview, then `npm run round-invoices` once. In the API container, run `node dist/scripts/round-open-invoices.js`. Only unpaid and partial invoices change.
- **Printing an invoice** (Print button, or the browser's Save as PDF) produces a one-page A4 layout, separate from the on-screen view. The office phone, office email, note and accepted payment methods on it come from **Settings → Printed invoice**.

## SMS notifications

**Billing → Invoices → Notify tenants** sends tenants a Bangla bill SMS through [bulksmsbd.net](http://bulksmsbd.net).

- **What gets sent:**
  - Only unpaid, partial and overdue invoices are listed.
  - The SMS quotes the **balance still due**.
  - Invoices that were already sent an SMS show a **Notified** badge. They start unticked, but can be sent again.
- **Message template:** edit it in **Settings → Bill SMS message**. The placeholders `{month}`, `{amount}` and `{dueDay}` are filled in with Bangla words and digits. Bangla SMS is billed per 70 characters, so the default message costs about **4 SMS parts per tenant**.
- **Configuration:** set `SMS_API_KEY` and `SMS_SENDER_ID` in `backend/.env`, or in the API environment on Dokploy. While these are empty, the button shows "SMS is not set up" and nothing is sent.
  - Optional overrides: `SMS_API_URL` and `SMS_BALANCE_URL`.
  - The provider may require the **server's IP to be whitelisted**; otherwise it returns error 1032.
- **Development safety:** when `NODE_ENV` isn't `production`, every SMS goes to the test number `01973054376` (`DEV_SMS_NUMBER` in [backend/src/lib/sms.ts](backend/src/lib/sms.ts)), never to tenants.
- **Records and errors:**
  - Every attempt is stored in `InvoiceNotification`: the number, the text, the amount, SENT or FAILED, and the provider code. Each batch is also written to the audit log.
  - Provider error codes such as 1007 (insufficient balance) are shown in plain words in the dialog.

## Navigation speed

- Every section has a `loading.tsx` skeleton, so a click shows the next page's outline at once while its data loads.
- Links in the sidebar, the bottom bar and the Billing tabs use full prefetch. In production builds, their pages and data load in the background once the current page is idle.
- The client router cache keeps prefetched pages for 2 minutes and visited pages for 30 seconds (`experimental.staleTimes` in [frontend/next.config.ts](frontend/next.config.ts)). Every save calls `router.refresh()`, which clears it, so stale data can only come from changes made on another device or by the monthly invoice job.

## Scripts

| | backend | frontend |
|---|---|---|
| dev server | `npm run dev` | `npm run dev` |
| production build | `npm run build && npm start` | `npm run build && npm start` |
| typecheck | `npm run typecheck` | `npm run typecheck` |
| DB | `db:migrate`, `db:deploy`, `db:seed`, `db:studio` | |

## Installable app (PWA)

The frontend is a Progressive Web App. It can be installed from Chrome or Edge on Android and desktop (the **Install app** item in the user menu or the **More** sheet), or from Safari on iPhone/iPad (**Share → Add to Home Screen**). It opens full screen with the STMS icon.

- **Privacy:** the service worker ([frontend/public/sw.js](frontend/public/sw.js)) caches only hashed build assets and icons. Pages and `/api` responses are never stored on the device. With no connection the app shows an offline screen and an "offline" banner.
- **Service worker scope:** it registers only in production builds (`npm run build && npm start`, or the Docker image). To try it in dev, set `NEXT_PUBLIC_SW_DEV=true`.
- **Updates:** when a new version is deployed, users see a "new version is ready" prompt with a Reload button. Bump `VERSION` in `sw.js` to clear old caches.
- **HTTPS:** installing requires HTTPS (or `localhost`).

## Docker images

Each project has its own Dockerfile. Both images are multi-stage builds on `node:22-alpine`, run as a non-root user, and include a healthcheck.

| Image | Build | Listens | Notes |
|---|---|---|---|
| API | `docker build -t stms-api backend` | `:4000` | On start it runs `prisma migrate deploy` (set `SKIP_MIGRATIONS=true` to skip) and creates the admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD` if missing. Local-disk uploads go to the `/app/uploads` volume. |
| Web | `docker build -t stms-web --build-arg INTERNAL_API_URL=http://api:4000 frontend` | `:3000` | `INTERNAL_API_URL` is the API's **internal** address. It is baked into the build for the `/api` proxy, so rebuild if it changes. |

**API environment:** `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`, and `S3_*` (see [backend/.env.example](backend/.env.example)). `NODE_ENV=production` is set in the image, so cookies are `Secure`: serve the site over HTTPS.

Only the web container needs a public domain. The browser never calls the API directly.

**Secure cookies with an internal API address:**
- The browser only ever talks to the HTTPS domain. Next.js forwards `/api/*` to Express over the private network.
- Express sets `Secure` on the session cookie because `NODE_ENV=production`, not because of the connection it received. The browser then receives the cookie over HTTPS.
- So point `INTERNAL_API_URL` at the API's internal service name (for example `http://<api-service-name>:4000`), not at the public domain. Routing it through the public domain adds a trip through the internet, the proxy and TLS on every server-side request.
- To check after deploying, look for **Secure** on the `stms_session` cookie in DevTools.

## Deployment

The target is Dokploy. Each image can be its own Dokploy application, plus a Dokploy Postgres service.
