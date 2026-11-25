import { randomBytes, scryptSync } from "node:crypto";
import pg from "pg";

import { resolveDatabaseUrl } from "./db-url.mjs";

const connectionString = resolveDatabaseUrl();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
  }).toString("hex");
  return `scrypt$16384$8$1$${salt}$${hash}`;
}

const profiles = [
  {
    email: "usager@casamove.ma",
    password: "Usager2026!",
    name: "Usager Étudiant",
    phone: "0600000001",
    plan: "etudiant",
    startedDays: -25,
    endsDays: 5,
    autoRenew: false,
  },
  {
    email: "mensuel@casamove.ma",
    password: "Mensuel2026!",
    name: "Client Mensuel",
    phone: "0600000002",
    plan: "mensuel",
    startedDays: -10,
    endsDays: 20,
    autoRenew: true,
  },
  {
    email: "expire@casamove.ma",
    password: "Expire2026!",
    name: "Client Expiré",
    phone: "0600000003",
    plan: "hebdomadaire",
    startedDays: -8,
    endsDays: -1,
    autoRenew: false,
  },
];

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

    CREATE TABLE IF NOT EXISTS subscriptions (
      id         serial PRIMARY KEY,
      user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan       text NOT NULL,
      status     text NOT NULL DEFAULT 'active',
      started_at timestamptz NOT NULL DEFAULT now(),
      ends_at    timestamptz NOT NULL,
      auto_renew boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  for (const profile of profiles) {
    const { rows } = await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, role, locale)
       VALUES ($1, $2, $3, $4, 'user', 'fr')
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             full_name = EXCLUDED.full_name,
             phone = EXCLUDED.phone
       RETURNING id`,
      [
        profile.email,
        hashPassword(profile.password),
        profile.name,
        profile.phone,
      ]
    );

    const userId = rows[0].id;

    await client.query(`DELETE FROM subscriptions WHERE user_id = $1`, [
      userId,
    ]);

    await client.query(
      `INSERT INTO subscriptions (user_id, plan, status, started_at, ends_at, auto_renew)
       VALUES (
         $1, $2, 'active',
         now() + ($3::int * interval '1 day'),
         now() + ($4::int * interval '1 day'),
         $5
       )`,
      [userId, profile.plan, profile.startedDays, profile.endsDays, profile.autoRenew]
    );

    console.log(
      `${profile.email} · ${profile.plan} · fin dans ${profile.endsDays} j`
    );
  }

  console.log("Abonnements de démonstration prêts.");
} finally {
  await client.end();
}
