import { ensureDb, pool } from "@/lib/db";
import type { SessionUser } from "./session";

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

export async function getUserById(id: number): Promise<SessionUser | null> {
  await ensureDb();

  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, full_name, phone, role, locale
     FROM users WHERE id = $1`,
    [id]
  );

  return rows[0] ? mapUser(rows[0]) : null;
}

export async function listAdmins(): Promise<
  { id: number; fullName: string; email: string }[]
> {
  await ensureDb();

  const { rows } = await pool.query<UserRow>(
    `SELECT id, email, full_name, phone, role, locale
     FROM users
     WHERE role = 'admin'
     ORDER BY full_name ASC, email ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
  }));
}
