import type { Locale } from "@/content/dictionary";
import { ensureDb, pool } from "@/lib/db";

export type SignalKind = "disruption" | "renewal" | "info";
export type SignalSeverity = "info" | "warning" | "critical";

export type SignalPayload = Record<Locale, { title: string; body: string }>;

export type Signal = {
  id: number;
  kind: SignalKind;
  line: string | null;
  userId: number | null;
  userEmail: string | null;
  severity: SignalSeverity;
  createdByEmail: string;
  payload: SignalPayload;
  createdAt: string;
  expiresAt: string;
  deliveredCount: number;
  readCount: number;
  dismissedCount: number;
};

type SignalRow = {
  id: number;
  kind: SignalKind;
  line: string | null;
  user_id: number | null;
  user_email?: string | null;
  severity: SignalSeverity;
  created_by_email: string;
  payload: SignalPayload;
  created_at: Date;
  expires_at: Date;
  delivered_count?: number;
  read_count?: number;
  dismissed_count?: number;
};

type Actor = { id: number; email: string };

function mapRow(row: SignalRow): Signal {
  return {
    id: row.id,
    kind: row.kind,
    line: row.line,
    userId: row.user_id ?? null,
    userEmail: row.user_email ?? null,
    severity: row.severity ?? "info",
    createdByEmail: row.created_by_email ?? "",
    payload: row.payload,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    deliveredCount: row.delivered_count ?? 0,
    readCount: row.read_count ?? 0,
    dismissedCount: row.dismissed_count ?? 0,
  };
}

function buildPayload(
  kind: SignalKind,
  line: string,
  daysLeft = 7
): SignalPayload {
  if (kind === "disruption") {
    return {
      fr: {
        title: `Perturbation ${line}`,
        body: "Un incident à Casa Port interrompt la circulation entre Casa Port et Sidi Mohamed Ben Abdellah. Un itinéraire de remplacement est disponible.",
      },
      ar: {
        title: `اضطراب على ${line}`,
        body: "حادث في كازا بور يقطع الحركة بين كازا بور وسيدي محمد بن عبد الله. مسار بديل متوفر.",
      },
      en: {
        title: `${line} disruption`,
        body: "An incident at Casa Port stops service between Casa Port and Sidi Mohamed Ben Abdellah. A replacement route is available.",
      },
    };
  }

  if (kind === "info") {
    return {
      fr: {
        title: "Information réseau",
        body: "Une information importante concerne votre ligne. Consultez le site ou l'application pour le détail.",
      },
      ar: {
        title: "معلومة عن الشبكة",
        body: "هناك معلومة مهمة تخص خطك. راجع الموقع أو التطبيق للتفاصيل.",
      },
      en: {
        title: "Network information",
        body: "Important information concerns your line. Check the website or app for details.",
      },
    };
  }

  return {
    fr: {
      title: "Abonnement à renouveler",
      body: `Votre abonnement arrive à échéance dans ${daysLeft} jour(s). Renouvelez-le en agence ou au point de vente.`,
    },
    ar: {
      title: "الاشتراك على وشك الانتهاء",
      body: `ينتهي اشتراكك خلال ${daysLeft} يوم. جدّده في الوكالة أو نقطة البيع.`,
    },
    en: {
      title: "Pass expiring soon",
      body: `Your pass expires in ${daysLeft} day(s). Renew it at an agency or ticket point.`,
    },
  };
}

export async function createSignal(
  kind: SignalKind,
  line = "ligne 1",
  options: {
    userId?: number | null;
    daysLeft?: number;
    payload?: SignalPayload;
    severity?: SignalSeverity;
    createdBy?: Actor | null;
  } = {}
): Promise<Signal> {
  await ensureDb();

  const userId = options.userId ?? null;
  const payload = options.payload ?? buildPayload(kind, line, options.daysLeft);
  const severity =
    options.severity ?? (kind === "disruption" ? "warning" : "info");
  const hours = kind === "disruption" ? 2 : 24;

  const { rows } = await pool.query<SignalRow>(
    `INSERT INTO signals
       (kind, line, user_id, severity, created_by, created_by_email, payload, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now() + ($8::int * interval '1 hour'))
     RETURNING *`,
    [
      kind,
      kind === "renewal" ? null : line,
      userId,
      severity,
      options.createdBy?.id ?? null,
      options.createdBy?.email ?? "",
      JSON.stringify(payload),
      hours,
    ]
  );

  return mapRow(rows[0]);
}

