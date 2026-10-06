import { getSessionFromCookies } from "@/lib/auth";

export async function GET() {
  const user = await getSessionFromCookies();
  if (!user) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, user });
}
