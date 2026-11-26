import { pool } from "../lib/db.ts";
import { importNetwork } from "../lib/mobility/store.ts";

try {
  process.stdout.write(`${JSON.stringify(await importNetwork(), null, 2)}\n`);
} finally {
  await pool.end();
}
