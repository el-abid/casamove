import type { PoolClient } from "pg";
import { ensureDb, pool } from "../db.ts";
import { network, stationById, validateNetwork } from "./network.ts";
import {
  affectsJourney,
  planJourney,
  type Impact,
  type PlanInput,
} from "./routing.ts";
import { reportCategories, reportStatuses } from "./categories.ts";

const schema = `
  CREATE TABLE IF NOT EXISTS mobility_network_versions (
    version text PRIMARY KEY, dataset jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE TABLE IF NOT EXISTS mobility_stations (
    id text PRIMARY KEY, line text NOT NULL, CHECK (line IN ('T1','T2','T3','T4','BW1','BW2'))
  );
  CREATE TABLE IF NOT EXISTS mobility_incidents (
    id serial PRIMARY KEY,
    line text NOT NULL CHECK (line IN ('T1','T2','T3','T4','BW1','BW2')),
    station text REFERENCES mobility_stations(id),
    end_station text REFERENCES mobility_stations(id),
    effect text NOT NULL CHECK (effect IN ('delay','station-closure','segment-closure','line-suspension','accessibility','information')),
    category text NOT NULL, severity text NOT NULL CHECK (severity IN ('info','minor','major')),
    title text NOT NULL, description text NOT NULL, published boolean NOT NULL,
    source text NOT NULL DEFAULT 'simulation' CHECK (source = 'simulation'),
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz, resolved_at timestamptz, revision integer NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS mobility_active_incidents_idx ON mobility_incidents (expires_at, line) WHERE resolved_at IS NULL;
  CREATE TABLE IF NOT EXISTS mobility_incident_history (
    id serial PRIMARY KEY, incident_id integer NOT NULL REFERENCES mobility_incidents(id),
    actor_id integer REFERENCES users(id) ON DELETE SET NULL, action text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), snapshot jsonb NOT NULL
  );
  CREATE INDEX IF NOT EXISTS mobility_incident_history_idx ON mobility_incident_history (incident_id, id DESC);
  CREATE TABLE IF NOT EXISTS mobility_reports (
    id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category text NOT NULL, station text NOT NULL REFERENCES mobility_stations(id),
    description text NOT NULL, severity text NOT NULL CHECK (severity IN ('info','minor','major')),
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','rejected','duplicate','resolved')),
    incident_id integer REFERENCES mobility_incidents(id), moderator_id integer REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    revision integer NOT NULL DEFAULT 1
  );
  ALTER TABLE mobility_reports ADD COLUMN IF NOT EXISTS end_station text REFERENCES mobility_stations(id);
  CREATE INDEX IF NOT EXISTS mobility_report_owner_idx ON mobility_reports (user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS mobility_report_group_idx ON mobility_reports (category, station, created_at DESC);
  CREATE TABLE IF NOT EXISTS mobility_saved_journeys (
    id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL, origin text NOT NULL REFERENCES mobility_stations(id),
    destination text NOT NULL REFERENCES mobility_stations(id), preference text NOT NULL,
    notify boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, origin, destination, preference)
  );
  CREATE TABLE IF NOT EXISTS mobility_favourites (
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station text NOT NULL REFERENCES mobility_stations(id),
    created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, station)
  );
  CREATE TABLE IF NOT EXISTS mobility_user_preferences (
    user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    accessibility boolean NOT NULL DEFAULT false, history boolean NOT NULL DEFAULT false,
    notifications boolean NOT NULL DEFAULT true, language text CHECK (language IN ('fr','ar','en'))
  );
  CREATE TABLE IF NOT EXISTS mobility_journey_history (
    id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    origin text NOT NULL REFERENCES mobility_stations(id), destination text NOT NULL REFERENCES mobility_stations(id),
    complete_key uuid NOT NULL, completed_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, complete_key)
  );
  CREATE INDEX IF NOT EXISTS mobility_journey_history_idx ON mobility_journey_history (user_id, completed_at DESC);
  CREATE TABLE IF NOT EXISTS mobility_notification_reads (
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE, notice text NOT NULL,
    read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, notice)
  );
`;

