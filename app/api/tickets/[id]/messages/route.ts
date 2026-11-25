import type { NextRequest } from "next/server";

import {
  addTicketMessage,
  getTicket,
  listTicketMessages,
  recordTicketEvent,
} from "@/lib/agent/tickets";
import type { Ticket } from "@/lib/agent/types";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function canRead(
  ticket: Ticket,
  user: Awaited<ReturnType<typeof getCurrentUser>>,
  sessionId: string | null
) {
  if (user && isAdmin(user)) return true;
  if (user && ticket.userId === user.id) return true;
  if (sessionId && ticket.threadId.startsWith(`${sessionId}:`)) return true;
  return false;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  const user = await getCurrentUser();
  const ticket = await getTicket(id);

  if (!ticket || !canRead(ticket, user, sessionId)) {
    return Response.json({ error: "ticket_not_found" }, { status: 404 });
  }

  return Response.json({
    ticket,
    messages: await listTicketMessages(id),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentUser();

  if (!user || !isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const ticket = await getTicket(id);
  if (!ticket) {
    return Response.json({ error: "ticket_not_found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";

  if (text.length < 1 || text.length > 2_000) {
    return Response.json({ error: "invalid_message" }, { status: 400 });
  }

  await addTicketMessage({
    ticketNumber: id,
    role: "agent",
    body: text,
    authorEmail: user.email,
  });

  await recordTicketEvent({
    ticketNumber: id,
    event: "agent_replied",
    actorId: user.id,
    actorEmail: user.email,
    detail: text.slice(0, 160),
  });

  return Response.json({
    ticket: await getTicket(id),
    messages: await listTicketMessages(id),
  });
}
