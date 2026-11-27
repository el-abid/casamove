import { BASE_URL } from "./env";

export type ApiResult = {
  status: number;
  text: string;
  json: any;
  cookie: string;
  location: string | null;
};

export async function api(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    redirect?: RequestRedirect;
  } = {}
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie) headers.Cookie = options.cookie;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    redirect: options.redirect ?? "manual",
  });

  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [];

  return {
    status: response.status,
    text,
    json,
    cookie: setCookies.map((item) => item.split(";")[0]).join("; "),
    location: response.headers.get("location"),
  };
}

export function parseSse(text: string) {
  const events: { event: string; data: any }[] = [];

  for (const block of text.split("\n\n")) {
    const eventLine = block
      .split("\n")
      .find((line) => line.startsWith("event:"));
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"));

    if (!eventLine || !dataLine) continue;

    try {
      events.push({
        event: eventLine.slice(6).trim(),
        data: JSON.parse(dataLine.slice(5).trim()),
      });
    } catch {
      // événement incomplet
    }
  }

  return events;
}

export async function chat(
  message: string,
  options: {
    locale?: string;
    sessionId?: string;
    cookie?: string;
    provider?: string;
    intentHint?: string;
    ticketNumber?: string;
  } = {}
) {
  const sessionId =
    options.sessionId ??
    `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const result = await api("/api/chat", {
    method: "POST",
    cookie: options.cookie,
    body: {
      message,
      locale: options.locale ?? "fr",
      provider: options.provider ?? "tram",
      sessionId,
      intentHint: options.intentHint,
      ticketNumber: options.ticketNumber,
    },
  });

  const events = parseSse(result.text);
  const reply = events
    .filter((item) => item.event === "token")
    .map((item) => item.data.text)
    .join("");
  const sources = events.find((item) => item.event === "sources")?.data
    .sources as { id: string; title: string; source: string }[] | undefined;
  const ticket = events.find((item) => item.event === "ticket")?.data.ticket;

  return {
    status: result.status,
    events,
    reply,
    sources: sources ?? [],
    ticket,
    sessionId,
  };
}

export async function register(email: string, password = "UserTest2026!") {
  return api("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Usager Test",
      email,
      phone: "0600000000",
      password,
    },
  });
}

export async function login(email: string, password: string) {
  return api("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export function uniqueEmail(prefix = "user") {
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}@test.casamove.ma`;
}
