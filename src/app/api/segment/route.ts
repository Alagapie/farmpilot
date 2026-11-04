import { NextResponse } from "next/server";
import { segmentField } from "@/lib/sam";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { lat, lon, debug } = await req.json();
  if (typeof lat !== "number" || typeof lon !== "number") {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await segmentField(lat, lon, debug === true));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
