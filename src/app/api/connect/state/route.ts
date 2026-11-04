import { NextResponse } from "next/server";
import { EQUIPMENT, MARKETS, STORAGE_SITES, VEHICLES } from "@/data/connect-seed";
import { read } from "@/lib/connect-store";

export const runtime = "nodejs";

// Everything one farmer's Connect screen needs: the open network plus their own activity.
export async function GET(req: Request) {
  const farmerId = new URL(req.url).searchParams.get("farmerId") ?? "";
  const db = await read();
  const mine = db.listings.filter((l) => l.farmerId === farmerId);
  const myIds = new Set(mine.map((l) => l.id));
  return NextResponse.json({
    listings: db.listings.filter((l) => l.status === "open" || l.farmerId === farmerId),
    trips: db.trips.filter((t) => t.listingIds.some((id) => myIds.has(id))),
    bookings: db.bookings.filter((b) => b.farmerId === farmerId),
    allBookings: db.bookings.filter((b) => b.status === "booked").map(({ resourceId, from, to, quantity }) => ({ resourceId, from, to, quantity })),
    network: { markets: MARKETS, vehicles: VEHICLES, storage: STORAGE_SITES, equipment: EQUIPMENT },
  });
}
