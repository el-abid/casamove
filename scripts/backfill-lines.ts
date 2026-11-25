import pg from "pg";

import { lineOfQuery } from "../lib/agent/classification.ts";
import { resolveDatabaseUrl } from "./db-url.mjs";

const connectionString = resolveDatabaseUrl();

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS line text");

  const { rows } = await client.query<{
    number: string;
    user_query: string;
  }>(
    `SELECT number, user_query
     FROM tickets
     WHERE line IS NULL
     ORDER BY created_at ASC`
  );

  let updated = 0;

  for (const ticket of rows) {
    const line = lineOfQuery(ticket.user_query);
    if (!line) continue;

    await client.query(`UPDATE tickets SET line = $2 WHERE number = $1`, [
      ticket.number,
      line,
    ]);
    updated += 1;
    console.log(`${ticket.number} -> ${line}`);
  }

  console.log(`${updated} dossier(s) rattaché(s) à une ligne.`);
} finally {
  await client.end();
}
