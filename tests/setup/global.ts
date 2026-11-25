import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  TEST_DB_URL,
} from "../helpers/env";

const ROOT = process.cwd();
const ADMIN_DB_URL = "postgresql://casamove@127.0.0.1:5544/postgres";
const PORT = new URL(BASE_URL).port || "3210";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function setup() {
  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) {
    throw new Error(
      "Build Next.js absent. Lance npm run build avant les tests."
    );
  }

  const admin = new Client({ connectionString: ADMIN_DB_URL });
  await admin.connect();
  await admin.query("DROP DATABASE IF EXISTS casamove_test WITH (FORCE)");
  await admin.query("CREATE DATABASE casamove_test");
  await admin.end();

  execFileSync(
    process.execPath,
    [
      path.join(ROOT, "scripts", "create-admin.mjs"),
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      "Admin Test",
      "0600000000",
    ],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "ignore",
    }
  );

  execFileSync(
    process.execPath,
    [path.join(ROOT, "scripts", "seed-subscriptions.mjs")],
    {
      cwd: ROOT,
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: "ignore",
    }
  );

  const logs: string[] = [];

  try {
    const probe = await fetch(`${BASE_URL}/fr`, { redirect: "manual" });
    if (probe.ok) {
      throw new Error(
        `Un serveur écoute déjà sur ${BASE_URL}. Arrête-le avant les tests.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("écoute déjà")) {
      throw error;
    }
  }

  const server = spawn(
    process.execPath,
    [
      path.join(ROOT, "node_modules", "next", "dist", "bin", "next"),
      "start",
      "-p",
      PORT,
    ],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: TEST_DB_URL,
        LLM_ENABLED: "false",
        EMBEDDINGS_ENABLED: "false",
        RENEWAL_AUTO: "false",
        COOKIE_SECURE: "false",
        PORT,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  server.stdout?.on("data", (chunk) => logs.push(String(chunk)));
  server.stderr?.on("data", (chunk) => logs.push(String(chunk)));

  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/fr`, {
        redirect: "manual",
      });
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      // le serveur démarre encore
    }
    await sleep(500);
  }

  if (!ready) {
    try {
      execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      // déjà arrêté
    }
    throw new Error(
      `Serveur de test non disponible sur ${BASE_URL}.\n${logs
        .join("")
        .slice(-2000)}`
    );
  }

  return async () => {
    try {
      execFileSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } catch {
      try {
        server.kill();
      } catch {
        // déjà arrêté
      }
    }
  };
}
