import type { Locale } from "@/content/dictionary";
import { ensureDb, pool } from "@/lib/db";
import { lineOfQuery } from "./classification";
import type {
  Priority,
  Ticket,
  TicketDecision,
  TicketEvent,
  TicketMessage,
  TicketSentiment,
  TicketStatus,
} from "./types";

export const SLA_HOURS: Record<Priority, number> = {
  P1: 4,
  P2: 24,
  P3: 72,
};

type TicketRow = {
  number: string;
  status: TicketStatus;
  priority: Priority;
  theme: string;
  sentiment: TicketSentiment;
  line: string | null;
  locale: Locale;
  thread_id: string;
  user_id: number | null;
  assigned_to: number | null;
  user_query: string;
  draft: string;
  created_at: Date;
  sla_deadline: Date;
  resolved_at: Date | null;
  csat_score: number | null;
  last_message_role?: "user" | "agent" | "system" | null;
  last_message_at?: Date | null;
};

function mapRow(row: TicketRow): Ticket {
  return {
    number: row.number,
    status: row.status,
    priority: row.priority,
    theme: row.theme,
    sentiment: row.sentiment,
    line: row.line ?? null,
    locale: row.locale,
    threadId: row.thread_id,
    userId: row.user_id ?? null,
    assignedTo: row.assigned_to ?? null,
    query: row.user_query,
    draft: row.draft,
    createdAt: row.created_at.toISOString(),
    slaDeadline: row.sla_deadline.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
    csatScore: row.csat_score ?? null,
    lastMessageRole: row.last_message_role ?? "system",
    lastMessageAt: row.last_message_at
      ? row.last_message_at.toISOString()
      : row.created_at.toISOString(),
  };
}

export async function createTicket(input: {
  priority: Priority;
  theme: string;
  sentiment: TicketSentiment;
  line?: string | null;
  locale: Locale;
  threadId: string;
  query: string;
  draft: string;
  userId?: number | null;
}): Promise<Ticket> {
  await ensureDb();

  if (input.userId) {
    const { rows: recent } = await pool.query<TicketRow>(
      `SELECT * FROM tickets
       WHERE user_id = $1
         AND status = 'pending'
         AND created_at > now() - interval '10 minutes'
         AND lower(trim(user_query)) = lower(trim($2))
       ORDER BY created_at DESC
       LIMIT 1`,
      [input.userId, input.query]
    );

    if (recent[0]) return mapRow(recent[0]);
  }

  const line = input.line ?? lineOfQuery(input.query);

  const { rows } = await pool.query<TicketRow>(
    `INSERT INTO tickets
       (number, priority, theme, sentiment, line, locale, thread_id, user_query, draft, sla_deadline, user_id)
     VALUES (
       format('CM-%s-%s', $1::int, lpad(nextval('ticket_number_seq')::text, 6, '0')),
       $2, $3, $4, $5, $6, $7, $8, $9,
       now() + ($10::int * interval '1 hour'),
       $11
     )
     RETURNING *`,
    [
      new Date().getFullYear(),
      input.priority,
      input.theme,
      input.sentiment,
      line,
      input.locale,
      input.threadId,
      input.query,
      input.draft,
      SLA_HOURS[input.priority],
      input.userId ?? null,
    ]
  );

  const ticket = mapRow(rows[0]);
  await recordTicketEvent({
    ticketNumber: ticket.number,
    event: "created",
    detail: `Priorité ${ticket.priority} · ${ticket.theme}`,
  });
  await addTicketMessage({
    ticketNumber: ticket.number,
    role: "user",
    body: input.query,
  });
  await addTicketMessage({
    ticketNumber: ticket.number,
    role: "system",
    body: `Réclamation enregistrée. Priorité ${ticket.priority}, thème ${ticket.theme}.`,
  });

  return ticket;
}

