import { NextResponse } from "next/server";
import { MODELS } from "@/lib/meta";

export const runtime = "nodejs";

// Forwards a WAV recording to Muse Voice Transcribe; the browser converts its
// recording to 16kHz mono WAV first.
export async function POST(req: Request) {
  const audio = await req.blob();
  if (!audio.size) return NextResponse.json({ error: "No audio" }, { status: 400 });
  const form = new FormData();
  form.append("request", new Blob([JSON.stringify({ model: MODELS.voice, audioEncoding: "WAV", mode: "PUSH_TO_TALK" })], { type: "application/json" }));
  form.append("audio", new Blob([await audio.arrayBuffer()], { type: "audio/wav" }), "question.wav");
  const res = await fetch("https://api.meta.ai/v1/asr/transcribe", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, Accept: "application/json" },
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as { transcript?: string; error?: { message?: string } };
  if (!res.ok) return NextResponse.json({ error: data.error?.message ?? `Transcription failed (${res.status})` }, { status: 502 });
  return NextResponse.json({ transcript: data.transcript ?? "" });
}
