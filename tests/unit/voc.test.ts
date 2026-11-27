import { describe, expect, it } from "vitest";
import { aggregateVoc, summaryOf } from "@/lib/agent/voc";
import type { Ticket } from "@/lib/agent/types";

const base: Omit<
  Ticket,
  "number" | "theme" | "status" | "query" | "sentiment" | "line"
> = {
  priority: "P3",
  provider: "tram",
  locale: "fr",
  threadId: "t",
  userId: null,
  assignedTo: null,
  draft: "d",
  createdAt: new Date().toISOString(),
  slaDeadline: new Date(Date.now() + 3600_000).toISOString(),
  resolvedAt: null,
  csatScore: null,
  lastMessageRole: null,
  lastMessageAt: null,
};

function ticket(
  number: string,
  theme: string,
  status: Ticket["status"],
  query: string,
  sentiment: Ticket["sentiment"] = "neutral",
  line: string | null = null
): Ticket {
  return { ...base, number, theme, status, query, sentiment, line };
}

describe("agrégats VoC", () => {
  it("compte les thèmes, priorités, statuts et sentiments", () => {
    const result = aggregateVoc([
      ticket(
        "CM-1",
        "ponctualité",
        "in_progress",
        "retard de 20 minutes",
        "negative"
      ),
      ticket("CM-2", "ponctualité", "in_progress", "retard répété", "negative"),
      ticket("CM-3", "propreté", "rejected", "rame sale", "negative"),
      ticket(
        "CM-4",
        "information",
        "pending",
        "demande d'information",
        "neutral"
      ),
    ]);

    expect(result.total).toBe(4);
    expect(result.pending).toBe(1);
    expect(result.topTheme).toBe("ponctualité");
    expect(result.byTheme[0]).toEqual({ key: "ponctualité", count: 2 });
    expect(result.negative).toBe(3);
    expect(result.neutral).toBe(1);
    expect(result.positive).toBe(0);
    expect(result.byPriority.find((item) => item.key === "P3")?.count).toBe(4);
    expect(result.verbatims).toHaveLength(3);
    expect(result.verbatims.every((item) => item.theme !== "information")).toBe(
      true
    );
  });

  it("compte les dossiers par ligne", () => {
    const result = aggregateVoc([
      ticket(
        "CM-30",
        "ponctualité",
        "pending",
        "retard",
        "negative",
        "ligne 2"
      ),
      ticket(
        "CM-31",
        "propreté",
        "pending",
        "rame sale",
        "negative",
        "ligne 2"
      ),
      ticket(
        "CM-32",
        "information",
        "pending",
        "question",
        "neutral",
        "ligne BW1"
      ),
      ticket("CM-33", "information", "pending", "question", "neutral", null),
    ]);

    expect(result.byLine[0]).toEqual({ key: "ligne 2", count: 2 });
    expect(result.byLine.find((item) => item.key === "ligne BW1")?.count).toBe(
      1
    );
    expect(
      result.byLine.find((item) => item.key === "non précisé")?.count
    ).toBe(1);
  });

  it("compare la période précédente", () => {
    const current = aggregateVoc(
      [
        ticket("CM-10", "sécurité", "pending", "insulte", "negative"),
        ticket("CM-11", "propreté", "in_progress", "rame sale", "negative"),
      ],
      { period: "7" }
    );
    const previous = summaryOf([
      ticket("CM-20", "information", "in_progress", "merci", "positive"),
    ]);

    const compared = aggregateVoc(
      [
        ticket("CM-10", "sécurité", "pending", "insulte", "negative"),
        ticket("CM-11", "propreté", "in_progress", "rame sale", "negative"),
      ],
      { period: "7", previous }
    );

    expect(current.period).toBe("7");
    expect(compared.previous?.total).toBe(1);
    expect(compared.previous?.topTheme).toBe("information");
    expect(compared.byDay).toHaveLength(7);
  });
});
