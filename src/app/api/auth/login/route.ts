import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/auth";
import { verifyUserPassword, SetupError } from "@/lib/users";

function fail(err: unknown) {
  if (err instanceof SetupError) {
    return Response.json({ error: err.message, setup: true }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(err);
  return Response.json({ error: message }, { status: 500 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = String(body.userId ?? "").trim();
    const password = String(body.password ?? "");

    if (!userId) throw new Error("User is required");
    if (!password) throw new Error("Password is required");

    const user = await verifyUserPassword(userId, password);
    if (!user) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }

    const token = createSessionToken({ userId: user.id, userName: user.name });
    const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, token, sessionCookieOptions(expires));

    return Response.json({ user: { id: user.id, name: user.name } });
  } catch (err) {
    return fail(err);
  }
}
