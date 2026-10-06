import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { addSaving, computeBalance, deleteSaving, listSavings, SetupError, updateSaving } from "@/lib/savings";
import { SavingInput } from "@/lib/types";

function fail(err: unknown) {
  if (err instanceof SetupError) {
    return Response.json({ error: err.message, setup: true }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(err);
  return Response.json({ error: message }, { status: 500 });
}

function parseInput(body: Record<string, unknown>): SavingInput {
  const amount = Number(body.amount);
  const date = String(body.date ?? "");
  const userId = String(body.userId ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("A valid date is required");
  if (!String(body.description ?? "").trim()) throw new Error("Description is required");
  if (!userId) throw new Error("User is required");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");
  return {
    date,
    description: String(body.description).trim(),
    amount,
    type: body.type === "Withdrawal" ? "Withdrawal" : "Deposit",
    userId,
    notes: String(body.notes ?? "").trim(),
  };
}

export async function GET() {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;
  try {
    const savings = await listSavings();
    return Response.json({ savings, balance: computeBalance(savings) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const input = parseInput(body);
    const saving = await addSaving(input);
    const savings = await listSavings();
    return Response.json({ saving, balance: computeBalance(savings) }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;
  try {
    const body = await req.json();
    const input = parseInput(body);
    const id = String(body.id ?? "");
    if (!id) throw new Error("An id is required");
    const saving = await updateSaving(id, input);
    const savings = await listSavings();
    return Response.json({ saving, balance: computeBalance(savings) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof Response) return auth;
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!id) throw new Error("An id is required");
    await deleteSaving(id);
    const savings = await listSavings();
    return Response.json({ ok: true, balance: computeBalance(savings) });
  } catch (err) {
    return fail(err);
  }
}
