"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppUser } from "@/lib/types";
import type { SessionUser } from "@/lib/auth-client";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-900";

type Props = {
  onAuthenticated: (user: SessionUser) => void;
};

export default function AuthModal({ onAuthenticated }: Props) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingUsers(true);
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load users");
        if (!cancelled) {
          const list: AppUser[] = data.users ?? [];
          setUsers(list);
          if (list.length === 1) setUserId(list[0].id);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      onAuthenticated(data.user);
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 id="auth-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose your name and enter your password to continue.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="auth-user" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              User
            </label>
            <select
              id="auth-user"
              className={input}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              disabled={loadingUsers || submitting}
            >
              <option value="">{loadingUsers ? "Loading…" : "Select user"}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="auth-password" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              className={input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
            disabled={submitting || loadingUsers || !userId}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
