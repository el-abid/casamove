import { Command } from "@langchain/langgraph";
import type { NextRequest } from "next/server";

import { getGraph } from "@/lib/agent/graph";
import {
  addTicketMessage,
  getTicket,
  listDecisions,
  listTicketEvents,
  listTicketMessages,
  recordDecision,
  recordTicketEvent,
  setTicketDraft,
} from "@/lib/agent/tickets";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const ticket = await getTicket(id);
  if (!ticket) {
    return Response.json({ error: "ticket_not_found" }, { status: 404 });
  }

  if (ticket.status !== "pending") {
    return Response.json(
      { error: "ticket_already_decided", ticket },
      { status: 409 }
    );
  }

  const action = body?.action === "reject" ? "reject" : "approve";
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  const draft = typeof body?.draft === "string" ? body.draft.trim() : "";

  if (draft) {
    await setTicketDraft(id, draft);
    if (draft !== ticket.draft) {
      await recordTicketEvent({
        ticketNumber: id,
        event: "draft_edited",
        actorId: user.id,
        actorEmail: user.email,
        detail: "Brouillon modifié avant décision",
      });
    }
  }

  try {
    const graph = await getGraph();
    await graph.invoke(new Command({ resume: { action, comment } }), {
      configurable: { thread_id: ticket.threadId },
    });
  } catch (error) {
    console.error("[tickets] resume failed", error);
    return Response.json({ error: "resume_failed" }, { status: 500 });
  }

  await recordDecision({
    ticketNumber: id,
    action,
    comment,
    adminId: user.id,
    adminEmail: user.email,
  });

  await recordTicketEvent({
    ticketNumber: id,
    event: action,
    actorId: user.id,
    actorEmail: user.email,
    detail: comment,
  });

  if (action === "approve") {
    const current = await getTicket(id);
    if (current) {
      await addTicketMessage({
        ticketNumber: id,
        role: "agent",
        body: current.draft,
        authorEmail: user.email,
      });
    }
  }

  return Response.json({
    ticket: await getTicket(id),
    decisions: await listDecisions(id),
    events: await listTicketEvents(id),
    messages: await listTicketMessages(id),
  });
}