async function transaction<T>(
  operation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function importNetwork() {
  await ensureDb();
  const validation = validateNetwork();
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(20261126, 143)");
    await client.query(schema);
    await client.query(
      "INSERT INTO mobility_network_versions (version, dataset) VALUES ($1,$2) ON CONFLICT (version) DO NOTHING",
      [network.version, JSON.stringify(network)]
    );
    await client.query(
      `
      INSERT INTO mobility_stations (id, line)
      SELECT * FROM unnest($1::text[], $2::text[]) ON CONFLICT (id) DO NOTHING
    `,
      [
        [...stationById.keys()],
        [...stationById.values()].map((station) => station.line),
      ]
    );
  });
  return validation;
}

const runtime = globalThis as typeof globalThis & {
  casamoveMobilityReady?: Promise<unknown>;
};
export function ensureMobilityDb() {
  runtime.casamoveMobilityReady ??= importNetwork().catch((error) => {
    runtime.casamoveMobilityReady = undefined;
    throw error;
  });
  return runtime.casamoveMobilityReady;
}

export type IncidentInput = Impact & {
  category: string;
  severity: "info" | "minor" | "major";
  title: string;
  description: string;
  published: boolean;
  expiresAt: string | null;
};
export type Incident = IncidentInput & {
  id: number;
  source: "simulation";
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  revision: number;
  active: boolean;
};
const incidentFields = `id, line, station, end_station AS "endStation", effect, category, severity,
  title, description, published, source, expires_at AS "expiresAt", created_at AS "createdAt",
  updated_at AS "updatedAt", resolved_at AS "resolvedAt", revision,
  resolved_at IS NULL AND (expires_at IS NULL OR expires_at > now()) AS active`;

export async function networkStatus() {
  await ensureMobilityDb();
  const { rows: incidents } = await pool.query<Incident>(`
    SELECT ${incidentFields} FROM mobility_incidents
    WHERE resolved_at IS NULL AND (expires_at IS NULL OR expires_at > now()) ORDER BY id
  `);
  return {
    version: [
      network.version,
      ...incidents.map(({ id, revision }) => `${id}.${revision}`),
    ].join("|"),
    checkedAt: new Date().toISOString(),
    source: "simulation" as const,
    incidents: incidents.map((incident) => ({
      ...incident,
      title: incident.published ? incident.title : "",
      description: incident.published ? incident.description : "",
    })),
  };
}

export type NetworkStatus = Awaited<ReturnType<typeof networkStatus>>;

export async function writeIncident(
  actor: number,
  input: IncidentInput | null,
  id?: number,
  expected?: number
) {
  await ensureMobilityDb();
  return transaction(async (client) => {
    let rows: Incident[];
    if (id && !input) {
      ({ rows } = await client.query<Incident>(
        `
        UPDATE mobility_incidents SET resolved_at=now(), updated_at=now(), revision=revision+1
        WHERE id=$1 AND revision=$2 AND resolved_at IS NULL RETURNING ${incidentFields}
      `,
        [id, expected]
      ));
    } else if (input) {
      const values = [
        input.line,
        input.station,
        input.endStation,
        input.effect,
        input.category,
        input.severity,
        input.title,
        input.description,
        input.published,
        input.expiresAt,
      ];
      if (id) {
        ({ rows } = await client.query<Incident>(
          `
          UPDATE mobility_incidents SET line=$1, station=$2, end_station=$3, effect=$4, category=$5, severity=$6,
            title=$7, description=$8, published=$9, expires_at=$10, updated_at=now(), revision=revision+1
          WHERE id=$11 AND revision=$12 AND resolved_at IS NULL RETURNING ${incidentFields}
        `,
          [...values, id, expected]
        ));
      } else {
        ({ rows } = await client.query<Incident>(
          `
          INSERT INTO mobility_incidents (line, station, end_station, effect, category, severity, title, description, published, expires_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${incidentFields}
        `,
          values
        ));
      }
    } else {
      return null;
    }
    const incident = rows[0];
    if (!incident) return null;
    await client.query(
      `
      INSERT INTO mobility_incident_history (incident_id, actor_id, action, snapshot) VALUES ($1,$2,$3,$4)
    `,
      [
        incident.id,
        actor,
        id ? (input ? "updated" : "resolved") : "created",
        JSON.stringify(incident),
      ]
    );
    return incident;
  });
}

export type ReportInput = {
  station: string;
  endStation: string | null;
  category: (typeof reportCategories)[number];
  description: string;
  severity: IncidentInput["severity"];
};
export type Report = ReportInput & {
  id: number;
  status: (typeof reportStatuses)[number];
  incidentId: number | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
  grouped?: number;
};
const reportFields = `r.id, r.station, r.end_station AS "endStation", r.category, r.description, r.severity, r.status,
  r.incident_id AS "incidentId", r.created_at AS "createdAt", r.updated_at AS "updatedAt", r.revision`;

