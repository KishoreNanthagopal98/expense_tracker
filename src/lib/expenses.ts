import "server-only";
import { randomUUID } from "crypto";
import { ensureDbReady } from "@/lib/db/schema";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { Expense, ExpenseInput, EntryType, MONTH_RE } from "@/lib/types";

export { SetupError } from "@/lib/supabase/server";

type UserJoin = { name: string } | { name: string }[] | null;

type ExpenseRow = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number | string;
  type: string;
  payment_method: string;
  notes: string;
  user_id: string;
  users: UserJoin;
};

const EXPENSE_SELECT = "*, users ( name )";

function assertMonth(month: string) {
  if (!MONTH_RE.test(month)) throw new Error(`Invalid month "${month}", expected YYYY-MM`);
}

function monthBounds(month: string) {
  const [year, mon] = month.split("-").map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function userName(join: UserJoin): string {
  if (!join) return "";
  if (Array.isArray(join)) return join[0]?.name ?? "";
  return join.name ?? "";
}

function toExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    date: row.date.slice(0, 10),
    description: row.description,
    category: row.category || "Other",
    amount: Number(row.amount),
    type: row.type === "Income" ? "Income" : "Expense",
    paymentMethod: row.payment_method ?? "",
    notes: row.notes ?? "",
    userId: row.user_id,
    user: userName(row.users),
  };
}

function toInsert(input: ExpenseInput, id?: string) {
  return {
    ...(id ? { id } : {}),
    date: input.date,
    description: input.description,
    category: input.category,
    amount: input.amount,
    type: input.type as EntryType,
    payment_method: input.paymentMethod,
    notes: input.notes,
    user_id: input.userId,
    updated_at: new Date().toISOString(),
  };
}

export async function listMonths(): Promise<string[]> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("expenses").select("date");
  if (error) throw new Error(error.message);

  const months = new Set<string>();
  for (const row of data ?? []) {
    const month = String(row.date).slice(0, 7);
    if (MONTH_RE.test(month)) months.add(month);
  }
  return [...months].sort().reverse();
}

export async function listExpenses(month: string): Promise<Expense[]> {
  assertMonth(month);
  await ensureDbReady();
  const { start, end } = monthBounds(month);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as ExpenseRow[]).map(toExpense);
}

export async function listAllExpenses(): Promise<Expense[]> {
  await ensureDbReady();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("expenses")
    .select(EXPENSE_SELECT)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data as ExpenseRow[]).map(toExpense);
}

export async function addExpense(month: string, input: ExpenseInput): Promise<Expense> {
  assertMonth(month);
  await ensureDbReady();
  const id = randomUUID();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("expenses")
    .insert(toInsert(input, id))
    .select(EXPENSE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return toExpense(data as ExpenseRow);
}

export async function updateExpense(month: string, id: string, input: ExpenseInput): Promise<Expense> {
  assertMonth(month);
  await ensureDbReady();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("expenses")
    .update(toInsert(input))
    .eq("id", id)
    .select(EXPENSE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Entry not found — refresh and try again.");
  return toExpense(data as ExpenseRow);
}

export async function deleteExpense(month: string, id: string): Promise<void> {
  if (month) assertMonth(month);
  await ensureDbReady();
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase.from("expenses").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Entry not found — refresh and try again.");
}
