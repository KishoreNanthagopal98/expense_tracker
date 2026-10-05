-- Expense tracker schema (also applied automatically when SUPABASE_DB_URL is set)
-- Run 0003_create_users_and_link.sql first if upgrading an existing database.

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  type text NOT NULL DEFAULT 'Expense' CHECK (type IN ('Expense', 'Income')),
  payment_method text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  user_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

INSERT INTO public.users (name) VALUES
  ('Kishore'),
  ('Pavithra')
ON CONFLICT (name) DO NOTHING;
