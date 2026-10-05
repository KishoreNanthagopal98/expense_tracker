-- Users table and link to expenses
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

INSERT INTO public.users (name) VALUES
  ('Kishore'),
  ('Pavithra')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.users(id);

-- Map any existing text "user" values to the new users table
UPDATE public.expenses e
SET user_id = u.id
FROM public.users u
WHERE e.user_id IS NULL
  AND trim(e."user") <> ''
  AND lower(trim(e."user")) = lower(u.name);

-- Optional: remove the old text column after verifying data
-- ALTER TABLE public.expenses DROP COLUMN IF EXISTS "user";

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses (user_id);
