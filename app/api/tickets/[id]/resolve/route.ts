import {
  addTicketMessage,
  getTicket,
  listTicketMessages,
  recordTicketEvent,
  resolveTicket,
} from "@/lib/agent/tickets";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
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

  if (ticket.status === "resolved") {
    return Response.json(
      { error: "ticket_already_resolved", ticket },
      { status: 409 }
    );
  }

  if (ticket.status !== "in_progress") {
    return Response.json(
      { error: "ticket_not_in_progress", ticket },
      { status: 409 }
    );
  }

  await resolveTicket(id);

  await addTicketMessage({
    ticketNumber: id,
    role: "system",
    body: "Dossier clôturé avec l'accord de l'usager.",
    authorEmail: user.email,
  });

  await recordTicketEvent({
    ticketNumber: id,
    event: "resolved",
    actorId: user.id,
    actorEmail: user.email,
    detail: "Clôture confirmée avec l'usager",
  });

  return Response.json({
    ticket: await getTicket(id),
    messages: await listTicketMessages(id),
  });
}
