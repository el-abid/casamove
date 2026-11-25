import type { NextRequest } from "next/server";

import {
  assignTicket,
  getTicket,
  listTicketEvents,
  recordTicketEvent,
} from "@/lib/agent/tickets";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentUser();

  if (!user || !isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const raw = body?.assigneeId;
  const assigneeId =
    raw === null || raw === "" || raw === undefined ? null : Number(raw);

  if (
    assigneeId !== null &&
    (!Number.isInteger(assigneeId) || assigneeId <= 0)
  ) {
    return Response.json({ error: "invalid_assignee" }, { status: 400 });
  }

  const ticket = await getTicket(id);
  if (!ticket) {
    return Response.json({ error: "ticket_not_found" }, { status: 404 });
  }

  let assignee = null;
  if (assigneeId !== null) {
    assignee = await getUserById(assigneeId);
    if (!assignee || assignee.role !== "admin") {
      return Response.json({ error: "invalid_assignee" }, { status: 400 });
    }
  }

  const updated = await assignTicket(id, assigneeId);

  await recordTicketEvent({
    ticketNumber: id,
    event: assignee ? "assigned" : "unassigned",
    actorId: user.id,
    actorEmail: user.email,
    detail: assignee
      ? `Assigné à ${assignee.fullName} (${assignee.email})`
      : "Dossier désassigné",
  });

  return Response.json({
    ticket: updated,
    events: await listTicketEvents(id),
  });
}
