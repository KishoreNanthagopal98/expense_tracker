import { listMonths, SetupError } from "@/lib/expenses";

export async function GET() {
  try {
    return Response.json({ months: await listMonths() });
  } catch (err) {
    if (err instanceof SetupError) {
      return Response.json({ error: err.message, setup: true }, { status: 503 });
    }
    console.error(err);
    return Response.json({ error: err instanceof Error ? err.message : "Unexpected error" }, { status: 500 });
  }
}
