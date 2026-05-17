import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audio = formData.get("audio") as File;
  if (!audio) return NextResponse.json({ error: "No audio" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 503 });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const transcription = await client.audio.transcriptions.create({
      file: audio,
      model: "whisper-1",
    });
    return NextResponse.json({ text: transcription.text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "STT failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
