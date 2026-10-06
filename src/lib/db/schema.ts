import "server-only";
import postgres from "postgres";
import { getSupabaseAdmin, SetupError } from "@/lib/supabase/server";

const EXPENSES_TABLE = "expenses";
const USERS_TABLE = "users";
const SAVINGS_TABLE = "savings";

const USERS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS public.${USERS_TABLE} (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    password text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE public.${USERS_TABLE} ENABLE ROW LEVEL SECURITY`,
  `ALTER TABLE public.${USERS_TABLE} ADD COLUMN IF NOT EXISTS password text`,
];

const SAVINGS_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS public.${SAVINGS_TABLE} (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    description text NOT NULL,
    amount numeric(12, 2) NOT NULL CHECK (amount > 0),
    type text NOT NULL DEFAULT 'Deposit' CHECK (type IN ('Deposit', 'Withdrawal')),
    user_id uuid REFERENCES public.${USERS_TABLE}(id),
    notes text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_savings_date ON public.${SAVINGS_TABLE} (date DESC)`,
  `ALTER TABLE public.${SAVINGS_TABLE} ENABLE ROW LEVEL SECURITY`,
];

const API_ACCESS_STATEMENTS = [
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${USERS_TABLE} TO anon, authenticated`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${EXPENSES_TABLE} TO anon, authenticated`,
  `GRANT SELECT, INSERT, UPDATE, DELETE ON public.${SAVINGS_TABLE} TO anon, authenticated`,
  `DROP POLICY IF EXISTS "public users access" ON public.${USERS_TABLE}`,
  `CREATE POLICY "public users access" ON public.${USERS_TABLE} FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "public expenses access" ON public.${EXPENSES_TABLE}`,
  `CREATE POLICY "public expenses access" ON public.${EXPENSES_TABLE} FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`,
  `DROP POLICY IF EXISTS "public savings access" ON public.${SAVINGS_TABLE}`,
  `CREATE POLICY "public savings access" ON public.${SAVINGS_TABLE} FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)`,
];

const SCHEMA_STATEMENTS = [
  ...USERS_SCHEMA,
  `CREATE TABLE IF NOT EXISTS public.${EXPENSES_TABLE} (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    date date NOT NULL,
    description text NOT NULL,
    category text NOT NULL DEFAULT 'Other',
    amount numeric(12, 2) NOT NULL CHECK (amount > 0),
    type text NOT NULL DEFAULT 'Expense' CHECK (type IN ('Expense', 'Income')),
    payment_method text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT '',
    user_id uuid REFERENCES public.${USERS_TABLE}(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.${EXPENSES_TABLE} (date DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.${EXPENSES_TABLE} (user_id)`,
  `ALTER TABLE public.${EXPENSES_TABLE} ENABLE ROW LEVEL SECURITY`,
  `INSERT INTO public.${USERS_TABLE} (name) VALUES ('Kishore'), ('Pavithra') ON CONFLICT (name) DO NOTHING`,
  ...SAVINGS_SCHEMA,
  ...API_ACCESS_STATEMENTS,
];

const MIGRATION_STATEMENTS = [
  ...USERS_SCHEMA,
  `ALTER TABLE public.${EXPENSES_TABLE} ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.${USERS_TABLE}(id)`,
  `CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.${EXPENSES_TABLE} (user_id)`,
  `INSERT INTO public.${USERS_TABLE} (name) VALUES ('Kishore'), ('Pavithra') ON CONFLICT (name) DO NOTHING`,
  ...SAVINGS_SCHEMA,
  ...API_ACCESS_STATEMENTS,
];

let schemaReady: Promise<void> | null = null;

async function tableExists(table: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(table).select("id").limit(1);
  if (!error) return true;

  const code = String((error as { code?: string }).code ?? "");
  const message = error.message.toLowerCase();
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  ) {
    return false;
  }
  throw new Error(error.message);
}

async function runSqlStatements(dbUrl: string, statements: string[]): Promise<void> {
  const sql = postgres(dbUrl, { ssl: "require", prepare: false, max: 1 });
  try {
    for (const statement of statements) {
      await sql.unsafe(statement);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function applyMigrations(dbUrl: string): Promise<void> {
  await runSqlStatements(dbUrl, MIGRATION_STATEMENTS);
}

/** Creates tables and indexes when missing. Safe to call on every request. */
export async function ensureSchema(): Promise<void> {
  const dbUrl = process.env.SUPABASE_DB_URL?.trim();
  const expensesExist = await tableExists(EXPENSES_TABLE);

  if (!expensesExist) {
    if (!dbUrl) {
      throw new SetupError(
        `The "${EXPENSES_TABLE}" table is missing. Either set SUPABASE_DB_URL in .env.local so the app can create it automatically, or run the SQL migrations in supabase/migrations/ in the Supabase SQL editor.`
      );
    }
    await runSqlStatements(dbUrl, SCHEMA_STATEMENTS);
    if (!(await tableExists(EXPENSES_TABLE))) {
      throw new Error(`Failed to create the "${EXPENSES_TABLE}" table.`);
    }
  }

  if (dbUrl) {
    await applyMigrations(dbUrl);
  } else if (!(await tableExists(USERS_TABLE))) {
    throw new SetupError(
      `The "${USERS_TABLE}" table is missing. Run supabase/migrations/0003_create_users_and_link.sql in the Supabase SQL editor.`
    );
  }
}

export function ensureDbReady(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureSchema().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
