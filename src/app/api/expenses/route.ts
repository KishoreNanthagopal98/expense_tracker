import { NextRequest } from "next/server";
import { addExpense, deleteExpense, listAllExpenses, listExpenses, SetupError, updateExpense } from "@/lib/expenses";
import { ExpenseInput } from "@/lib/types";

function fail(err: unknown) {
  if (err instanceof SetupError) {
    return Response.json({ error: err.message, setup: true }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(err);
  return Response.json({ error: message }, { status: 500 });
}

function parseInput(body: Record<string, unknown>): ExpenseInput {
  const amount = Number(body.amount);
  const date = String(body.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("A valid date is required");
  if (!String(body.description ?? "").trim()) throw new Error("Description is required");
  const userId = String(body.userId ?? "").trim();
  if (!userId) throw new Error("User is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");
  return {
    date,
    description: String(body.description).trim(),
    category: String(body.category ?? "Other"),
    amount,
    type: body.type === "Income" ? "Income" : "Expense",
    paymentMethod: String(body.paymentMethod ?? ""),
    notes: String(body.notes ?? "").trim(),
    userId,
  };
}

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month") ?? "";
    const expenses = month ? await listExpenses(month) : await listAllExpenses();
    return Response.json({ expenses });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = parseInput(body);
    // The tab is chosen from the entry's date so entries always land in the right month.
    return Response.json({ expense: await addExpense(input.date.slice(0, 7), input) }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const input = parseInput(body);
    const month = String(body.month ?? "");
    const id = String(body.id ?? "");
    const newMonth = input.date.slice(0, 7);
    if (newMonth !== month) {
      // Date moved to another month: move the row to that month's tab.
      const expense = await addExpense(newMonth, input);
      await deleteExpense(month, id);
      return Response.json({ expense, moved: true });
    }
    return Response.json({ expense: await updateExpense(month, id, input) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get("month") ?? "";
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!id) throw new Error("An expense id is required");
    await deleteExpense(month, id);
    return Response.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
