# CLAUDE.md: STMS (Shantikunjo Tenant Management System)

This is a landlord admin app for one building in Bangladesh. It covers tenants, apartments, leases, monthly invoices (rent, service charge, electricity), payments, dues and reports.

The product name is spelled **"Shantikunjo"**, never "Shantikunj".

- Full spec: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md). Requirement IDs such as ELEC-05a and BILL-09 come from it.
- Brand board: [docs/STMS Brand Style Guide Board.png](docs/STMS%20Brand%20Style%20Guide%20Board.png).
- Run, Docker and deployment notes: [README.md](README.md).

## Working rules

- **The user runs the apps.** Don't start dev servers. Verify with `npx tsc --noEmit` in `backend/` and `frontend/`.
  - Don't run `next build` inside `frontend/` while the user's dev server is running, because they share `.next/`. To check a production build, use `docker build frontend` instead.
  - For live checks, the user may give you a temporary `stms_session` cookie token.
- **`backend/.env` holds real secrets and a real S3 bucket.** Never print it. Any upload test writes to the bucket, so clean up through the API.
- **SMS costs real credit.** Never call `POST /api/invoices/notify` with a configured key unless the user asks. Outside production it only reaches the test number 01973054376.
- **Prisma is pinned to 6.19.3.** Ignore IDE hints about Prisma 7, such as "`url` is no longer supported in schema". Next.js is pinned to 15.5.x.
- **Deployment target is Dokploy, with one Dockerfile per project.** Don't reintroduce a single combined container.
- **Commits:** the user commits on `main`. Only commit when asked.

## Architecture

```
browser ──HTTPS──▶ Next.js (frontend, :3000) ──rewrite /api/*──▶ Express (backend, :4000) ──▶ PostgreSQL 16
                     │ server components call INTERNAL_API_URL directly          └──▶ S3 (or local ./uploads)
```

- **One origin.** `next.config.ts` rewrites `/api/:path*` to `${INTERNAL_API_URL}/api/:path*`, so there is no CORS.
  - `INTERNAL_API_URL` is baked in at build time; it's a Docker build arg.
  - In production it should be the API's internal service name, not the public domain.
- **Auth uses opaque server-side sessions, not JWT.**
  - The `Session` table stores a SHA-256 hash of the token plus `SESSION_SECRET`.
  - The token travels in the httpOnly cookie `stms_session`, which has a 30-day sliding expiry; `lastUsedAt` is written at most once an hour.
  - The cookie is marked `Secure` when `NODE_ENV=production`.
- **Money** is stored as `Decimal(12,2)`. The backend works with `Prisma.Decimal` through `lib/money.ts` (`D`, `ZERO`, `sum`, `num`), never with floats. The API serializes money as JS numbers.
- **Dates and periods:**
  - Calendar dates are Postgres `DATE` values, built in UTC from Asia/Dhaka calendar days (see `lib/dates.ts`).
  - Billing periods are `YYYY-MM` strings.
  - The API serializes dates as `YYYY-MM-DD`.

## Commands

| | backend/ | frontend/ |
|---|---|---|
| dev | `npm run dev` (tsx watch, loads `.env`) | `npm run dev` |
| typecheck | `npx tsc --noEmit` | `npx tsc --noEmit` |
| DB | `npm run db:migrate` (new migration), `db:deploy`, `db:seed [-- --force]`, `db:studio` | |
| admin | `npm run create-admin` (after build; `--reset` resets the password) | |

Local Postgres runs from `docker compose up -d db`, defined in the root `docker-compose.yml`. It is the only service in that file.

## Backend (`backend/`)

Express 5 with TypeScript (ESM, NodeNext). Imports use `.js` suffixes. Validation uses Zod 3.

