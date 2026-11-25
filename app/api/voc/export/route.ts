import type { NextRequest } from "next/server";

import { listTickets } from "@/lib/agent/tickets";
import type { VocPeriod } from "@/lib/agent/voc";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { listAdmins } from "@/lib/auth/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function cell(value: string | number | null | undefined): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("period");
  const period: VocPeriod =
    raw === "7" || raw === "30" || raw === "all" ? raw : "all";
  const theme = request.nextUrl.searchParams.get("theme");
  const line = request.nextUrl.searchParams.get("line");
  const days = period === "all" ? null : Number(period);
  const now = Date.now();

  const tickets = (await listTickets()).filter((ticket) => {
    if (theme && ticket.theme !== theme) return false;
    if (line && (ticket.line ?? "non précisé") !== line) return false;
    if (!days) return true;
    return new Date(ticket.createdAt).getTime() >= now - days * DAY;
  });

  const admins = await listAdmins();
  const agentNames = new Map(admins.map((agent) => [agent.id, agent.fullName]));

  const lines = [
    [
      "Numéro",
      "Créé le",
      "Thème",
      "Ligne",
      "Priorité",
      "Sentiment",
      "Statut",
      "Langue",
      "Assigné à",
      "Demande",
    ]
      .map(cell)
      .join(";"),
    ...tickets.map((ticket) =>
      [
        ticket.number,
        ticket.createdAt,
        ticket.theme,
        ticket.line ?? "non précisé",
        ticket.priority,
        ticket.sentiment,
        ticket.status,
        ticket.locale,
        ticket.assignedTo
          ? (agentNames.get(ticket.assignedTo) ?? `Agent #${ticket.assignedTo}`)
          : "",
        ticket.query,
      ]
        .map(cell)
        .join(";")
    ),
  ];

  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casamove-voc-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
