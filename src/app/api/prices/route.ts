import { NextResponse } from "next/server";
import { getPriceSheet } from "@/lib/prices";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const state = searchParams.get("state")?.trim() || "Nigeria";
  try {
    return NextResponse.json(await getPriceSheet(state, { fresh: searchParams.get("fresh") === "1" }));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
