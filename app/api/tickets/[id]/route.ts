import {
  getTicket,
  listDecisions,
  listTicketEvents,
  listTicketMessages,
  listTicketsByUser,
} from "@/lib/agent/tickets";
import {
  describeSubscription,
  getSubscription,
} from "@/lib/agent/subscriptions";
import type { CustomerInfo } from "@/lib/agent/types";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { getUserById } from "@/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const ticket = await getTicket(id);
  const admin = isAdmin(user);

  if (!ticket || (!admin && ticket.userId !== user.id)) {
    return Response.json({ error: "ticket_not_found" }, { status: 404 });
  }

  if (!admin) {
    return Response.json({ ticket });
  }

  let customer: CustomerInfo | null = null;

  if (ticket.userId) {
    const owner = await getUserById(ticket.userId);

    if (owner) {
      const subscription = await getSubscription(owner.id);
      const info = subscription
        ? describeSubscription(subscription, "fr")
        : null;
      const tickets = await listTicketsByUser(owner.id);

      customer = {
        id: owner.id,
        fullName: owner.fullName,
        email: owner.email,
        phone: owner.phone,
        subscription: info
          ? {
              planLabel: info.planLabel,
              statusLabel: info.statusLabel,
              endsAt: info.endsAt,
              daysLeft: info.daysLeft,
              price: info.price,
            }
          : null,
        ticketCount: tickets.length,
        recentTickets: tickets.slice(0, 3).map((item) => ({
          number: item.number,
          status: item.status,
          theme: item.theme,
          createdAt: item.createdAt,
        })),
      };
    }
  }

  return Response.json({
    ticket,
    decisions: await listDecisions(id),
    events: await listTicketEvents(id),
    messages: await listTicketMessages(id),
    customer,
  });
}
