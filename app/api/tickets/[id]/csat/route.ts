import type { NextRequest } from "next/server";

import {
  getTicket,
  recordTicketEvent,
  setTicketCsat,
} from "@/lib/agent/tickets";
import type { Ticket } from "@/lib/agent/types";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canRespond(
  ticket: Ticket,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  sessionId: string | null
) {
  if (user && isAdmin(user)) return true;
  if (user && ticket.userId === user.id) return true;
  if (sessionId && ticket.threadId.startsWith(`${sessionId}:`)) return true;
  return false;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const score = Number(body?.score);
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.length > 4
      ? body.sessionId
      : null;

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return Response.json({ error: "invalid_score" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const ticket = await getTicket(id);

  if (!ticket || !canRespond(ticket, user, sessionId)) {
    return Response.json({ error: "ticket_not_found" }, { status: 404 });
  }

  if (ticket.status !== "resolved") {
    return Response.json(
      { error: "ticket_not_resolved", ticket },
      { status: 409 }
    );
  }

  if (ticket.csatScore !== null) {
    return Response.json(
      { error: "csat_already_submitted", ticket },
      { status: 409 }
    );
  }

  const updated = await setTicketCsat(id, score);

  await recordTicketEvent({
    ticketNumber: id,
    event: "csat",
    actorId: user?.id ?? null,
    actorEmail: user?.email ?? "usager",
    detail: `Satisfaction ${score}/5`,
  });

  return Response.json({ ticket: updated });
}
