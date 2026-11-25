import type { Locale } from "@/content/dictionary";
import { ensureDb, pool } from "@/lib/db";

export type SubscriptionPlan = "hebdomadaire" | "mensuel" | "etudiant";
export type SubscriptionStatus = "active" | "suspended" | "cancelled";

export type Subscription = {
  id: number;
  userId: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startedAt: string;
  endsAt: string;
  autoRenew: boolean;
};

type SubscriptionRow = {
  id: number;
  user_id: number;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  started_at: Date;
  ends_at: Date;
  auto_renew: boolean;
};

export const PLAN_INFO: Record<
  SubscriptionPlan,
  { days: number; price: number; label: Record<Locale, string> }
> = {
  hebdomadaire: {
    days: 7,
    price: 60,
    label: { fr: "Hebdomadaire", ar: "أسبوعي", en: "Weekly" },
  },
  mensuel: {
    days: 30,
    price: 230,
    label: { fr: "Mensuel", ar: "شهري", en: "Monthly" },
  },
  etudiant: {
    days: 30,
    price: 150,
    label: { fr: "Étudiant", ar: "طلابي", en: "Student" },
  },
};

export type SubscriptionInfo = {
  plan: SubscriptionPlan;
  planLabel: string;
  price: number;
  status: SubscriptionStatus;
  statusLabel: string;
  endsAt: string;
  daysLeft: number;
};

const STATUS_LABEL: Record<
  Locale,
  Record<"active" | "expiring" | "expired" | "suspended" | "cancelled", string>
> = {
  fr: {
    active: "actif",
    expiring: "expire bientôt",
    expired: "expiré",
    suspended: "suspendu",
    cancelled: "annulé",
  },
  ar: {
    active: "نشط",
    expiring: "ينتهي قريباً",
    expired: "منتهي",
    suspended: "موقوف",
    cancelled: "ملغى",
  },
  en: {
    active: "active",
    expiring: "expiring soon",
    expired: "expired",
    suspended: "suspended",
    cancelled: "cancelled",
  },
};

function mapRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    autoRenew: row.auto_renew,
  };
}

export async function getSubscription(
  userId: number
): Promise<Subscription | null> {
  await ensureDb();

  const { rows } = await pool.query<SubscriptionRow>(
    `SELECT * FROM subscriptions
     WHERE user_id = $1
     ORDER BY ends_at DESC
     LIMIT 1`,
    [userId]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export function describeSubscription(
  subscription: Subscription,
  locale: Locale
): SubscriptionInfo {
  const daysLeft = Math.ceil(
    (new Date(subscription.endsAt).getTime() - Date.now()) / 86_400_000
  );

  const key =
    subscription.status === "suspended" || subscription.status === "cancelled"
      ? subscription.status
      : daysLeft <= 0
        ? "expired"
        : daysLeft <= 7
          ? "expiring"
          : "active";

  return {
    plan: subscription.plan,
    planLabel: PLAN_INFO[subscription.plan].label[locale],
    price: PLAN_INFO[subscription.plan].price,
    status: subscription.status,
    statusLabel: STATUS_LABEL[locale][key],
    endsAt: subscription.endsAt,
    daysLeft: Math.max(0, daysLeft),
  };
}
