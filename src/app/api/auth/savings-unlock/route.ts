import { NextRequest } from "next/server";
import { requireSession } from "@/lib/auth";
import { createSavingsUnlockToken } from "@/lib/session";
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
  const session = await requireSession();
  if (session instanceof Response) return session;

  try {
    const body = await req.json();
    const password = String(body.password ?? "");
    if (!password) throw new Error("Password is required");

    const user = await verifyUserPassword(session.userId, password);
    if (!user) {
      return Response.json({ error: "Invalid password" }, { status: 401 });
    }

    return Response.json({ token: createSavingsUnlockToken(session.userId) });
  } catch (err) {
    return fail(err);
  }
}
