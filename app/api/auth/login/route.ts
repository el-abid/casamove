import type { NextRequest } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { ensureDb, pool } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LoginRow = {
  id: number;
  password_hash: string;
  role: "admin" | "user";
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return Response.json({ error: "missing_credentials" }, { status: 400 });
  }

  await ensureDb();

  const { rows } = await pool.query<LoginRow>(
    `SELECT id, password_hash, role FROM users WHERE email = $1`,
    [email]
  );

  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return Response.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await createSession(user.id);

  return Response.json({
    ok: true,
    role: user.role,
    redirect: user.role === "admin" ? "/admin" : "/fr/account",
  });
}
