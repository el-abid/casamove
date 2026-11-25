import { randomUUID } from "node:crypto";
import { isGraphInterrupt } from "@langchain/langgraph";
import type { NextRequest } from "next/server";

import { isLocale, type Locale } from "@/content/dictionary";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";
import { agentTexts, getGraph } from "@/lib/agent/graph";
import { addTicketMessage, getTicket } from "@/lib/agent/tickets";
import type { Ticket } from "@/lib/agent/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GraphValues = {
  reply?: string;
  sources?: { id: string; title: string; source: string }[];
  ticket?: Ticket | null;
  intent?: string;
};

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

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.length > 8
      ? body.sessionId
      : "anonymous";

  const locale: Locale =
    typeof body?.locale === "string" && isLocale(body.locale)
      ? body.locale
      : "fr";

  const intentHint =
    body?.intentHint === "complaint" ? ("complaint" as const) : null;
  const requestedTicket =
    typeof body?.ticketNumber === "string" ? body.ticketNumber : null;

  if (!message) {
    return Response.json({ error: "message_required" }, { status: 400 });
  }

  const currentUser = await getCurrentUser();

  let activeTicket: Ticket | null = null;
  if (requestedTicket) {
    const candidate = await getTicket(requestedTicket);
    const allowed =
      candidate &&
      (isAdmin(currentUser) ||
        (currentUser && candidate.userId === currentUser.id) ||
        candidate.threadId.startsWith(`${sessionId}:`));

    if (
      allowed &&
      candidate &&
      (candidate.status === "pending" || candidate.status === "in_progress")
    ) {
      activeTicket = candidate;
      await addTicketMessage({
        ticketNumber: candidate.number,
        role: "user",
        body: message,
        authorEmail: currentUser?.email ?? "usager",
      });
    }
  }

  const closureIntent =
    /(^non\b|non.*(c'est bon|merci)|c'est bon|résolu|réglé|no thanks|all good)/i.test(
      message
    );

  const directReply =
    activeTicket && activeTicket.status === "in_progress"
      ? closureIntent
        ? "Merci. L'agent va clôturer le dossier."
        : "Message transmis à l'agent. Il vous répondra ici."
      : activeTicket && activeTicket.status === "pending"
        ? "Votre message a été ajouté au dossier. Un agent vous répondra ici."
        : null;

  // Un thread par message : un dossier en attente de validation ne bloque plus la conversation.
  const threadId = `${sessionId}:${randomUUID()}`;
  const config = { configurable: { thread_id: threadId } };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(sse(event, data));
        } catch {
          closed = true;
        }
      };

      try {
        send("meta", { sessionId, locale });

        if (directReply) {
          for (const chunk of chunkText(directReply)) {
            send("token", { text: chunk });
            await sleep(22);
          }
          if (activeTicket) {
            send("ticket", { ticket: activeTicket });
          }
          send("done", { intent: "support" });
          return;
        }

        const graph = await getGraph();
        let values: GraphValues;

        try {
          values = (await graph.invoke(
            {
              query: message,
              locale,
              sessionId: threadId,
              userId: currentUser?.id ?? null,
              intentHint,
            },
            config
          )) as GraphValues;
        } catch (error) {
          if (!isGraphInterrupt(error)) throw error;
          const interrupted = (await graph.getState(config)) as {
            values: GraphValues;
          };
          values = interrupted.values;
          send("hitl", { ticket: values.ticket ?? null });
        }

        const reply = values.reply ?? agentTexts.fallback[locale];

        for (const chunk of chunkText(reply)) {
          send("token", { text: chunk });
          await sleep(22);
        }

        if (values.sources?.length) {
          send("sources", { sources: values.sources });
        }

        if (values.ticket) {
          send("ticket", { ticket: values.ticket });
        }

        send("done", { intent: values.intent ?? "unknown" });
      } catch (error) {
        console.error("[chat] agent error", error);
        send("error", { message: "agent_error" });
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            // le client a déjà fermé le flux
          }
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
