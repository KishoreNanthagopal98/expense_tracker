-- Allow the Supabase Data API (anon/authenticated roles) to read and write data.
-- Required when the app uses the publishable key instead of the service role key.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO anon, authenticated;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public users access" ON public.users;
CREATE POLICY "public users access"
  ON public.users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "public expenses access" ON public.expenses;
CREATE POLICY "public expenses access"
  ON public.expenses
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
