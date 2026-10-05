"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppUser, Expense } from "@/lib/types";

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "INR";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: 2 });

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900";

export default function AllExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [userId, setUserId] = useState("");
  const [users, setUsers] = useState<AppUser[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, usersRes] = await Promise.all([
        fetch("/api/expenses", { cache: "no-store" }),
        fetch("/api/users", { cache: "no-store" }),
      ]);
      const expData = await expRes.json();
      const usersData = await usersRes.json();
      if (!expRes.ok) throw new Error(expData.error);
      if (!usersRes.ok) throw new Error(usersData.error);
      setExpenses(expData.expenses);
      setUsers(usersData.users ?? []);
    } catch (e) {
      setExpenses([]);
      setUsers([]);
      setError(e instanceof Error ? e.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    setConfirmDelete(null);
    setDeletingId(id);
    setError(null);
    const prev = expenses;
    setExpenses((list) => list.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete");
      }
    } catch (e) {
      setExpenses(prev);
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses]);

  const hasFilters = Boolean(search || filter !== "All" || startDate || endDate || userId);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      if (filter !== "All" && e.category !== filter && e.type !== filter) return false;
      if (startDate && e.date < startDate) return false;
      if (endDate && e.date > endDate) return false;
      if (userId && e.userId !== userId) return false;
      if (q && !`${e.description} ${e.notes} ${e.category} ${e.date} ${e.user}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [expenses, filter, search, startDate, endDate, userId]);

  function clearFilters() {
    setSearch("");
    setFilter("All");
    setStartDate("");
    setEndDate("");
    setUserId("");
  }

  const totals = useMemo(() => {
    let income = 0;
    let spent = 0;
    for (const e of visible) {
      if (e.type === "Income") income += e.amount;
      else spent += e.amount;
    }
    return { income, spent, balance: income - spent };
  }, [visible]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">All Expenses</h1>
          <p className="text-sm text-zinc-500">Every entry across all months</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          title="Reload"
        >
          ↻ Reload
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Income" value={totals.income} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Expenses" value={totals.spent} tone="text-rose-600 dark:text-rose-400" />
        <Stat label="Balance" value={totals.balance} tone={totals.balance >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-rose-600 dark:text-rose-400"} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="space-y-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="mr-auto font-medium">
              {visible.length} {visible.length === 1 ? "entry" : "entries"}
              {hasFilters ? ` (filtered from ${expenses.length})` : ""}
            </h2>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Start date</span>
              <input className={input} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">End date</span>
              <input className={input} type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">By whom</span>
              <select className={input} value={userId} onChange={(e) => setUserId(e.target.value)}>
                <option value="">All users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Category / type</span>
              <select className={input} value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option>All</option>
                <option>Expense</option>
                <option>Income</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2 xl:col-span-2">
              <span className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Search</span>
              <input className={input} placeholder="Description, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-zinc-500">Loading expenses…</p>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            {expenses.length === 0 ? "No expenses recorded yet." : "No entries match your filter."}
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
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {visible.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
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
                    <td
                      className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${e.type === "Income" ? "text-emerald-600 dark:text-emerald-400" : ""}`}
                    >
                      {e.type === "Income" ? "+" : "−"}
                      {money.format(e.amount)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {confirmDelete === e.id ? (
                        <span className="inline-flex gap-2">
                          <button
                            onClick={() => remove(e.id)}
                            disabled={deletingId === e.id}
                            className="text-xs font-medium text-rose-600 disabled:opacity-50"
                          >
                            {deletingId === e.id ? "Deleting…" : "Confirm"}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="text-xs text-zinc-500">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(e.id)}
                          className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950"
                        >
                          Delete
                        </button>
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
