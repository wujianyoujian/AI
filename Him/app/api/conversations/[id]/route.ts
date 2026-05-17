import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseJson } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...conversation,
    moodTags: parseJson(conversation.moodTags, []),
    voiceConfig: parseJson(conversation.voiceConfig, {}),
    musicPlaylist: parseJson(conversation.musicPlaylist, []),
    messages: conversation.messages.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const updated = await prisma.conversation.update({
    where: { id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.summary && { summary: body.summary }),
      ...(body.moodTags && { moodTags: JSON.stringify(body.moodTags) }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.conversation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
