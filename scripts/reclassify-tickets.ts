import pg from "pg";

import {
  CLASSIFICATION_RULES,
  normalizeClassification,
} from "../lib/agent/classification.ts";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // fichier absent
  }
}

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://casamove@127.0.0.1:5544/casamove";

const BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-bolt-e4b";
const API_KEY = process.env.NVIDIA_API_KEY;

const SLA_HOURS = { P1: 4, P2: 24, P3: 72 };

type TicketRow = {
  number: string;
  user_query: string;
  theme: string;
  priority: "P1" | "P2" | "P3";
  sentiment: "negative" | "neutral" | "positive";
  created_at: Date;
};

async function classifyWithModel(query: string) {
  if (!API_KEY) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_tokens: 160,
        messages: [
          {
            role: "system",
            content: `Tu classes une réclamation du service client CasaMove.
${CLASSIFICATION_RULES}
Réponds uniquement par un JSON valide :
{"theme":"ponctualité|information|propreté|sécurité|accessibilité|abonnement","priority":"P1|P2|P3","sentiment":"negative|neutral|positive"}`,
          },
          { role: "user", content: query },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;

    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(
    "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sentiment text NOT NULL DEFAULT 'neutral'"
  );

  const { rows } = await client.query<TicketRow>(
    `SELECT number, user_query, theme, priority, sentiment, created_at
     FROM tickets
     ORDER BY created_at ASC`
  );

  console.log(`${rows.length} dossiers à reclasser`);

  let updated = 0;

  for (const ticket of rows) {
    const model = await classifyWithModel(ticket.user_query);
    const classification = normalizeClassification(
      model ?? {},
      ticket.user_query
    );

    const changed =
      classification.theme !== ticket.theme ||
      classification.priority !== ticket.priority ||
      classification.sentiment !== ticket.sentiment;

    if (!changed) continue;

    await client.query(
      `UPDATE tickets
       SET theme = $2,
           priority = $3,
           sentiment = $4,
           sla_deadline = created_at + ($5::int * interval '1 hour')
       WHERE number = $1`,
      [
        ticket.number,
        classification.theme,
        classification.priority,
        classification.sentiment,
        SLA_HOURS[classification.priority],
      ]
    );

    await client.query(
      `INSERT INTO ticket_events
         (ticket_number, event, actor_email, detail)
       VALUES ($1, 'reclassified', 'système', $2)`,
      [
        ticket.number,
        `${classification.theme} · ${classification.priority} · ${classification.sentiment}`,
      ]
    );

    updated += 1;
    console.log(
      `${ticket.number} -> ${classification.theme} / ${classification.priority} / ${classification.sentiment}`
    );
  }

  console.log(`${updated} dossier(s) reclassé(s).`);
} finally {
  await client.end();
}
