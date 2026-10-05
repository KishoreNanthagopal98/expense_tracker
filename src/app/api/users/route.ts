import { NextRequest } from "next/server";
import { addUser, deleteUser, listUsers, SetupError } from "@/lib/users";

function fail(err: unknown) {
  if (err instanceof SetupError) {
    return Response.json({ error: err.message, setup: true }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error(err);
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    return Response.json({ users: await listUsers() });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    if (!name) throw new Error("Name is required");
    return Response.json({ user: await addUser(name) }, { status: 201 });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    if (!id) throw new Error("User id is required");
    await deleteUser(id);
    return Response.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
