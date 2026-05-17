import type { AIProvider, ChatMessage } from "./types";

const MODEL_MAP: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-6",
  openai: "gpt-4o",
};

function getBaseUrl(provider: AIProvider): string {
  if (provider === "anthropic") {
    const base = (process.env.HIM_ANTHROPIC_BASE_URL || "").replace(/\/+$/, "");
    return `${base}/v1`;
  }
  return "https://api.openai.com/v1";
}

function getApiKey(provider: AIProvider): string {
  return provider === "anthropic"
    ? process.env.HIM_ANTHROPIC_API_KEY || ""
    : process.env.OPENAI_API_KEY || "";
}

async function chatRequest(
  provider: AIProvider,
  body: Record<string, unknown>
): Promise<Response> {
  const url = `${getBaseUrl(provider)}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey(provider)}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status} ${err}`);
  }
  return res;
}

export async function streamChat(
  messages: ChatMessage[],
  provider: AIProvider = "openai",
  systemPrompt?: string
): Promise<ReadableStream<Uint8Array>> {
  const allMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))]
    : messages.map((m) => ({ role: m.role, content: m.content }));
  const res = await chatRequest(provider, {
    model: MODEL_MAP[provider],
    stream: true,
    messages: allMessages,
  });
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += dec.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content ?? "";
            if (text) controller.enqueue(enc.encode(text));
          } catch { /* skip malformed chunks */ }
        }
      }
      controller.close();
    },
  });
}

export async function translateText(text: string, targetLang = "en"): Promise<string> {
  const provider = (process.env.DEFAULT_AI_PROVIDER as AIProvider) || "openai";
  const model = provider === "anthropic" ? "claude-sonnet-4-6" : "gpt-4o-mini";
  const prompt = `Translate the following text to ${targetLang === "en" ? "English" : "Chinese"}. Return only the translation, no explanation:\n\n${text}`;
  const res = await chatRequest(provider, {
    model,
    messages: [{ role: "user", content: prompt }],
  });
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

export async function enhanceIdea(rawContent: string): Promise<ReadableStream<Uint8Array>> {
  const provider = (process.env.DEFAULT_AI_PROVIDER as AIProvider) || "openai";
  const systemPrompt = `You are a creative thinking partner. When given a raw idea, help expand and enhance it with:
1. Core insight (1-2 sentences)
2. 3 ways to develop it further
3. Potential challenges
4. An inspiring question to explore

Respond in the same language as the input. Be concise and inspiring.`;

  return streamChat(
    [{ role: "user", content: rawContent }],
    provider
  );
}

export async function generateConversationTitle(messages: ChatMessage[]): Promise<string> {
  const provider = (process.env.DEFAULT_AI_PROVIDER as AIProvider) || "openai";
  const content = messages.slice(0, 4).map((m) => `${m.role}: ${m.content}`).join("\n");
  const prompt = `Generate a short, evocative title (max 8 words) for this conversation. Return only the title:\n\n${content}`;

  const stream = await streamChat([{ role: "user", content: prompt }], provider);
  const reader = stream.getReader();
  let title = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    title += new TextDecoder().decode(value);
  }
  return title.trim().replace(/^["']|["']$/g, "");
}
