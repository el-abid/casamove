import type { NextRequest } from "next/server";

import { listTickets } from "@/lib/agent/tickets";
import { aggregateVoc, summaryOf, type VocPeriod } from "@/lib/agent/voc";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("period");
  const period: VocPeriod =
    raw === "7" || raw === "30" || raw === "all" ? raw : "all";
  const line = request.nextUrl.searchParams.get("line");

  const tickets = await listTickets();
  const days = period === "all" ? null : Number(period);
  const now = Date.now();

  const inLine = (ticket: (typeof tickets)[number]) =>
    !line || (ticket.line ?? "non précisé") === line;

  const current = (
    days
      ? tickets.filter(
          (ticket) => new Date(ticket.createdAt).getTime() >= now - days * DAY
        )
      : tickets
  ).filter(inLine);

  const previousTickets = days
    ? tickets
        .filter((ticket) => {
          const time = new Date(ticket.createdAt).getTime();
          return time >= now - 2 * days * DAY && time < now - days * DAY;
        })
        .filter(inLine)
    : null;

  return Response.json(
    aggregateVoc(current, {
      period,
      previous: previousTickets ? summaryOf(previousTickets) : null,
    })
  );
}
