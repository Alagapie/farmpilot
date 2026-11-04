import { NextResponse } from "next/server";
import { getLiveForecast } from "@/lib/farmdata";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }
  const forecast = await getLiveForecast(lat, lon);
  if (!forecast) return NextResponse.json({ error: "Forecast unavailable" }, { status: 502 });
  return NextResponse.json(forecast);
}
