# BizFlow

Multi-tenant business management for small and medium businesses in Kosovo: inventory, sales, purchasing, expenses and reporting. Albanian by default, with English available. Prices are in EUR and times are shown in Kosovo local time (Europe/Belgrade).

**Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI), React Hook Form, Zod, next-intl, Supabase (Postgres, Auth, Storage, RLS), Vercel.

## Status

Phase 1 (foundation) is done: design system, i18n, authentication, company onboarding, the full database schema with RLS, and the stock movement RPCs. Business modules (products, inventory, sales, and so on) arrive in later phases; they show as "Soon" in the sidebar.

## Getting started

Requirements: Node 20+ and npm. For the database you need one of:

- **Supabase CLI with Docker** (recommended): run `npx supabase start`.
- **A Supabase cloud project.**
- **Local Postgres without Docker:** see `scripts/local-stack.sh` below.

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + keys
```

### Option A: Supabase cloud project

1. Create a project (EU region recommended).
2. Apply the migrations: `npx supabase link --project-ref <ref>`, then `npx supabase db push`.
3. In **Auth → URL Configuration**, set the Site URL to your app URL. Add `<app-url>/auth/confirm` to the redirect URLs.
4. Fill `.env.local` with the project URL, the anon key, and the service role key.
5. Run `npm run dev` and open http://localhost:3000.

### Option B: Supabase CLI (Docker)

```bash
npx supabase start          # prints the API URL, anon key and service_role key
npx supabase db reset       # applies supabase/migrations + seed.sql
npm run dev
```

### Option C: no Docker (`scripts/local-stack.sh`)

This runs Supabase Auth (GoTrue) and PostgREST against a local Postgres superuser connection, using the standard `PG*` environment variables. It does not include Storage or Realtime.

```bash
scripts/local-stack.sh setup   # downloads binaries, creates DB, applies migrations, writes .env.local
scripts/local-stack.sh start   # emails land in .local-stack/mail/ (needs `pip install aiosmtpd`)
```

### Demo data

```bash
npm run seed:demo
```

This creates the company "Market Dardania SH.P.K." with:

- three users: `pronari@` (owner), `menaxheri@` (manager), and `punonjesi@` (employee), all `@bizflow.demo`, with password `BizFlowDemo2026`;
- 8 products, opening stock, a warehouse transfer, customers, suppliers, and expenses.

The script refuses to run against a non-local URL unless `SEED_ALLOW_REMOTE=1` is set.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript, ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run db:test:local` | Applies all migrations to a throwaway Postgres DB and runs the SQL RLS/RPC suite (`supabase/tests/local`) |
| `npm run test:integration` | API-level tenant isolation tests against a running, seeded backend |
| `npm run seed:demo` | Demo company and users |
| `npm run db:types` | Regenerates `src/types/database.ts` from the linked Supabase project |

## Architecture

```
src/app/(auth)        login, signup, forgot/reset password
src/app/auth/confirm  email link handler (PKCE code or token_hash)
src/app/onboarding    company registration → create_company RPC
src/app/(app)         authenticated shell (sidebar, top bar) and modules
src/lib/supabase      browser, server, middleware and service-role (server-only) clients
src/lib/auth          session/company context (server-only), pure permission helpers, actions
src/lib/validation    Zod schemas; error messages are i18n keys
src/lib/format.ts     EUR, number, date helpers (Europe/Belgrade display, UTC storage)
messages/{sq,en}.json translations
supabase/migrations   schema, RLS, functions, reference data, storage
```

### Multi-tenancy and security

- **Tenant isolation.** Every tenant table has `company_id`, and RLS is enabled on every table. Policies call `has_permission(company_id, '<module>.<action>')`, which reads the caller from `auth.uid()`. Composite foreign keys `(id, company_id)` make it impossible to reference another tenant's rows.
- **Company context.** The active company comes from a cookie, but it is only a hint. The server always resolves it against the user's active memberships (`getCompanyContext`). Permissions come from the `my_permissions` RPC, never from the client.
- **Roles.** The system roles are `owner`, `admin`, `manager`, and `employee`, plus the platform role `super_admin` (granted via `platform_admins`). The role → permission mapping lives in data (`role_permissions`). Triggers prevent self-escalation, granting the owner role unless you are an owner, and leaving a company without an owner.
- **Stock.** `stock_levels` and `stock_movements` are read-only to users. Quantities change only through the `record_stock_movement` and `transfer_stock` RPCs. These run in one transaction, lock the stock row, validate tenant ownership, reject negative stock, and append to the ledger. The ledger itself is append-only.
- **Soft delete.** Rows are soft-deleted via `deleted_at`. Setting or clearing it requires `<module>.delete`, which a trigger enforces.
- **Subscriptions.** Subscriptions, billing invoices, billing payments, activity logs and document sequences can only be written by RPCs or the service role. Plans are data (`subscription_plans`): Starter €19 with 2 employees, Professional €39 with 10, and Business €79 with 25, each with a 14-day trial. Seat limits count members other than owners and are enforced by a trigger.
- **Service role key.** It is used only server-side (`src/lib/supabase/admin.ts` imports `server-only`) and in scripts.

### Money and time

- Amounts are `numeric(14,2)`, quantities `numeric(14,3)`, and VAT rates `numeric(5,2)`. The default VAT is 18%; Kosovo's reduced rate is 8%.
- Timestamps are `timestamptz` (UTC). The UI shows them in `Europe/Belgrade`. Calendar dates (`order_date`, `expense_date`) are plain `date` columns.
