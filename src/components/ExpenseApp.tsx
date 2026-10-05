"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import { AppUser, CATEGORIES, Expense, ExpenseInput, PAYMENT_METHODS } from "@/lib/types";

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "INR";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: 2 });

function defaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function blankForm(userId = ""): ExpenseInput {
  return {
    date: defaultDate(),
    description: "",
    category: CATEGORIES[0],
    amount: 0,
    type: "Expense",
    paymentMethod: PAYMENT_METHODS[0],
    notes: "",
    userId,
  };
}

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900";

function sinceLastIncome(all: Expense[]) {
  const lastIncome = [...all]
    .filter((e) => e.type === "Income")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!lastIncome) return { lastIncome: null as Expense | null, entries: all };
  const entries = all.filter((e) => e.date >= lastIncome.date);
  return { lastIncome, entries };
}

export default function ExpenseApp() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [form, setForm] = useState<ExpenseInput>(() => blankForm());
  const [amountText, setAmountText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, usersRes] = await Promise.all([
        fetch(`/api/expenses`, { cache: "no-store" }),
        fetch(`/api/users`, { cache: "no-store" }),
      ]);
      const expData = await expRes.json();
      const usersData = await usersRes.json();
      if (!expRes.ok) {
        setSetupNeeded(Boolean(expData.setup));
        throw new Error(expData.error);
      }
      if (!usersRes.ok) throw new Error(usersData.error ?? "Failed to load users");
      setSetupNeeded(false);
      setExpenses(expData.expenses);
      setUsers(usersData.users ?? []);
    } catch (e) {
      setExpenses([]);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!editingId && users.length > 0 && !form.userId) {
      setForm((f) => ({ ...f, userId: users[0].id }));
    }
  }, [users, editingId, form.userId]);

  function cancelEdit() {
    setEditingId(null);
    setForm(blankForm(users[0]?.id ?? ""));
    setAmountText("");
  }

  function startEdit(e: Expense) {
    setEditingId(e.id);
    setForm({
      description: e.description,
      category: e.category,
      amount: e.amount,
      type: e.type,
      paymentMethod: e.paymentMethod,
      notes: e.notes,
      userId: e.userId,
      date: /^\d{4}-\d{2}-\d{2}$/.test(e.date) ? e.date : defaultDate() });
    setAmountText(String(e.amount));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, amount: Number(amountText) };
      const res = await fetch("/api/expenses", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingId ? { ...payload, id: editingId, month: form.date.slice(0, 7) } : payload
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      cancelEdit();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setConfirmDelete(null);
    setError(null);
    const prev = expenses;
    setExpenses((list) => list.filter((e) => e.id !== id));
    const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setExpenses(prev);
      setError((await res.json()).error ?? "Failed to delete");
    } else {
      load();
    }
  }

  const { lastIncome, entries: periodExpenses } = useMemo(() => sinceLastIncome(expenses), [expenses]);

  const totals = useMemo(() => {
    let income = 0;
    let spent = 0;
    const byCategory = new Map<string, number>();
    for (const e of periodExpenses) {
      if (e.type === "Income") income += e.amount;
      else {
        spent += e.amount;
        byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      }
    }
    const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    return { income, spent, balance: income - spent, categories };
  }, [periodExpenses]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodExpenses
      .filter((e) => filter === "All" || e.category === filter || e.type === filter)
      .filter((e) => !q || `${e.description} ${e.notes} ${e.category} ${e.user}`.toLowerCase().includes(q))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [periodExpenses, filter, search]);

  const usedCategories = useMemo(() => [...new Set(periodExpenses.map((e) => e.category))].sort(), [periodExpenses]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Add Expense / Income</h1>
          <p className="text-sm text-zinc-500">
            {lastIncome
              ? `Showing entries since last income · ${lastIncome.date} · ${lastIncome.description}`
              : "Showing all entries (no income recorded yet)"}
          </p>
        </div>
        <button onClick={load} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" title="Reload">
          ↻ Reload
        </button>
      </div>

      {setupNeeded && <SetupNotice message={error} />}
      {error && !setupNeeded && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Income" value={totals.income} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Expenses" value={totals.spent} tone="text-rose-600 dark:text-rose-400" />
        <Stat label="Balance" value={totals.balance} tone={totals.balance >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-rose-600 dark:text-rose-400"} />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-8">
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="font-medium">{editingId ? "Edit entry" : "Add entry"}</h2>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              {(["Expense", "Income"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t, category: t === "Income" ? "Salary" : f.category === "Salary" ? CATEGORIES[0] : f.category }))}
                  className={`rounded-md py-1.5 text-sm ${form.type === t ? "bg-white font-medium shadow-sm dark:bg-zinc-700" : "text-zinc-500"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Field label="Description">
              <input className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Swiggy dinner" required />
            </Field>
            <Field label="User">
              {users.length === 0 ? (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  No users yet.{" "}
                  <Link href="/settings" className="underline">
                    Add users in Settings
                  </Link>
                </p>
              ) : (
                <select className={input} value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} required>
                  <option value="" disabled>
                    Select user
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${CURRENCY})`}>
                <input className={input} type="number" inputMode="decimal" step="0.01" min="0.01" value={amountText} onChange={(e) => setAmountText(e.target.value)} required />
              </Field>
              <Field label="Date">
                <DatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category">
                <select className={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {[...new Set([...CATEGORIES, form.category])].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Paid via">
                <select className={input} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}>
                  {[...new Set([...PAYMENT_METHODS, form.paymentMethod])].filter(Boolean).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea className={input} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-1">
              <button disabled={saving || setupNeeded || users.length === 0} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">
                {saving ? "Saving…" : editingId ? "Save changes" : "Add expense"}
              </button>
              {editingId && (
                <button type="button" onClick={() => cancelEdit()} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
                  Cancel
                </button>
              )}
            </div>
          </form>

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 font-medium">Spending by category</h2>
            {totals.categories.length === 0 ? (
              <p className="text-sm text-zinc-500">No expenses yet.</p>
            ) : (
              <ul className="space-y-3">
                {totals.categories.map(([cat, amt]) => (
                  <li key={cat}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{cat}</span>
                      <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
                        {money.format(amt)} · {Math.round((amt / totals.spent) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(amt / totals.categories[0][1]) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mr-auto font-medium">
              Current period <span className="text-sm font-normal text-zinc-500">· {periodExpenses.length} entries</span>
            </h2>
            <input className={`${input} w-40`} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className={`${input} w-40`} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option>All</option>
              <option>Expense</option>
              <option>Income</option>
              {usedCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <p className="p-8 text-center text-sm text-zinc-500">Loading expenses…</p>
          ) : visible.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">
              {periodExpenses.length === 0 ? "No entries since the last income yet." : "No entries match your filter."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Paid via</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {visible.map((e) => (
                    <tr key={e.id} className={editingId === e.id ? "bg-emerald-50 dark:bg-emerald-950/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"}>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">{e.date}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-700 dark:text-zinc-300">{e.user || "—"}</td>
                      <td className="px-4 py-3">
                        <div>{e.description}</div>
                        {e.notes && <div className="text-xs text-zinc-500">{e.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{e.category}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{e.paymentMethod}</td>
                      <td className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${e.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : ""}`}>
                        {e.type === "Income" ? "+" : "−"}
                        {money.format(e.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {confirmDelete === e.id ? (
                          <span className="inline-flex gap-2">
                            <button onClick={() => remove(e.id)} className="text-xs font-medium text-rose-600">Confirm</button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-zinc-500">Keep</button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-3">
                            <button onClick={() => startEdit(e)} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">Edit</button>
                            <button onClick={() => setConfirmDelete(e.id)} className="text-xs text-zinc-500 hover:text-rose-600">Delete</button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="text-sm text-zinc-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{money.format(value)}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function SetupNotice({ message }: { message: string | null }) {
  return (
    <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <p className="mb-2 font-medium">Connect Supabase</p>
      <p className="mb-3">{message}</p>
      <p>
        Copy <code>.env.example</code> to <code>.env.local</code>, fill in your Supabase keys, run the migration SQL, and restart{" "}
        <code>npm run dev</code>. Full steps are in the README.
      </p>
    </div>
  );
}
