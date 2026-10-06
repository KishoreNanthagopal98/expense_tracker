import "server-only";
import { verifyPassword } from "@/lib/auth";
import { ensureDbReady } from "@/lib/db/schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AppUser } from "@/lib/types";

export { SetupError } from "@/lib/supabase/server";

type UserRow = { id: string; name: string; password?: string | null };

function toUser(row: UserRow): AppUser {
  return { id: row.id, name: row.name };
}

export async function listUsers(): Promise<AppUser[]> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("users").select("id, name").order("name");
  if (error) throw new Error(error.message);
  return (data as UserRow[]).map(toUser);
}

export async function addUser(name: string): Promise<AppUser> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("users").insert({ name: trimmed }).select("id, name").single();
  if (error) {
    if (error.code === "23505") throw new Error(`"${trimmed}" already exists`);
    throw new Error(error.message);
  }
  return toUser(data as UserRow);
}

export async function verifyUserPassword(userId: string, password: string): Promise<AppUser | null> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("users").select("id, name, password").eq("id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as UserRow;
  if (!verifyPassword(password, row.password)) return null;
  return toUser(row);
}

export async function deleteUser(id: string): Promise<void> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();

  const { count, error: countError } = await supabase
    .from("expenses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", id);
  if (countError) throw new Error(countError.message);
  if (count && count > 0) {
    throw new Error("Cannot delete a user who has expenses. Reassign or delete those expenses first.");
  }

  const { data, error } = await supabase.from("users").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("User not found");
}
