import { NextResponse } from "next/server";
import { read, newId, update, type Trip } from "@/lib/connect-store";
import { findDeals } from "@/lib/pooling";
import { getPriceSheet } from "@/lib/prices";

export const runtime = "nodejs";

// Book a deal: the engine recomputes it from current data (never trusting the
// client's numbers), then every farmer on the truck is booked onto one trip.
export async function POST(req: Request) {
  const { listingId, dealKey, state } = (await req.json()) as { listingId: string; dealKey: string; state?: string };
  const db = await read();
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing || listing.status !== "open") return NextResponse.json({ error: "This produce is no longer open for booking" }, { status: 409 });
  const sheet = await getPriceSheet(state || "Kaduna");
  const deal = findDeals(listing, db.listings, sheet.prices).find((d) => d.key === dealKey);
  if (!deal) return NextResponse.json({ error: "That deal has changed. Please look at the options again." }, { status: 409 });

  const trip: Trip = {
    id: newId("trip"),
    vehicleId: deal.vehicle.id,
    marketId: deal.marketId,
    date: deal.stops.map((s) => db.listings.find((l) => l.id === s.listingId)!.readyFrom).sort().at(-1)!,
    listingIds: deal.stops.map((s) => s.listingId),
    route: deal.route,
    km: deal.tripKm,
    cost: deal.tripCost,
    shares: {},
    revenue: {},
    status: "booked",
    createdAt: new Date().toISOString(),
  };
  // Shares and expected sales for every farmer on the truck, from the same engine.
  for (const stop of deal.stops) {
    const l = db.listings.find((x) => x.id === stop.listingId)!;
    const theirs = l.id === listing.id ? deal : findDeals(l, db.listings, sheet.prices).find((d) => d.marketId === deal.marketId);
    trip.shares[l.id] = deal.shares[l.id];
    trip.revenue[l.id] = theirs?.revenue ?? 0;
  }

  const ok = await update((store) => {
    const ids = new Set(trip.listingIds);
    const taken = store.listings.filter((l) => ids.has(l.id) && l.status !== "open");
    if (taken.length) return false;
    for (const l of store.listings) if (ids.has(l.id)) Object.assign(l, { status: "booked", tripId: trip.id });
    store.trips.push(trip);
    return true;
  });
  if (!ok) return NextResponse.json({ error: "Another farmer on this truck was just booked elsewhere. Please look at the options again." }, { status: 409 });
  return NextResponse.json(trip);
}
