# Expense Tracker

A Next.js app for tracking monthly expenses and income, backed by **Supabase Postgres**.

Entries are stored in a single `expenses` table and grouped by month from each entry's date (`YYYY-MM`).

## Setup

1. **Create a Supabase project** at [supabase.com/dashboard](https://supabase.com/dashboard).

2. **Copy env vars** from **Project Settings → API**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server-only — never prefix with `NEXT_PUBLIC_`)

3. **Create the database table** — choose one:

   **Option A — automatic (recommended):** Add your Postgres connection string as `SUPABASE_DB_URL` in `.env.local`  
   (**Project Settings → Database → Connection string → URI**, Transaction pooler).  
   The app runs `CREATE TABLE IF NOT EXISTS` on first API request.

   **Option B — manual:** Open the **SQL Editor** in Supabase and run `supabase/migrations/0001_create_expenses.sql`.

4. **Run the app:**
   ```bash
   npm install
   npm run dev
   ```
   Open http://localhost:3000.

## Database schema

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| date | date | `YYYY-MM-DD` |
| description | text | Required |
| category | text | Default `Other` |
| amount | numeric | Must be > 0 |
| type | text | `Expense` or `Income` |
| payment_method | text | e.g. UPI, Cash |
| notes | text | Optional |
| created_at | timestamptz | Set automatically |
| updated_at | timestamptz | Updated on edit |

Row Level Security is enabled. API routes use the service role key on the server.

## Features

- Switch months with the arrows or the dropdown
- Add, edit and delete entries (saved to Supabase immediately)
- Change an entry's date to another month and it moves automatically
- Income, expense and balance totals, plus a spending-by-category breakdown
- Search and filter by category or type
- Set the display currency with `NEXT_PUBLIC_CURRENCY` (default `INR`)

## Code layout

- `src/lib/supabase/server.ts`: Supabase server client
- `src/lib/db/schema.ts`: `CREATE TABLE IF NOT EXISTS` bootstrap
- `src/lib/expenses.ts`: Database reads and writes (server only)
- `src/app/api/expenses/route.ts`: GET/POST/PUT/DELETE for entries
- `src/app/api/months/route.ts`: Lists months that have entries
- `src/components/ExpenseApp.tsx`: The UI
- `supabase/migrations/0001_create_expenses.sql`: Manual migration SQL

> Keep `.env.local` private. The service role key and database URL grant full access to your project.
