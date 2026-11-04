import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Place search for the map, proxied so we can send a proper User-Agent to Nominatim.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json([]);
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=ng&format=json&limit=5`,
    { headers: { "User-Agent": "FarmPilot/0.1 (hackathon demo)" } },
  );
  if (!res.ok) return NextResponse.json([]);
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[];
  return NextResponse.json(rows.map((r) => ({ label: r.display_name, lat: Number(r.lat), lon: Number(r.lon) })));
}
