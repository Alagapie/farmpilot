import { NextResponse } from "next/server";
import { askAgent, type ChatTurn } from "@/lib/agent";
import type { Farm } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const { farm, messages } = (await req.json()) as { farm: Farm; messages: ChatTurn[] };
  if (!farm?.data || !messages?.length) return NextResponse.json({ error: "farm and messages are required" }, { status: 400 });
  try {
    return NextResponse.json(await askAgent(farm, messages));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
