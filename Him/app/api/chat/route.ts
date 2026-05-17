import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { streamChat, translateText, generateConversationTitle } from "@/lib/ai";
import { ensureLocalUser } from "@/lib/user";
import { ROLES, DEFAULT_ROLE } from "@/lib/roles";
import type { AIProvider, ChatMessage } from "@/lib/types";

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, obj: object) =>
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

  // parse body before stream (req.json() can only be called once)
  const body = await req.json().catch(() => ({}));
  const { conversationId, message, provider } = body;

  const responseStream = new ReadableStream({
    async start(controller) {
      try {
        const user = await ensureLocalUser();

        let convId = conversationId;
        if (!convId) {
          const conv = await prisma.conversation.create({
            data: { userId: user.id, aiProvider: provider || "anthropic" },
          });
          convId = conv.id;
        }

        await prisma.message.create({
          data: { conversationId: convId, role: "user", contentPrimary: message },
        });

        const history = await prisma.message.findMany({
          where: { conversationId: convId },
          orderBy: { createdAt: "asc" },
          take: 20,
        });

        const messages: ChatMessage[] = history.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.contentPrimary,
        }));

        const aiProvider = (provider || process.env.DEFAULT_AI_PROVIDER || "anthropic") as AIProvider;

        // get conversation role and system prompt
        const conv = await prisma.conversation.findUnique({ where: { id: convId } });
        const roleId = (conv?.role || DEFAULT_ROLE) as keyof typeof ROLES;
        const role = ROLES[roleId] || ROLES[DEFAULT_ROLE];

        send(controller, { type: "meta", conversationId: convId });

        const stream = await streamChat(messages, aiProvider, role.systemPrompt);
        const reader = stream.getReader();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          fullText += chunk;
          send(controller, { type: "text", content: chunk });
        }

        const saved = await prisma.message.create({
          data: { conversationId: convId, role: "assistant", contentPrimary: fullText },
        });

        // AI already returns bilingual (English + Chinese), split by blank line
        const parts = fullText.split(/\n\n+/);
        // find the Chinese part (contains CJK characters)
        const chinesePart = parts.find((p) => /[一-龥]/.test(p)) || "";
        const englishPart = parts.find((p) => !/[一-龥]/.test(p)) || "";

        if (chinesePart) {
          await prisma.message.update({ where: { id: saved.id }, data: { contentSecondary: chinesePart } });
          send(controller, { type: "translation", content: chinesePart });
        }

        // TTS uses English part only
        if (englishPart) {
          send(controller, { type: "tts_text", content: englishPart });
        }

        const msgCount = await prisma.message.count({ where: { conversationId: convId } });
        if (msgCount === 4) {
          const title = await generateConversationTitle(messages).catch(() => "");
          if (title) {
            await prisma.conversation.update({ where: { id: convId }, data: { title } });
            send(controller, { type: "title", content: title });
          }
        }

        send(controller, { type: "done", messageId: saved.id });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", content: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