```
prisma/schema.prisma      Models: User, Session, Property, Apartment, Tenant, FamilyMember, Document,
                          Lease, MeterReading, Invoice, InvoiceLine, Payment, PaymentAllocation,
                          InvoiceNotification (SMS log),
                          Setting (JSON), Sequence, AuditLog. binaryTargets include linux-musl.
prisma/seed.ts            Dev data: 8 apartments, 6 tenants, ~8 months of bills and payments.
                          --force wipes business data (S3 files are NOT deleted).
src/index.ts              Starts the server and the scheduler.
src/app.ts                Middleware, /api/health, /api/auth, then an admin-only router mounting
                          every module (requireAuth + requireRole("ADMIN")).
src/config.ts             Zod-validated env: PORT, HOST, DATABASE_URL, SESSION_SECRET, APP_URL,
                          SESSION_DAYS, UPLOAD_DIR, S3_*, ENABLE_CRON. Exports isProd.
src/jobs/scheduler.ts     node-cron: generates invoices at 00:05 Asia/Dhaka on the 1st, plus a
                          catch-up run at startup.
src/scripts/create-admin.ts  ensureAdmin() from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
src/middleware/auth.ts    requireAuth, requireRole. Sets req.user.
src/middleware/error.ts   HttpError, Multer, Prisma P2002/P2025/P2003 → JSON {error}.
src/lib/
  http.ts       HttpError + badRequest/notFound/conflict; body(req, schema) / query() / param() parsers.
  auth.ts       argon2 hashing, createSession/findSession/revokeSession, set/clearSessionCookie.
  settings.ts   AppSettings + DEFAULT_SETTINGS, getSettings/saveSettings (deep-merges electricity),
                calcElectricity (flat rate ≤ maxUnits; otherwise slabs + demand charge + VAT).
  storage.ts    putObject/deleteObject/signedUrl/localStream (S3 when S3_BUCKET is set, else disk).
  dates.ts      todayISO, toDate, currentPeriod, periodStart/End, dueDateFor, addMonths, PERIOD_RE.
  sms.ts        bulksmsbd.net client: normalizeBdPhone, renderSms (Bangla month/amount/digits), smsParts,
                sendMany (JSON, falls back to form post), getBalance, DEV_SMS_NUMBER (all SMS outside production).
  sort.ts       compareApt / byApartmentThenName: natural apartment order ("A2" < "A10"), names ignoring
                punctuation. Every tenant, invoice, meter-reading, apartment and report list is sorted with
                it after fetching (a DB ORDER BY on the text gets A10 < A2). No apartment = last, by name.
  money.ts, sequence.ts (nextNumber → INV-YYYY-NNNN / RCT-YYYY-NNNN), audit.ts, prisma.ts (Tx type), logger.ts.
src/modules/<name>/routes.ts   One Express Router per resource, mounted at /api/<name>:
  auth            login (rate-limited), logout, me, change-password
  apartments      CRUD; status is derived (OCCUPIED/VACANT/MAINTENANCE). Exports activeLeaseWhere, serializeApartment.
  tenants         list (active|former|archived|all + search), CRUD, family replace, archive/restore,
                  ledger. balance.ts holds tenantBalances() and tenantLedger().
  documents       mounted at "/": upload (magic-byte sniffing, per-type rules; PHOTO, LEASE_FORM and
                  POLICE_VERIFICATION supersede older uploads), file (signed-URL redirect), delete.
  leases          create (checks, initial meter reading, first invoice), patch, notice,
                  cancel-notice, end (re-prorates the final month in place, then applyCredit).
                  serialize.ts holds the lease serializer.
  invoices        service.ts = the billing core (see below). Routes: list, generate, get, add line
                  (DISCOUNT is stored negative), delete line, void. SMS: POST /invoices/notify
                  {invoiceIds} and GET /invoices/notify/preview (registered before /:id); each attempt
                  is stored as an InvoiceNotification. serializeInvoice adds notifiedAt / notifyCount.
  payments        list, create (+ allocation), get, delete.
  meter-readings  service.ts: lastReading, recordInitialReading, recordBillingReading ({append}
                  for final readings). Routes: bulk sheet, /estimate, post, delete.
  reports         queries.ts (raw SQL: byType, monthlySeries, duesByTenant, periodRows).
                  Routes: monthly, dues, yearly.
  dashboard       KPIs, charts and dues for the current period.
  sms             GET /sms/status → {configured, devOverride, devNumber, balance}.
  settings        GET/PUT app settings (Zod schema here); property.ts syncs the Property row.
```

