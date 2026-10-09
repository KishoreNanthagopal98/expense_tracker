"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import DatePicker from "@/components/DatePicker";
import {
  clearSavingsUnlockToken,
  savingsUnlockHeaders,
} from "@/lib/savings-unlock-client";
import { AppUser, Saving, SavingInput } from "@/lib/types";

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY || "INR";
const money = new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: 2 });

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900";

function blankForm(userId = ""): SavingInput {
  return {
    date: new Date().toISOString().slice(0, 10),
    description: "",
    amount: 0,
    type: "Deposit",
    userId,
    notes: "",
  };
}

export default function SavingsPage() {
  const [savings, setSavings] = useState<Saving[]>([]);
  const [balance, setBalance] = useState(0);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SavingInput>(() => blankForm());
  const [amountText, setAmountText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [savRes, usersRes] = await Promise.all([
        fetch("/api/savings", { cache: "no-store", headers: savingsUnlockHeaders() }),
        fetch("/api/users", { cache: "no-store" }),
      ]);
      if (savRes.status === 403) {
        const savData = await savRes.json();
        if (savData.savingsLocked) {
          clearSavingsUnlockToken();
          window.location.reload();
          return;
        }
      }
      const savData = await savRes.json();
      const usersData = await usersRes.json();
      if (!savRes.ok) throw new Error(savData.error);
      if (!usersRes.ok) throw new Error(usersData.error);
      setSavings(savData.savings ?? []);
      setBalance(savData.balance ?? 0);
      setUsers(usersData.users ?? []);
    } catch (e) {
      setSavings([]);
      setBalance(0);
      setError(e instanceof Error ? e.message : "Failed to load savings");
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

  function startEdit(entry: Saving) {
    setEditingId(entry.id);
    setForm({
      date: entry.date,
      description: entry.description,
      amount: entry.amount,
      type: entry.type,
      userId: entry.userId,
      notes: entry.notes,
    });
    setAmountText(String(entry.amount));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, amount: Number(amountText) };
      const res = await fetch("/api/savings", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", ...savingsUnlockHeaders() },
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
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
    const res = await fetch(`/api/savings?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: savingsUnlockHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to delete");
      return;
    }
    await load();
  }

  const totals = useMemo(() => {
    let deposited = 0;
    let withdrawn = 0;
    for (const s of savings) {
      if (s.type === "Withdrawal") withdrawn += s.amount;
      else deposited += s.amount;
    }
    return { deposited, withdrawn };
  }, [savings]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Savings</h1>
          <p className="text-sm text-zinc-500">Track deposits and withdrawals</p>
        </div>
        <button
          onClick={load}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          ↻ Reload
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950 sm:col-span-1">
          <div className="text-sm text-emerald-700 dark:text-emerald-300">Total savings now</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-emerald-800 dark:text-emerald-200">
            {money.format(balance)}
          </div>
        </div>
        <Stat label="Total deposited" value={totals.deposited} tone="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Total withdrawn" value={totals.withdrawn} tone="text-rose-600 dark:text-rose-400" />
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_1fr]">
        <aside>
          <form onSubmit={submit} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="font-medium">{editingId ? "Edit entry" : "Add saving"}</h2>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              {(["Deposit", "Withdrawal"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`rounded-md py-1.5 text-sm ${form.type === t ? "bg-white font-medium shadow-sm dark:bg-zinc-700" : "text-zinc-500"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Field label="Description">
              <input
                className={input}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. October planned saving"
                required
              />
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
                <select
                  className={input}
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                  required
                >
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
                <input
                  className={input}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  required
                />
              </Field>
              <Field label="Date">
                <DatePicker value={form.date} onChange={(date) => setForm({ ...form, date })} required />
              </Field>
            </div>
            <Field label="Notes (optional)">
              <textarea className={input} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <div className="flex gap-2 pt-1">
              <button
                disabled={saving || users.length === 0}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : editingId ? "Save changes" : "Add saving"}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>

        <section className="min-w-0 rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="font-medium">
              All entries <span className="text-sm font-normal text-zinc-500">· {savings.length}</span>
            </h2>
          </div>
          {loading ? (
            <p className="p-8 text-center text-sm text-zinc-500">Loading savings…</p>
          ) : savings.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">No savings recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Description</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {savings.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-zinc-600 dark:text-zinc-400">{s.date}</td>
                      <td className="whitespace-nowrap px-4 py-3">{s.user || "—"}</td>
                      <td className="px-4 py-3">
                        <div>{s.description}</div>
                        {s.notes && <div className="text-xs text-zinc-500">{s.notes}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${s.type === "Deposit" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"}`}
                        >
                          {s.type}
                        </span>
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums ${s.type === "Deposit" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                      >
                        {s.type === "Deposit" ? "+" : "−"}
                        {money.format(s.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {confirmDelete === s.id ? (
                          <span className="inline-flex gap-2">
                            <button onClick={() => remove(s.id)} className="text-xs font-medium text-rose-600">
                              Confirm
                            </button>
                            <button onClick={() => setConfirmDelete(null)} className="text-xs text-zinc-500">
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-3">
                            <button onClick={() => startEdit(s)} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                              Edit
                            </button>
                            <button onClick={() => setConfirmDelete(s.id)} className="text-xs text-zinc-500 hover:text-rose-600">
                              Delete
                            </button>
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