export async function createReport(user: number, report: ReportInput) {
  await ensureMobilityDb();
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(20261127, $1)", [user]);
    const values = [
      user,
      report.station,
      report.category,
      report.description,
      report.severity,
      report.endStation,
    ];
    const { rows: duplicates } = await client.query<Report>(
      `
      SELECT ${reportFields} FROM mobility_reports r
      WHERE user_id=$1 AND station=$2 AND category=$3 AND description=$4 AND severity=$5
      AND end_station IS NOT DISTINCT FROM $6
      AND created_at > now()-interval '15 minutes' ORDER BY id DESC LIMIT 1
    `,
      values
    );
    if (duplicates[0]) return { report: duplicates[0], duplicate: true };
    const { rows } = await client.query<{ count: number }>(
      `
      SELECT count(*)::int AS count FROM mobility_reports WHERE user_id=$1 AND created_at > now()-interval '1 hour'
    `,
      [user]
    );
    if (rows[0].count >= 8) return null;
    const { rows: created } = await client.query<Report>(
      `
      INSERT INTO mobility_reports AS r (user_id, station, category, description, severity, end_station)
      VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${reportFields}
    `,
      values
    );
    return { report: created[0], duplicate: false };
  });
}

export async function moderateReport(
  actor: number,
  id: number,
  revision: number,
  status: Report["status"],
  incidentId: number | null
) {
  await ensureMobilityDb();
  const { rows } = await pool.query<Report>(
    `
    UPDATE mobility_reports AS r SET moderator_id=$1, status=$4, incident_id=$5,
      updated_at=now(), revision=revision+1
    WHERE id=$2 AND revision=$3 AND ($5::integer IS NULL OR EXISTS (
      SELECT 1 FROM mobility_incidents i JOIN mobility_stations s ON s.id=r.station WHERE i.id=$5 AND i.line=s.line
    )) RETURNING ${reportFields}
  `,
    [actor, id, revision, status, incidentId]
  );
  return rows[0] ?? null;
}

export async function towerOverview() {
  await ensureMobilityDb();
  const [incidents, reports, history, counts, complaints] = await Promise.all([
    pool.query<Incident>(`
      SELECT ${incidentFields} FROM mobility_incidents
      ORDER BY (resolved_at IS NULL AND (expires_at IS NULL OR expires_at > now())) DESC, updated_at DESC LIMIT 100
    `),
    pool.query<Report>(`
      SELECT ${reportFields}, (SELECT count(*)::int FROM mobility_reports nearby
        WHERE nearby.category=r.category AND nearby.station=r.station AND nearby.status NOT IN ('rejected','duplicate')
        AND nearby.created_at BETWEEN r.created_at - interval '2 hours' AND r.created_at + interval '2 hours') AS grouped
      FROM mobility_reports r ORDER BY (r.status='pending') DESC,r.updated_at DESC LIMIT 100
    `),
    pool.query<{
      incidentId: number;
      action: string;
      createdAt: string;
      title: string;
    }>(`
      SELECT incident_id AS "incidentId", action, created_at AS "createdAt", snapshot->>'title' AS title
      FROM mobility_incident_history ORDER BY id DESC LIMIT 30
    `),
    pool.query<{
      active: number;
      resolved: number;
      reports: number;
      pending: number;
    }>(`
      SELECT (SELECT count(*)::int FROM mobility_incidents WHERE resolved_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS active,
        (SELECT count(*)::int FROM mobility_incidents WHERE resolved_at IS NOT NULL) AS resolved,
        (SELECT count(*)::int FROM mobility_reports) AS reports,
        (SELECT count(*)::int FROM mobility_reports WHERE status='pending') AS pending
    `),
    pool.query<{ line: string | null; count: number }>(
      "SELECT line, count(*)::int AS count FROM tickets GROUP BY line ORDER BY count DESC"
    ),
  ]);
  return {
    incidents: incidents.rows,
    reports: reports.rows,
    history: history.rows,
    counts: counts.rows[0],
    complaints: complaints.rows,
  };
}

