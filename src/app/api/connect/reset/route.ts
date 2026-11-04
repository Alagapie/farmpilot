import { NextResponse } from "next/server";
import { resetDemo } from "@/lib/connect-store";

export const runtime = "nodejs";

// Clears one farmer's Connect activity and restores the demo neighbours.
export async function POST(req: Request) {
  const { farmerId } = (await req.json()) as { farmerId?: string };
  await resetDemo(farmerId);
  return NextResponse.json({ ok: true });
}
