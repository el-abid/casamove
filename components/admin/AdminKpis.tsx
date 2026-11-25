import type { Ticket } from "@/lib/agent/types";

export function AdminKpis({
  tickets,
  now,
}: {
  tickets: Ticket[];
  now: number;
}) {
  const pending = tickets.filter((ticket) => ticket.status === "pending");
  const active = tickets.filter(
    (ticket) => ticket.status === "pending" || ticket.status === "in_progress"
  );
  const atRisk = active.filter(
    (ticket) => new Date(ticket.slaDeadline).getTime() - now < 2 * 3_600_000
  ).length;
  const inProgress = tickets.filter(
    (ticket) => ticket.status === "in_progress"
  ).length;
  const resolved = tickets.filter(
    (ticket) => ticket.status === "resolved"
  ).length;

  return (
    <section className="adm-kpis">
      <div className="adm-kpi">
        <span>En attente</span>
        <b>{pending.length}</b>
        <small>dossier(s) à valider</small>
      </div>
      <div className="adm-kpi">
        <span>SLA à risque</span>
        <b className={atRisk > 0 ? "is-risk" : undefined}>{atRisk}</b>
        <small>échéance sous 2 h</small>
      </div>
      <div className="adm-kpi">
        <span>En cours</span>
        <b>{inProgress}</b>
        <small>discussion ouverte</small>
      </div>
      <div className="adm-kpi">
        <span>Clôturés</span>
        <b>{resolved}</b>
        <small>avec accord usager</small>
      </div>
    </section>
  );
}