export type TowerOverview = Awaited<ReturnType<typeof towerOverview>>;
export type SavedJourney = {
  id: number;
  name: string;
  from: string;
  to: string;
  preference: PlanInput["preference"];
  notify: boolean;
};
export type MobilityPreferences = {
  accessibility: boolean;
  history: boolean;
  notifications: boolean;
  language: "fr" | "ar" | "en" | null;
};
export type Notice = {
  id: string;
  title: string;
  kind: "incident" | "resolution" | "report" | "subscription" | "complaint";
  date: string;
  read: boolean;
  target?: string;
};
export const defaultPreferences: MobilityPreferences = {
  accessibility: false,
  history: false,
  notifications: true,
  language: null,
};

export async function passengerSpace(user: number) {
  await ensureMobilityDb();
  const [
    saved,
    favourites,
    reports,
    history,
    settings,
    reads,
    status,
    resolutions,
    subscriptions,
    complaints,
  ] = await Promise.all([
    pool.query<SavedJourney>(
      `SELECT id, name, origin AS "from", destination AS "to", preference, notify
      FROM mobility_saved_journeys WHERE user_id=$1 ORDER BY created_at DESC`,
      [user]
    ),
    pool.query<{ station: string }>(
      "SELECT station FROM mobility_favourites WHERE user_id=$1 ORDER BY created_at DESC",
      [user]
    ),
    pool.query<Report>(
      `SELECT ${reportFields} FROM mobility_reports r WHERE user_id=$1 ORDER BY created_at DESC LIMIT 30`,
      [user]
    ),
    pool.query<{ from: string; to: string; completedAt: string }>(
      `SELECT origin AS "from", destination AS "to", completed_at AS "completedAt"
      FROM mobility_journey_history WHERE user_id=$1 ORDER BY completed_at DESC LIMIT 30`,
      [user]
    ),
    pool.query<MobilityPreferences>(
      "SELECT accessibility, history, notifications, language FROM mobility_user_preferences WHERE user_id=$1",
      [user]
    ),
    pool.query<{ notice: string }>(
      "SELECT notice FROM mobility_notification_reads WHERE user_id=$1",
      [user]
    ),
    networkStatus(),
    pool.query<Incident>(`SELECT ${incidentFields} FROM mobility_incidents
      WHERE published AND resolved_at > now()-interval '14 days' ORDER BY resolved_at DESC LIMIT 30`),
    pool.query<{
      id: number;
      status: string;
      endsAt: string;
      createdAt: string;
    }>(
      `
      SELECT id,status,ends_at AS "endsAt",created_at AS "createdAt" FROM subscriptions
      WHERE user_id=$1 ORDER BY ends_at DESC LIMIT 1`,
      [user]
    ),
    pool.query<{ number: string; status: string; date: string }>(
      `
      SELECT number,status,COALESCE(resolved_at, assigned_at, created_at) AS date FROM tickets
      WHERE user_id=$1 ORDER BY COALESCE(resolved_at, assigned_at, created_at) DESC LIMIT 20`,
      [user]
    ),
  ]);
  const preferences = settings.rows[0] ?? defaultPreferences;
  const read = new Set(reads.rows.map((row) => row.notice));
  const journeys = saved.rows.map((savedJourney) => {
    const baseline = planJourney(savedJourney, [], 1).journeys[0];
    return {
      ...savedJourney,
      affected: !!baseline && affectsJourney(baseline, status.incidents),
      baseline,
    };
  });
  const incidentNotices = [...status.incidents, ...resolutions.rows].flatMap(
    (incident): Omit<Notice, "read">[] => {
      const journey = journeys.find(
        (item) =>
          item.notify &&
          item.baseline &&
          affectsJourney(item.baseline, [incident])
      );
      if (!preferences.notifications || !journey) return [];
      return [
        {
          id: `incident-${incident.id}-${incident.revision}`,
          title: incident.title || incident.line,
          kind: incident.resolvedAt ? "resolution" : "incident",
          date: incident.updatedAt,
          target: String(journey.id),
        },
      ];
    }
  );
  const subscription = subscriptions.rows[0];
  const notices: Omit<Notice, "read">[] = [
    ...incidentNotices,
    ...reports.rows
      .filter((report) => report.status !== "pending")
      .map((report) => ({
        id: `report-${report.id}-${report.revision}`,
        title: report.status,
        kind: "report" as const,
        date: report.updatedAt,
        target: String(report.id),
      })),
    ...complaints.rows.map((ticket) => ({
      id: `ticket-${ticket.number}-${ticket.status}`,
      title: ticket.number,
      kind: "complaint" as const,
      date: ticket.date,
    })),
  ];
  if (
    subscription &&
    new Date(subscription.endsAt).getTime() - Date.now() < 14 * 86400000
  ) {
    notices.push({
      id: `subscription-${subscription.id}-${new Date(subscription.endsAt).getTime()}`,
      title: "",
      kind: "subscription",
      date: subscription.createdAt,
    });
  }
  return {
    favourites: favourites.rows.map(({ station }) => station),
    reports: reports.rows,
    history: history.rows,
    preferences,
    saved: journeys.map(({ baseline, ...item }) => item),
    notices: notices
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((notice): Notice => ({ ...notice, read: read.has(notice.id) })),
  };
}

