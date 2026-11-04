import { NextResponse } from "next/server";
import { update, type TripStatus } from "@/lib/connect-store";

export const runtime = "nodejs";

const NEXT: Record<TripStatus, TripStatus | null> = { booked: "picked_up", picked_up: "delivered", delivered: "paid", paid: null };

// Demo only: moves a shipment to its next step (in a live service the driver
// app and buyer's payment would do this).
export async function POST(req: Request) {
  const { tripId } = (await req.json()) as { tripId: string };
  const trip = await update((db) => {
    const t = db.trips.find((x) => x.id === tripId);
    if (!t || !NEXT[t.status]) return t ?? null;
    t.status = NEXT[t.status]!;
    if (t.status === "delivered") for (const l of db.listings) if (t.listingIds.includes(l.id)) l.status = "delivered";
    return t;
  });
  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  return NextResponse.json(trip);
}
