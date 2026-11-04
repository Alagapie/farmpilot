import { NextResponse } from "next/server";
import { EQUIPMENT, STORAGE_SITES } from "@/data/connect-seed";
import { newId, update, type Booking } from "@/lib/connect-store";

export const runtime = "nodejs";

const days = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1;
const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }) => a.from <= b.to && b.from <= a.to;

// Reserve shared storage space or book shared equipment. Cost and availability
// are checked on the server against everyone's bookings.
export async function POST(req: Request) {
  const b = (await req.json()) as { kind: Booking["kind"]; resourceId: string; farmerId: string; farmer: string; quantity: number; from: string; to: string };
  if (!(b.quantity > 0) || !b.from || !b.to || b.to < b.from) return NextResponse.json({ error: "Choose a quantity and valid dates" }, { status: 400 });

  const result = await update((db): Booking | { error: string } => {
    const active = db.bookings.filter((x) => x.status === "booked" && x.resourceId === b.resourceId && overlaps(x, b));
    let cost: number;
    if (b.kind === "storage") {
      const site = STORAGE_SITES.find((s) => s.id === b.resourceId);
      if (!site) return { error: "Storage site not found" };
      const used = active.reduce((s, x) => s + x.quantity, 0);
      if (used + b.quantity > site.capacity) return { error: `Only ${site.capacity - used} ${site.unit}s of space free for those dates` };
      cost = b.quantity * days(b.from, b.to) * site.pricePerUnitDay;
    } else {
      const item = EQUIPMENT.find((e) => e.id === b.resourceId);
      if (!item) return { error: "Equipment not found" };
      if (active.length) return { error: `Already booked ${active.map((x) => `${x.from} to ${x.to}`).join(", ")}. Pick other dates.` };
      cost = b.quantity * item.rate;
    }
    const booking: Booking = { id: newId("bk"), kind: b.kind, resourceId: b.resourceId, farmerId: b.farmerId, farmer: b.farmer, quantity: b.quantity, from: b.from, to: b.to, cost, status: "booked", createdAt: new Date().toISOString() };
    db.bookings.push(booking);
    return booking;
  });
  if ("error" in result) return NextResponse.json(result, { status: 409 });
  return NextResponse.json(result);
}

export async function DELETE(req: Request) {
  const { id, farmerId } = (await req.json()) as { id: string; farmerId: string };
  await update((db) => {
    const x = db.bookings.find((k) => k.id === id && k.farmerId === farmerId);
    if (x) x.status = "cancelled";
  });
  return NextResponse.json({ ok: true });
}
