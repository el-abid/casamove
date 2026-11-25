type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ChatOptions = {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

const BASE_URL =
  process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

export const LLM_MODEL =
  process.env.NVIDIA_MODEL ?? "nvidia/nemotron-3.5-bolt-e4b";

export function llmEnabled(): boolean {
  return (
    Boolean(process.env.NVIDIA_API_KEY) && process.env.LLM_ENABLED !== "false"
  );
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string | null> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15_000
  );

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: LLM_MODEL,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 300,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(`[llm] ${response.status} ${body.slice(0, 160)}`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };

    const content = data.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim()
      ? content.trim()
      : null;
  } catch (error) {
    console.warn(
      `[llm] ${error instanceof Error ? error.name : "error"} sur ${LLM_MODEL}`
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatJSON<T>(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<T | null> {
  const text = await chatCompletion(messages, options);
  if (!text) return null;

  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
