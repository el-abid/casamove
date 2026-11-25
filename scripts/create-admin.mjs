import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // fichier absent, on utilise la valeur par défaut
  }
}

const [email, password, fullName = "Administrateur CasaMove", phone = ""] =
  process.argv.slice(2);

if (!email || !password || password.length < 8) {
  console.error(
    "Usage: node scripts/create-admin.mjs <email> <motdepasse> [nom] [telephone]"
  );
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://casamove@127.0.0.1:5544/casamove";

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64, {
  N: 16_384,
  r: 8,
  p: 1,
}).toString("hex");
const stored = `scrypt$16384$8$1$${salt}$${hash}`;

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            serial PRIMARY KEY,
      email         text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      full_name     text NOT NULL,
      phone         text,
      role          text NOT NULL DEFAULT 'user',
      locale        text NOT NULL DEFAULT 'fr',
      created_at    timestamptz NOT NULL DEFAULT now()
    );
  `);

  const { rows } = await client.query(
    `INSERT INTO users (email, password_hash, full_name, phone, role, locale)
     VALUES ($1, $2, $3, $4, 'admin', 'fr')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone,
           role = 'admin'
     RETURNING id, email, role`,
    [email.toLowerCase(), stored, fullName, phone || null]
  );

  console.log(`Admin prêt : ${rows[0].email} (id ${rows[0].id})`);
} finally {
  await client.end();
}
