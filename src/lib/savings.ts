import "server-only";
import { randomUUID } from "crypto";
import { ensureDbReady } from "@/lib/db/schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { Saving, SavingInput, SavingType } from "@/lib/types";

export { SetupError } from "@/lib/supabase/server";

type UserJoin = { name: string } | { name: string }[] | null;

type SavingRow = {
  id: string;
  date: string;
  description: string;
  amount: number | string;
  type: string;
  user_id: string;
  notes: string;
  users: UserJoin;
};

const SAVING_SELECT = "*, users ( name )";

function userName(join: UserJoin): string {
  if (!join) return "";
  if (Array.isArray(join)) return join[0]?.name ?? "";
  return join.name ?? "";
}

function toSaving(row: SavingRow): Saving {
  return {
    id: row.id,
    date: row.date.slice(0, 10),
    description: row.description,
    amount: Number(row.amount),
    type: row.type === "Withdrawal" ? "Withdrawal" : "Deposit",
    userId: row.user_id,
    user: userName(row.users),
    notes: row.notes ?? "",
  };
}

function toInsert(input: SavingInput, id?: string) {
  return {
    ...(id ? { id } : {}),
    date: input.date,
    description: input.description,
    amount: input.amount,
    type: input.type as SavingType,
    user_id: input.userId,
    notes: input.notes,
    updated_at: new Date().toISOString(),
  };
}

export function computeBalance(savings: Saving[]): number {
  return savings.reduce((sum, s) => sum + (s.type === "Withdrawal" ? -s.amount : s.amount), 0);
}

export async function listSavings(): Promise<Saving[]> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("savings")
    .select(SAVING_SELECT)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as SavingRow[]).map(toSaving);
}

export async function addSaving(input: SavingInput): Promise<Saving> {
  await ensureDbReady();
  const id = randomUUID();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("savings").insert(toInsert(input, id)).select(SAVING_SELECT).single();
  if (error) throw new Error(error.message);
  return toSaving(data as SavingRow);
}

export async function updateSaving(id: string, input: SavingInput): Promise<Saving> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("savings")
    .update(toInsert(input))
    .eq("id", id)
    .select(SAVING_SELECT)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Entry not found — refresh and try again.");
  return toSaving(data as SavingRow);
}

export async function deleteSaving(id: string): Promise<void> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("savings").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Entry not found — refresh and try again.");
}
