import { Pool } from "pg";

export const connectionString =
  process.env.DATABASE_URL ?? "postgresql://casamove@127.0.0.1:5544/casamove";

const globalDb = globalThis as unknown as {
  __casamovePool?: Pool;
  __casamoveReady?: Promise<void>;
};

export const pool =
  globalDb.__casamovePool ??
  new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30_000,
  });

globalDb.__casamovePool = pool;

async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      number       text PRIMARY KEY,
      status       text NOT NULL DEFAULT 'pending',
      priority     text NOT NULL,
      theme        text NOT NULL,
      locale       text NOT NULL,
      thread_id    text NOT NULL,
      user_query   text NOT NULL,
      draft        text NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now(),
      sla_deadline timestamptz NOT NULL
    );

    CREATE INDEX IF NOT EXISTS tickets_status_idx
      ON tickets (status, created_at DESC);

    CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 149;

    CREATE TABLE IF NOT EXISTS signals (
      id         serial PRIMARY KEY,
      kind       text NOT NULL,
      line       text,
      payload    jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      expires_at timestamptz NOT NULL
    );

    CREATE INDEX IF NOT EXISTS signals_created_idx
      ON signals (created_at DESC);

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

    CREATE TABLE IF NOT EXISTS sessions (
      id         serial PRIMARY KEY,
      token_hash text NOT NULL UNIQUE,
      user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

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

    CREATE INDEX IF NOT EXISTS subscriptions_user_idx
      ON subscriptions (user_id, ends_at DESC);

    ALTER TABLE signals
      ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE;

    ALTER TABLE signals
      ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info';

    ALTER TABLE signals
      ADD COLUMN IF NOT EXISTS created_by integer REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE signals
      ADD COLUMN IF NOT EXISTS created_by_email text NOT NULL DEFAULT '';

    CREATE INDEX IF NOT EXISTS signals_user_idx
      ON signals (user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS signal_deliveries (
      id           serial PRIMARY KEY,
      signal_id    integer NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
      user_id      integer REFERENCES users(id) ON DELETE CASCADE,
      session_id   text,
      delivered_at timestamptz NOT NULL DEFAULT now(),
      read_at      timestamptz,
      dismissed_at timestamptz
    );

    ALTER TABLE signal_deliveries
      ADD COLUMN IF NOT EXISTS read_at timestamptz;

    UPDATE signal_deliveries
    SET read_at = dismissed_at
    WHERE read_at IS NULL AND dismissed_at IS NOT NULL;

    CREATE INDEX IF NOT EXISTS signal_deliveries_signal_idx
      ON signal_deliveries (signal_id, delivered_at DESC);

    CREATE UNIQUE INDEX IF NOT EXISTS signal_deliveries_user_idx
      ON signal_deliveries (signal_id, user_id)
      WHERE user_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS signal_deliveries_session_idx
      ON signal_deliveries (signal_id, session_id)
      WHERE session_id IS NOT NULL;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS assigned_to integer REFERENCES users(id) ON DELETE SET NULL;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS sentiment text NOT NULL DEFAULT 'neutral';

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS line text;

    CREATE INDEX IF NOT EXISTS tickets_line_idx
      ON tickets (line, created_at DESC);

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS csat_score integer;

    ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS csat_at timestamptz;

    UPDATE tickets
    SET status = 'resolved',
        resolved_at = COALESCE(resolved_at, created_at)
    WHERE status = 'approved';

    CREATE INDEX IF NOT EXISTS tickets_sentiment_idx
      ON tickets (sentiment, created_at DESC);

    CREATE TABLE IF NOT EXISTS ticket_messages (
      id            serial PRIMARY KEY,
      ticket_number text NOT NULL REFERENCES tickets(number) ON DELETE CASCADE,
      role          text NOT NULL,
      body          text NOT NULL,
      author_email  text NOT NULL DEFAULT '',
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ticket_messages_ticket_idx
      ON ticket_messages (ticket_number, created_at ASC);

    CREATE TABLE IF NOT EXISTS ticket_events (
      id            serial PRIMARY KEY,
      ticket_number text NOT NULL REFERENCES tickets(number) ON DELETE CASCADE,
      event         text NOT NULL,
      actor_id      integer REFERENCES users(id) ON DELETE SET NULL,
      actor_email   text NOT NULL DEFAULT '',
      detail        text NOT NULL DEFAULT '',
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ticket_events_ticket_idx
      ON ticket_events (ticket_number, created_at ASC);

    CREATE TABLE IF NOT EXISTS ticket_decisions (
      id            serial PRIMARY KEY,
      ticket_number text NOT NULL REFERENCES tickets(number) ON DELETE CASCADE,
      action        text NOT NULL,
      comment       text NOT NULL DEFAULT '',
      admin_id      integer REFERENCES users(id) ON DELETE SET NULL,
      admin_email   text NOT NULL,
      created_at    timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS ticket_decisions_ticket_idx
      ON ticket_decisions (ticket_number, created_at ASC);

    INSERT INTO ticket_events
      (ticket_number, event, actor_email, detail, created_at)
    SELECT t.number, 'created', 'système', 'Dossier créé', t.created_at
    FROM tickets t
    WHERE NOT EXISTS (
      SELECT 1 FROM ticket_events e
      WHERE e.ticket_number = t.number AND e.event = 'created'
    );

    INSERT INTO ticket_events
      (ticket_number, event, actor_id, actor_email, detail, created_at)
    SELECT d.ticket_number, d.action, d.admin_id, d.admin_email,
           d.comment, d.created_at
    FROM ticket_decisions d
    WHERE NOT EXISTS (
      SELECT 1 FROM ticket_events e
      WHERE e.ticket_number = d.ticket_number
        AND e.event = d.action
        AND e.actor_email = d.admin_email
        AND e.detail = d.comment
    );
  `);
}

export function ensureDb(): Promise<void> {
  if (!globalDb.__casamoveReady) {
    globalDb.__casamoveReady = migrate().catch((error) => {
      globalDb.__casamoveReady = undefined;
      throw error;
    });
  }
  return globalDb.__casamoveReady;
}