export async function assignTicket(
  number: string,
  assigneeId: number | null
): Promise<Ticket | undefined> {
  await ensureDb();
  const { rows } = await pool.query<TicketRow>(
    `UPDATE tickets
     SET assigned_to = $2,
         assigned_at = CASE WHEN $2::int IS NULL THEN NULL ELSE now() END
     WHERE number = $1
     RETURNING *`,
    [number, assigneeId]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function getTicket(number: string): Promise<Ticket | undefined> {
  await ensureDb();
  const { rows } = await pool.query<TicketRow>(
    `SELECT t.*,
       (SELECT m.role FROM ticket_messages m
        WHERE m.ticket_number = t.number
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
       (SELECT m.created_at FROM ticket_messages m
        WHERE m.ticket_number = t.number
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_at
     FROM tickets t
     WHERE t.number = $1`,
    [number]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function listTickets(): Promise<Ticket[]> {
  await ensureDb();
  const { rows } = await pool.query<TicketRow>(
    `SELECT t.*,
       (SELECT m.role FROM ticket_messages m
        WHERE m.ticket_number = t.number
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
       (SELECT m.created_at FROM ticket_messages m
        WHERE m.ticket_number = t.number
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_at
     FROM tickets t
     ORDER BY (t.status = 'pending') DESC, t.created_at DESC`
  );
  return rows.map(mapRow);
}

export async function listTicketsByUser(userId: number): Promise<Ticket[]> {
  await ensureDb();
  const { rows } = await pool.query<TicketRow>(
    `SELECT t.*,
       (SELECT m.role FROM ticket_messages m
        WHERE m.ticket_number = t.number
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_role,
       (SELECT m.created_at FROM ticket_messages m
        WHERE m.ticket_number = t.number
        ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_message_at
     FROM tickets t
     WHERE t.user_id = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows.map(mapRow);
}

export async function setTicketStatus(
  number: string,
  status: TicketStatus
): Promise<Ticket | undefined> {
  await ensureDb();
  const { rows } = await pool.query<TicketRow>(
    `UPDATE tickets SET status = $2 WHERE number = $1 RETURNING *`,
    [number, status]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function setTicketDraft(
  number: string,
  draft: string
): Promise<Ticket | undefined> {
  await ensureDb();
  const { rows } = await pool.query<TicketRow>(
    `UPDATE tickets SET draft = $2 WHERE number = $1 RETURNING *`,
    [number, draft]
  );
  return rows[0] ? mapRow(rows[0]) : undefined;
}

export function formatDeadline(iso: string, locale: Locale): string {
  const tag = locale === "ar" ? "ar-MA" : locale === "en" ? "en-GB" : "fr-FR";
  return new Intl.DateTimeFormat(tag, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type DecisionRow = {
  id: number;
  ticket_number: string;
  action: "approve" | "reject";
  comment: string;
  admin_id: number | null;
  admin_email: string;
  created_at: Date;
};

function mapDecision(row: DecisionRow): TicketDecision {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    action: row.action,
    comment: row.comment,
    adminId: row.admin_id,
    adminEmail: row.admin_email,
    createdAt: row.created_at.toISOString(),
  };
}

export async function recordDecision(input: {
  ticketNumber: string;
  action: "approve" | "reject";
  comment: string;
  adminId: number;
  adminEmail: string;
}): Promise<TicketDecision> {
  await ensureDb();

  const { rows } = await pool.query<DecisionRow>(
    `INSERT INTO ticket_decisions
       (ticket_number, action, comment, admin_id, admin_email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.ticketNumber,
      input.action,
      input.comment,
      input.adminId,
      input.adminEmail,
    ]
  );

  return mapDecision(rows[0]);
}

export async function listDecisions(
  ticketNumber: string
): Promise<TicketDecision[]> {
  await ensureDb();

  const { rows } = await pool.query<DecisionRow>(
    `SELECT * FROM ticket_decisions
     WHERE ticket_number = $1
     ORDER BY created_at ASC`,
    [ticketNumber]
  );

  return rows.map(mapDecision);
}

type EventRow = {
  id: number;
  ticket_number: string;
  event: string;
  actor_id: number | null;
  actor_email: string;
  detail: string;
  created_at: Date;
};

function mapEvent(row: EventRow): TicketEvent {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    event: row.event,
    actorId: row.actor_id ?? null,
    actorEmail: row.actor_email,
    detail: row.detail,
    createdAt: row.created_at.toISOString(),
  };
}

export async function recordTicketEvent(input: {
  ticketNumber: string;
  event: string;
  actorId?: number | null;
  actorEmail?: string;
  detail?: string;
}): Promise<TicketEvent> {
  await ensureDb();

  const { rows } = await pool.query<EventRow>(
    `INSERT INTO ticket_events
       (ticket_number, event, actor_id, actor_email, detail)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      input.ticketNumber,
      input.event,
      input.actorId ?? null,
      input.actorEmail ?? "système",
      input.detail ?? "",
    ]
  );

  return mapEvent(rows[0]);
}

export async function listTicketEvents(
  ticketNumber: string
): Promise<TicketEvent[]> {
  await ensureDb();

  const { rows } = await pool.query<EventRow>(
    `SELECT * FROM ticket_events
     WHERE ticket_number = $1
     ORDER BY created_at ASC`,
    [ticketNumber]
  );

  return rows.map(mapEvent);
}

type MessageRow = {
  id: number;
  ticket_number: string;
  role: "user" | "agent" | "system";
  body: string;
  author_email: string;
  created_at: Date;
};

function mapMessage(row: MessageRow): TicketMessage {
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    role: row.role,
    body: row.body,
    authorEmail: row.author_email,
    createdAt: row.created_at.toISOString(),
  };
}

export async function addTicketMessage(input: {
  ticketNumber: string;
  role: "user" | "agent" | "system";
  body: string;
  authorEmail?: string;
}): Promise<TicketMessage> {
  await ensureDb();

  const { rows } = await pool.query<MessageRow>(
    `INSERT INTO ticket_messages
       (ticket_number, role, body, author_email)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.ticketNumber, input.role, input.body, input.authorEmail ?? ""]
  );

  return mapMessage(rows[0]);
}

export async function listTicketMessages(
  ticketNumber: string
): Promise<TicketMessage[]> {
  await ensureDb();

  const { rows } = await pool.query<MessageRow>(
    `SELECT * FROM ticket_messages
     WHERE ticket_number = $1
     ORDER BY created_at ASC, id ASC`,
    [ticketNumber]
  );

  return rows.map(mapMessage);
}

export async function resolveTicket(
  ticketNumber: string
): Promise<Ticket | undefined> {
  await ensureDb();

  const { rows } = await pool.query<TicketRow>(
    `UPDATE tickets
     SET status = 'resolved', resolved_at = now()
     WHERE number = $1
     RETURNING *`,
    [ticketNumber]
  );

  return rows[0] ? mapRow(rows[0]) : undefined;
}

export async function setTicketCsat(
  ticketNumber: string,
  score: number
): Promise<Ticket | undefined> {
  await ensureDb();

  const { rows } = await pool.query<TicketRow>(
    `UPDATE tickets
     SET csat_score = $2, csat_at = now()
     WHERE number = $1
     RETURNING *`,
    [ticketNumber, score]
  );

  return rows[0] ? mapRow(rows[0]) : undefined;
}
