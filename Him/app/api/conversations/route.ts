import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureLocalUser } from "@/lib/user";
import { parseJson } from "@/lib/utils";

export async function GET() {
  await ensureLocalUser();
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });
  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      title: c.title,
      summary: c.summary,
      coverImageUrl: c.coverImageUrl,
      moodTags: parseJson<string[]>(c.moodTags, []),
      createdAt: c.createdAt,
      messageCount: c._count.messages,
    }))
  );
}

export async function POST(req: NextRequest) {
  const user = await ensureLocalUser();
  const body = await req.json().catch(() => ({}));
  const conversation = await prisma.conversation.create({
    data: {
      userId: user.id,
      title: body.title || "New Conversation",
      aiProvider: body.aiProvider || process.env.DEFAULT_AI_PROVIDER || "openai",
      voiceConfig: JSON.stringify(body.voiceConfig || {}),
    },
  });
  return NextResponse.json(conversation);
}
