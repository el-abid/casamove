import type { Ticket } from "./types";

export type VocPeriod = "7" | "30" | "all";

export type VocSlice = { key: string; count: number };
export type VocDay = { date: string; count: number };

export type VocSummary = {
  total: number;
  pending: number;
  negative: number;
  neutral: number;
  positive: number;
  topTheme: string;
  negativeShare: number;
};

export type VocVerbatim = {
  theme: string;
  number: string;
  query: string;
  createdAt: string;
};

export type VocAggregate = {
  total: number;
  pending: number;
  negative: number;
  neutral: number;
  positive: number;
  topTheme: string;
  period: VocPeriod;
  previous: VocSummary | null;
  csatCount: number;
  csatAverage: number;
  csatDistribution: VocSlice[];
  byTheme: VocSlice[];
  byLine: VocSlice[];
  byPriority: VocSlice[];
  byStatus: VocSlice[];
  byDay: VocDay[];
  verbatims: VocVerbatim[];
  recent: {
    number: string;
    theme: string;
    priority: string;
    status: string;
    locale: string;
    createdAt: string;
    query: string;
  }[];
};

function countBy(
  tickets: Ticket[],
  pick: (ticket: Ticket) => string
): VocSlice[] {
  const map = new Map<string, number>();
  for (const ticket of tickets) {
    const key = pick(ticket);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count
  );
}

export function summaryOf(tickets: Ticket[]): VocSummary {
  const negative = tickets.filter(
    (ticket) => ticket.sentiment === "negative"
  ).length;
  const positive = tickets.filter(
    (ticket) => ticket.sentiment === "positive"
  ).length;
  const byTheme = countBy(tickets, (ticket) => ticket.theme);

  return {
    total: tickets.length,
    pending: tickets.filter((ticket) => ticket.status === "pending").length,
    negative,
    neutral: tickets.length - negative - positive,
    positive,
    topTheme: byTheme[0]?.key ?? "aucun",
    negativeShare: tickets.length
      ? Math.round((negative / tickets.length) * 100)
      : 0,
  };
}

export function aggregateVoc(
  tickets: Ticket[],
  options: { period?: VocPeriod; previous?: VocSummary | null } = {}
): VocAggregate {
  const period = options.period ?? "all";
  const summary = summaryOf(tickets);
  const byTheme = countBy(tickets, (ticket) => ticket.theme);
  const byLine = countBy(tickets, (ticket) => ticket.line ?? "non précisé");
  const byPriority = countBy(tickets, (ticket) => ticket.priority).sort(
    (a, b) => a.key.localeCompare(b.key)
  );
  const byStatus = countBy(tickets, (ticket) => ticket.status);
  const csatScores = tickets
    .map((ticket) => ticket.csatScore)
    .filter((score): score is number => typeof score === "number");
  const csatCount = csatScores.length;
  const csatAverage = csatCount
    ? Number(
        (csatScores.reduce((sum, score) => sum + score, 0) / csatCount).toFixed(
          1
        )
      )
    : 0;
  const csatDistribution = ["1", "2", "3", "4", "5"].map((score) => ({
    key: score,
    count: csatScores.filter((value) => value === Number(score)).length,
  }));

  const days = new Map<string, number>();
  for (let index = 6; index >= 0; index -= 1) {
    const day = new Date(Date.now() - index * 86_400_000)
      .toISOString()
      .slice(0, 10);
    days.set(day, 0);
  }
  for (const ticket of tickets) {
    const day = ticket.createdAt.slice(0, 10);
    if (days.has(day)) days.set(day, (days.get(day) ?? 0) + 1);
  }

  const verbatims = byTheme.flatMap(({ key }) =>
    tickets
      .filter(
        (ticket) => ticket.theme === key && ticket.sentiment === "negative"
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 3)
      .map((ticket) => ({
        theme: key,
        number: ticket.number,
        query: ticket.query,
        createdAt: ticket.createdAt,
      }))
  );

  return {
    ...summary,
    period,
    previous: options.previous ?? null,
    csatCount,
    csatAverage,
    csatDistribution,
    byTheme,
    byLine,
    byPriority,
    byStatus,
    byDay: Array.from(days, ([date, count]) => ({ date, count })),
    verbatims,
    recent: tickets
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 8)
      .map((ticket) => ({
        number: ticket.number,
        theme: ticket.theme,
        priority: ticket.priority,
        status: ticket.status,
        locale: ticket.locale,
        createdAt: ticket.createdAt,
        query: ticket.query,
      })),
  };
}
