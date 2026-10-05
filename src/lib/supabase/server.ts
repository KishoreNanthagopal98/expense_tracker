import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export class SetupError extends Error {}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new SetupError(
      `Supabase is not configured. Set ${name} in .env.local (see .env.example).`
    );
  }
  return value;
}

let adminClient: SupabaseClient | null = null;

/** Server-side Supabase client. Uses the service role key when available. */
export function getSupabaseAdmin(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!key) {
    throw new SetupError(
      "Supabase is not configured. Set SUPABASE_SERVICE_ROLE_KEY (recommended) or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local."
    );
  }

  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}
