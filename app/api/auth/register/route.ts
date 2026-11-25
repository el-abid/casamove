import type { NextRequest } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureDb, pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const fullName =
    typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!EMAIL.test(email)) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }
  if (password.length < 8) {
    return Response.json({ error: "weak_password" }, { status: 400 });
  }
  if (fullName.length < 2) {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }

  await ensureDb();

  const existing = await pool.query(`SELECT 1 FROM users WHERE email = $1`, [
    email,
  ]);
  if (existing.rowCount) {
    return Response.json({ error: "email_taken" }, { status: 409 });
  }

  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, full_name, phone, role)
     VALUES ($1, $2, $3, $4, 'user')
     RETURNING id`,
    [email, hashPassword(password), fullName, phone || null]
  );

  await createSession(rows[0].id);

  return Response.json({ ok: true, role: "user", redirect: "/fr/account" });
}
