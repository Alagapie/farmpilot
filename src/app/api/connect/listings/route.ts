import { NextResponse } from "next/server";
import { CROPS, type CropId } from "@/data/crops";
import { UNIT_KG, type Unit } from "@/data/connect-seed";
import { newId, update, type Grade, type Listing } from "@/lib/connect-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const b = (await req.json()) as {
    farmerId: string;
    farmer: string;
    crop: CropId;
    quantity: number;
    unit: Unit;
    lat: number;
    lon: number;
    place: string;
    readyFrom: string;
    grade?: Grade | null;
  };
  if (!b.farmerId || !CROPS[b.crop] || !(b.quantity > 0) || !UNIT_KG[b.unit] || !/^\d{4}-\d{2}-\d{2}$/.test(b.readyFrom)) {
    return NextResponse.json({ error: "farmerId, crop, quantity, unit and readyFrom are required" }, { status: 400 });
  }
  const listing: Listing = {
    id: newId("lst"),
    farmerId: b.farmerId,
    farmer: b.farmer || "Farmer",
    crop: b.crop,
    quantity: b.quantity,
    unit: b.unit,
    kg: b.quantity * UNIT_KG[b.unit],
    lat: b.lat,
    lon: b.lon,
    place: b.place,
    readyFrom: b.readyFrom,
    grade: b.grade ?? null,
    demo: false,
    status: "open",
    tripId: null,
    createdAt: new Date().toISOString(),
  };
  await update((db) => db.listings.push(listing));
  return NextResponse.json(listing);
}

export async function DELETE(req: Request) {
  const { id, farmerId } = (await req.json()) as { id: string; farmerId: string };
  const removed = await update((db) => {
    const before = db.listings.length;
    db.listings = db.listings.filter((l) => !(l.id === id && l.farmerId === farmerId && l.status === "open"));
    return before !== db.listings.length;
  });
  return NextResponse.json({ removed });
}
