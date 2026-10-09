"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  clearSavingsUnlockToken,
  readSavingsUnlockToken,
  SAVINGS_UNLOCK_STORAGE_KEY,
  writeSavingsUnlockToken,
} from "@/lib/savings-unlock-client";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900";

type Props = {
  children: React.ReactNode;
};

export default function SavingsPasswordGate({ children }: Props) {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(readSavingsUnlockToken());
    setReady(true);

    return () => {
      clearSavingsUnlockToken();
    };
  }, []);

  useEffect(() => {
    function onStorage(ev: StorageEvent) {
      if (ev.key === SAVINGS_UNLOCK_STORAGE_KEY && !ev.newValue) {
        setToken(null);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/savings-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid password");
      writeSavingsUnlockToken(data.token);
      setToken(data.token);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid password");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="p-8 text-center text-sm text-zinc-500">Loading…</div>;
  }

  if (!token) {
    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="savings-auth-title"
          className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
        >
          <h2 id="savings-auth-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Unlock savings
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Enter your password to view savings{user ? ` (${user.userName})` : ""}. You will be asked again when you
            leave this page or close the tab.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="savings-password"
                className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="savings-password"
                type="password"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus
                disabled={submitting}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? "Checking…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