### Billing core (`modules/invoices/service.ts`)

- **`ensureInvoice(tx, lease, period)`** creates at most one invoice per `(leaseId, period)`, with RENT and SERVICE_CHARGE lines prorated by `coverage()`.
- **`generateForPeriod(period)`** generates for every billable lease. It is idempotent.
- **`recalcInvoice(tx, id)`:**
  - Recomputes `total`, `paidAmount` and `status`.
  - If the total dropped below what has been paid, it trims the newest allocations.
- **`allocate(...)`** applies payments oldest-due-first. Anything left over is unallocated credit, which **`applyCredit(tx, tenantId)`** later uses up.
- **Void** releases the invoice's payments back to credit.
- **Electricity:** recording a meter reading adds or updates an ELECTRICITY line linked by `meterReadingId`.
- **Rounding:** `recalcInvoice` calls `syncRounding`, which keeps one system-managed `ROUNDING` line so the total is a whole taka (half up). It can't be added or removed through the API. Invoices paid to the paisa without one are left alone. `ensureInvoice` calls `recalcInvoice` after creating. `src/scripts/round-open-invoices.ts` (`npm run round-invoices [-- --dry-run]`) backfills open invoices.
- **Writes:** all financial writes run in `prisma.$transaction` and call `audit()`.

## Frontend (`frontend/`)

Next.js 15 App Router with React 19, Tailwind v4 (CSS `@theme` tokens), lucide-react, Recharts 3 and sonner toasts. The UI components are hand-built; there is no shadcn and no TanStack.

```
src/middleware.ts          Cookie gate. PUBLIC = /login, /styleguide, /offline. The matcher excludes
                           api, _next, sw.js, manifest, icons and images.
src/lib/
  api.server.ts   api<T>(path) / apiOrNull<T>() for server components: forwards cookies to
                  INTERNAL_API_URL, cache "no-store"; a 401 redirects to /login.
  api.client.ts   apiFetch<T>(path, {method, json|body}) → relative /api; errorMessage(err).
  types.ts        Every API response type (Invoice, Tenant, Settings, Dashboard, ...). Keep in sync with backend.
  utils.ts        cn, taka (BDT ৳, en-IN grouping), number, compactTaka, periodLabel, formatDate,
                  ordinal, shiftPeriod, and label maps (FACING_, RELATION_, METHOD_, LINE_, DOC_LABEL).
  electricity.ts  estimateBill() mirrors backend calcElectricity (returns {mode, total}). Change both together.
  pwa.ts          installPrompt store, isStandalone, isIOS.
src/app/
  layout.tsx      Font (Plus Jakarta Sans), metadata/icons, <Toaster/>, <PwaProvider/>.
  globals.css     @theme brand tokens + @media print rules (hides chrome, keeps colours).
  manifest.ts, offline/, login/, styleguide/ (renders every token and component), error.tsx, not-found.tsx.
  (app)/layout.tsx  Authenticated shell: fetches /auth/me and /settings; Sidebar, header, BottomNav.
  (app)/<section>/page.tsx  Server components that fetch with api() and render. Sections: dashboard,
                  tenants (list/new/[id]/[id]/edit), apartments (same), leases/new,
                  billing (layout with tabs; invoices list at /billing, invoices/[id], payments,
                  meter-readings), reports (?tab=monthly|dues|yearly), settings.
  (app)/**/loading.tsx  Skeleton screens built from components/ui/skeleton.tsx. Add one for every new route.
src/components/
  ui/        button (Button, ButtonLink), card, badge (status badges), alert, field (Field, Input,
             Textarea, Select, SearchInput), dialog (native <dialog>; bottom sheet on mobile),
             misc (PageHeader, EmptyState, Avatar, DescList, StatTile), tabs (FilterTabs),
             billing-tabs, search-box, month-picker, csv-button, skeleton.
  forms/     Client components that mutate data: apartment-form, tenant-form (+ upload.ts),
             lease-form, lease-actions, payment-dialog, generate-invoices, invoice-actions,
             meter-sheet, settings-form, documents-panel, archive-button, delete-payment,
             notify-dialog (NotifyTenantsButton + NotifiedBadge).
  shell/     nav.ts (NAV items), sidebar, bottom-nav, user-menu.
  charts/    income-trend, by-type (Recharts).
  pwa/       pwa-provider (SW registration, offline banner, update toast), install-button.
  print-invoice.tsx   A4 print-only invoice (hidden on screen; the screen card is print:hidden).
  logo.tsx, building-illustration.tsx
public/sw.js  Hand-written service worker. It caches only /_next/static and icons, never pages or /api.
              It registers only in production, or in dev with NEXT_PUBLIC_SW_DEV=true.
next.config.ts  output "standalone", the /api rewrite, sw.js headers, experimental.staleTimes
              (dynamic 30 s, static 120 s). Nav links use `prefetch` for full background prefetch.
```

