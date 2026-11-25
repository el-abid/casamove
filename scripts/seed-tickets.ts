import { readFileSync } from "node:fs";

import { ensureDb, pool } from "../lib/db.ts";

const sql = readFileSync(new URL("./seed.sql", import.meta.url), "utf8");

await ensureDb();
await pool.query(sql);
console.log("Jeu de démonstration chargé : 24 dossiers VoC.");

await pool.end();
