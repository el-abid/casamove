import type { NextRequest } from "next/server";

import { isLocale, type Locale } from "@/content/dictionary";
import { generalReply } from "@/lib/agent/general";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

function sse(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function chunkText(text: string): string[] {
  const parts = text.split(/(\s+)/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    current += part;
    if (current.length >= 28) {
      chunks.push(current);
      current = "";
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.length > 8
      ? body.sessionId
      : "anonymous";
  const locale: Locale =
    typeof body?.locale === "string" && isLocale(body.locale)
      ? body.locale
      : "fr";

  if (!message) {
    return Response.json({ error: "message_required" }, { status: 400 });
  }

  const user = await getCurrentUser();
  const result = await generalReply({
    message,
    locale,
    userId: user?.id ?? null,
    sessionId,
  }).catch((error) => {
    console.error("[chat:general] agent error", error);
    return null;
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(sse(event, data));
        } catch {
          // flux fermé
        }
      };

      try {
        send("meta", { sessionId, locale, provider: "general" });

        if (!result) {
          send("error", { message: "agent_error" });
          return;
        }

        for (const chunk of chunkText(result.reply)) {
          send("token", { text: chunk });
          await sleep(18);
        }

        if (result.sources.length > 0) {
          send("sources", { sources: result.sources });
        }

        if (result.route) {
          send("route", { route: result.route });
        }

        if (result.requiresSignIn) {
          send("signin", {
            url: `/login?next=${encodeURIComponent(`/${locale}/account`)}`,
          });
        }

        if (result.ticket) {
          send("ticket", { ticket: result.ticket });
        }

        send("done", { intent: "general" });
      } finally {
        try {
          controller.close();
        } catch {
          // déjà fermé
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