### Frontend conventions

- **Data flow:**
  - Pages are async server components that call `api()`.
  - Mutations live in `"use client"` components that call `apiFetch()`, show a sonner toast, then call `router.refresh()`. That call also clears the prefetch cache, so keep it in every new mutation.
- **Styling:**
  - Use the brand tokens from `globals.css`: `primary` #0B2D6B, `accent` #2563EB, `primary-light`, `ink`, `muted`, `line`, `canvas`, `surface`, and the `success`/`warning`/`danger` families.
  - The UI is light mode only.
  - Design mobile-first: card lists on small screens, tables from `md:` up, and touch targets of at least 44 px.
- **Money and dates in the UI:** format money with `taka()` and dates with `formatDate()`. Don't hand-format either.
- **Printing:** wrap anything that shouldn't print in `print:hidden`.
- **List order:** lists come from the API already sorted (apartment number, then name). Don't re-sort them in the UI; change `lib/sort.ts` instead.

## Recipes

- **Add a setting:**
  1. In `backend/src/lib/settings.ts`, add it to `AppSettings` and `DEFAULT_SETTINGS`.
  2. Add it to the Zod schema in `backend/src/modules/settings/routes.ts`.
  3. Add it to `Settings` in `frontend/src/lib/types.ts`.
  4. Add the field to `frontend/src/components/forms/settings-form.tsx`, including its key in the PUT body.

  Existing stored settings pick up defaults through `getSettings()`, so no migration is needed.
- **Add a field to a model:**
  1. Edit `schema.prisma` and run `npm run db:migrate -- --name <name>` in `backend/`.
  2. Update that module's Zod schema, its serializer, and any `select`/`include` that should return the field.
  3. Update `frontend/src/lib/types.ts`, then the form and the page.
- **Add an API endpoint:** add it to the module's `routes.ts` and parse input with `body()`/`query()`/`param()`. Wrap financial writes in a transaction and call `audit()`. A new module also needs mounting in `src/app.ts`.
- **Add a page:**
  1. Create `src/app/(app)/<route>/page.tsx` as a server component with `metadata`.
  2. Add a matching `loading.tsx`.
  3. If it belongs in the navigation, add it to `components/shell/nav.ts`.
- **Change electricity pricing:** edit both `calcElectricity` (backend) and `estimateBill` (frontend), and keep them identical.
