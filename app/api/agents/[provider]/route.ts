import type { NextRequest } from "next/server";

import { isLocale, type Locale } from "@/content/dictionary";
import { getProvider, isProviderId } from "@/content/providers";
import { AGENT_CARDS, providerReply } from "@/lib/agent/general";
import { getCurrentUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ provider: string }> };

export async function GET(_request: NextRequest, { params }: Context) {
  const { provider } = await params;
  if (!isProviderId(provider)) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }

  const config = getProvider(provider)!;
  return Response.json({
    protocol: "a2a-subset",
    id: provider,
    name: AGENT_CARDS[provider].name,
    operator: AGENT_CARDS[provider].operator,
    mode: config.mode.fr,
    capabilities: AGENT_CARDS[provider].capabilities,
    endpoint: `/api/agents/${provider}`,
    languages: ["fr", "ar", "en"],
  });
}

export async function POST(request: NextRequest, { params }: Context) {
  const { provider } = await params;
  if (!isProviderId(provider)) {
    return Response.json({ error: "not-found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return Response.json({ error: "message_required" }, { status: 400 });
  }

  const locale: Locale =
    typeof body?.locale === "string" && isLocale(body.locale)
      ? body.locale
      : "fr";
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.length > 8
      ? body.sessionId
      : `a2a-${provider}`;

  const user = await getCurrentUser();
  const result = await providerReply(
    provider,
    message,
    locale,
    user?.id ?? null,
    sessionId
  );

  return Response.json({
    provider,
    ...result,
  });
}