export async function createRenewalSignals(
  createdBy?: Actor | null
): Promise<Signal[]> {
  await ensureDb();

  const { rows } = await pool.query<{ user_id: number; ends_at: Date }>(
    `SELECT DISTINCT ON (s.user_id) s.user_id, s.ends_at
     FROM subscriptions s
     WHERE s.status = 'active'
       AND s.ends_at > now()
       AND s.ends_at <= now() + interval '7 days'
       AND NOT EXISTS (
         SELECT 1 FROM signals g
         WHERE g.kind = 'renewal'
           AND g.user_id = s.user_id
           AND g.created_at >= date_trunc('day', now())
       )
     ORDER BY s.user_id, s.ends_at DESC`
  );

  const signals: Signal[] = [];

  if (rows.length > 0) {
    await pool.query(
      `UPDATE signals
       SET expires_at = now() - interval '1 minute'
       WHERE kind = 'renewal'
         AND expires_at > now()
         AND user_id = ANY($1::int[])`,
      [rows.map((row) => row.user_id)]
    );
  }

  for (const row of rows) {
    const daysLeft = Math.max(
      1,
      Math.ceil((new Date(row.ends_at).getTime() - Date.now()) / 86_400_000)
    );
    signals.push(
      await createSignal("renewal", "ligne 1", {
        userId: row.user_id,
        daysLeft,
        createdBy,
      })
    );
  }

  return signals;
}

export async function listSignals(
  since?: string,
  options: {
    userId?: number | null;
    sessionId?: string | null;
    includeAll?: boolean;
  } = {}
): Promise<Signal[]> {
  await ensureDb();

  const { userId = null, sessionId = null, includeAll = false } = options;

  const { rows } = await pool.query<SignalRow>(
    `SELECT s.*, u.email AS user_email,
       (SELECT count(*)::int FROM signal_deliveries d WHERE d.signal_id = s.id) AS delivered_count,
       (SELECT count(*)::int FROM signal_deliveries d WHERE d.signal_id = s.id AND d.read_at IS NOT NULL) AS read_count,
       (SELECT count(*)::int FROM signal_deliveries d WHERE d.signal_id = s.id AND d.dismissed_at IS NOT NULL) AS dismissed_count
     FROM signals s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.expires_at > now()
       AND ($1::timestamptz IS NULL OR s.created_at > $1::timestamptz)
       AND ($2::boolean OR s.user_id IS NULL OR s.user_id = $3)
       AND (
         $2::boolean
         OR ($3::int IS NULL AND $4::text IS NULL)
         OR NOT EXISTS (
           SELECT 1 FROM signal_deliveries d
           WHERE d.signal_id = s.id
             AND (
               ($3::int IS NOT NULL AND d.user_id = $3)
               OR ($4::text IS NOT NULL AND d.session_id = $4)
             )
         )
       )
       AND (
         $2::boolean
         OR ($3::int IS NULL AND $4::text IS NULL)
         OR s.kind = 'disruption'
         OR NOT EXISTS (
           SELECT 1 FROM signal_deliveries d
           WHERE d.delivered_at >= date_trunc('day', now())
             AND (
               ($3::int IS NOT NULL AND d.user_id = $3)
               OR ($4::text IS NOT NULL AND d.session_id = $4)
             )
         )
       )
     ORDER BY s.created_at DESC
     LIMIT 20`,
    [since ?? null, includeAll, userId, sessionId]
  );

  return rows.map(mapRow);
}

export async function recordSignalDeliveries(
  signals: Signal[],
  options: { userId?: number | null; sessionId?: string | null }
): Promise<void> {
  const userId = options.userId ?? null;
  const sessionId = options.sessionId ?? null;
  if (signals.length === 0 || (!userId && !sessionId)) return;

  await ensureDb();

  for (const signal of signals) {
    await pool.query(
      `INSERT INTO signal_deliveries (signal_id, user_id, session_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [signal.id, userId, sessionId]
    );
  }
}

export async function markSignalRead(
  signalId: number,
  options: { userId?: number | null; sessionId?: string | null }
): Promise<boolean> {
  const userId = options.userId ?? null;
  const sessionId = options.sessionId ?? null;
  if (!userId && !sessionId) return false;

  await ensureDb();

  const { rowCount } = await pool.query(
    `UPDATE signal_deliveries
     SET read_at = COALESCE(read_at, now())
     WHERE signal_id = $1
       AND (
         ($2::int IS NOT NULL AND user_id = $2)
         OR ($3::text IS NOT NULL AND session_id = $3)
       )`,
    [signalId, userId, sessionId]
  );

  return (rowCount ?? 0) > 0;
}

export async function dismissSignal(
  signalId: number,
  options: { userId?: number | null; sessionId?: string | null }
): Promise<boolean> {
  const userId = options.userId ?? null;
  const sessionId = options.sessionId ?? null;
  if (!userId && !sessionId) return false;

  await ensureDb();

  const { rowCount } = await pool.query(
    `UPDATE signal_deliveries
     SET dismissed_at = now(),
         read_at = COALESCE(read_at, now())
     WHERE signal_id = $1
       AND (
         ($2::int IS NOT NULL AND user_id = $2)
         OR ($3::text IS NOT NULL AND session_id = $3)
       )`,
    [signalId, userId, sessionId]
  );

  return (rowCount ?? 0) > 0;
}
