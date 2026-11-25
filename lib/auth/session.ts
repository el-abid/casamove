import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ensureDb, pool } from "@/lib/db";

export const SESSION_COOKIE = "casamove_session";

export type SessionUser = {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: "admin" | "user";
  locale: string;
};

type UserRow = {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  role: "admin" | "user";
  locale: string;
};

function mapUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    role: row.role,
    locale: row.locale,
  };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number): Promise<void> {
  await ensureDb();

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);

  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at)
     VALUES ($1, $2, now() + interval '7 days')`,
    [tokenHash, userId]
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Démo locale en HTTP : passer COOKIE_SECURE=true derrière HTTPS.
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [
      hashToken(token),
    ]);
  }

  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await ensureDb();

  const { rows } = await pool.query<UserRow>(
    `SELECT u.* FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/login?next=/admin&denied=1");
  return user;
}

export function isAdmin(user: SessionUser | null): boolean {
  return user?.role === "admin";
}
