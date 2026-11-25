import { listTickets } from "@/lib/agent/tickets";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  return Response.json({ tickets: await listTickets() });
}
