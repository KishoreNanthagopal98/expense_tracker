-- Add user column for existing installations
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS "user" text NOT NULL DEFAULT '';
