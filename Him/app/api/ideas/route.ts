import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureLocalUser } from "@/lib/user";
import { enhanceIdea } from "@/lib/ai";
import { parseJson } from "@/lib/utils";

export async function GET() {
  await ensureLocalUser();
  const ideas = await prisma.idea.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    ideas.map((i) => ({
      ...i,
      enhancedContent: parseJson(i.enhancedContent, {}),
      tags: parseJson<string[]>(i.tags, []),
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await ensureLocalUser();
  const { rawContent, conversationId, messageId, tags } = await req.json();
  if (!rawContent) return NextResponse.json({ error: "No content" }, { status: 400 });

  const idea = await prisma.idea.create({
    data: {
      userId: user.id,
      rawContent,
      conversationId: conversationId || null,
      messageId: messageId || null,
      tags: JSON.stringify(tags || []),
    },
  });
  return NextResponse.json({ ...idea, tags: [], enhancedContent: {} });
}

export async function PUT(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "No id" }, { status: 400 });

  const idea = await prisma.idea.findUnique({ where: { id } });
  if (!idea) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stream = await enhanceIdea(idea.rawContent);
  let enhanced = "";

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        enhanced += chunk;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "text", content: chunk })}\n\n`));
      }
      await prisma.idea.update({
        where: { id },
        data: {
          enhancedContent: JSON.stringify({ text: enhanced }),
          status: "enhanced",
        },
      });
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
      controller.close();
    },
  });

  return new Response(responseStream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
