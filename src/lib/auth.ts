import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SessionUser,
  SAVINGS_UNLOCK_HEADER,
  verifySavingsUnlockToken,
  verifySessionToken,
} from "@/lib/session";

export {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_DAYS,
  sessionCookieOptions,
  type SessionUser,
} from "@/lib/session";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function getSessionFromCookies(): Promise<SessionUser | null> {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionUser | Response> {
  const user = await getSessionFromCookies();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export async function requireSavingsAccess(req: Request): Promise<SessionUser | Response> {
  const session = await requireSession();
  if (session instanceof Response) return session;

  const token = req.headers.get(SAVINGS_UNLOCK_HEADER);
  if (!verifySavingsUnlockToken(token, session.userId)) {
    return Response.json(
      { error: "Enter your password to view savings", savingsLocked: true },
      { status: 403 }
    );
  }
  return session;
}
