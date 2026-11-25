import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_URL = "postgresql://casamove@127.0.0.1:5544/casamove_dev";

function readEnvFile(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return {};

  const values = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
  return values;
}

/**
 * Résout la base CasaMove.
 *
 * L'ordre évite volontairement `process.env.DATABASE_URL` : sur ce poste cette
 * variable globale appartient au projet dental_saas. Seul le préfixe
 * CASAMOVE_DATABASE_URL, fourni explicitement ou par .env.local, fait foi.
 */
export function resolveDatabaseUrl() {
  if (process.env.CASAMOVE_DATABASE_URL) return process.env.CASAMOVE_DATABASE_URL;

  const file = { ...readEnvFile(".env"), ...readEnvFile(".env.local") };

  return file.CASAMOVE_DATABASE_URL ?? file.DATABASE_URL ?? DEFAULT_URL;
}