export type PassengerSpace = Awaited<ReturnType<typeof passengerSpace>>;

export async function writeSaved(
  user: number,
  plan: PlanInput,
  name: string,
  notify: boolean
) {
  await ensureMobilityDb();
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(20261128, $1)", [user]);
    const { rows } = await client.query<{ id: number }>(
      `
      INSERT INTO mobility_saved_journeys (user_id, name, origin, destination, preference, notify)
      SELECT $1,$2,$3,$4,$5,$6 WHERE (SELECT count(*) FROM mobility_saved_journeys WHERE user_id=$1) < 30
        OR EXISTS (SELECT 1 FROM mobility_saved_journeys WHERE user_id=$1 AND origin=$3 AND destination=$4 AND preference=$5)
      ON CONFLICT (user_id, origin, destination, preference) DO UPDATE SET name=EXCLUDED.name, notify=EXCLUDED.notify
      RETURNING id
    `,
      [user, name, plan.from, plan.to, plan.preference, notify]
    );
    return rows[0]?.id ?? null;
  });
}

export async function editSaved(
  user: number,
  id: number,
  update: { name: string; notify: boolean } | null
) {
  await ensureMobilityDb();
  const result = update
    ? await pool.query(
        "UPDATE mobility_saved_journeys SET name=$3,notify=$4 WHERE user_id=$1 AND id=$2",
        [user, id, update.name, update.notify]
      )
    : await pool.query(
        "DELETE FROM mobility_saved_journeys WHERE user_id=$1 AND id=$2",
        [user, id]
      );
  return result.rowCount === 1;
}

export async function writeFavourite(
  user: number,
  station: string,
  add: boolean
) {
  await ensureMobilityDb();
  if (add) {
    await pool.query(
      `INSERT INTO mobility_favourites (user_id, station) VALUES ($1,$2)
      ON CONFLICT (user_id,station) DO NOTHING`,
      [user, station]
    );
  } else {
    await pool.query(
      "DELETE FROM mobility_favourites WHERE user_id=$1 AND station=$2",
      [user, station]
    );
  }
}

export async function writePreferences(
  user: number,
  prefs: MobilityPreferences
) {
  await ensureMobilityDb();
  await pool.query(
    `INSERT INTO mobility_user_preferences (user_id,accessibility,history,notifications,language)
    VALUES ($1,$2,$3,$4,$5) ON CONFLICT(user_id) DO UPDATE SET accessibility=EXCLUDED.accessibility,
      history=EXCLUDED.history, notifications=EXCLUDED.notifications, language=EXCLUDED.language`,
    [
      user,
      prefs.accessibility,
      prefs.history,
      prefs.notifications,
      prefs.language,
    ]
  );
}

export async function completeJourney(
  user: number,
  plan: PlanInput,
  key: string
) {
  await ensureMobilityDb();
  await pool.query(
    `INSERT INTO mobility_journey_history (user_id,origin,destination,complete_key)
    SELECT $1,$2,$3,$4 FROM mobility_user_preferences WHERE user_id=$1 AND history
    ON CONFLICT (user_id,complete_key) DO NOTHING`,
    [user, plan.from, plan.to, key]
  );
}

export async function readNotices(user: number, ids: string[] | null) {
  const { notices } = await passengerSpace(user);
  const visible = notices
    .filter((notice) => !notice.read && (!ids || ids.includes(notice.id)))
    .map(({ id }) => id);
  await pool.query(
    `INSERT INTO mobility_notification_reads (user_id,notice)
    SELECT $1, id FROM unnest($2::text[]) AS id ON CONFLICT (user_id,notice) DO NOTHING`,
    [user, visible]
  );
}
