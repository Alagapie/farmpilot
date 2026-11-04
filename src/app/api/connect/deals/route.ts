import { NextResponse } from "next/server";
import { read } from "@/lib/connect-store";
import { meta, MODELS } from "@/lib/meta";
import { cropName, findDeals, type Deal } from "@/lib/pooling";
import { getPriceSheet } from "@/lib/prices";

export const runtime = "nodejs";
export const maxDuration = 120;

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

// Muse Spark explains the engine's top deals in plain words; it adds no numbers.
async function explain(deals: Deal[], crop: string, quantity: string) {
  const top = deals.slice(0, 4).map((d) => ({
    market: d.marketName,
    mode: d.mode,
    otherFarmersOnTruck: d.stops.length - 1,
    vehicle: d.vehicle.kind,
    yourTransportShare: naira(d.yourShare),
    sales: naira(d.revenue),
    lossOnRoad: `${Math.round(d.lossPct * 100)}%`,
    youKeep: naira(d.net),
    extraVsBestAlone: naira(d.vsBestSolo),
  }));
  const res = await meta().chat.completions.create({
    model: MODELS.spark,
    reasoning_effort: "low",
    messages: [
      {
        role: "developer",
        content: `You advise a Nigerian smallholder farmer selling ${quantity} of ${crop}. In 2 to 3 short, simple sentences, say which option is best and why, comparing going alone with sharing a truck. Quote only figures from the options given, exactly as written. Mention road losses for fresh produce if they matter. No headings.`,
      },
      { role: "user", content: JSON.stringify(top) },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export async function POST(req: Request) {
  const { listingId, state } = (await req.json()) as { listingId: string; state?: string };
  const db = await read();
  const listing = db.listings.find((l) => l.id === listingId);
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  try {
    const sheet = await getPriceSheet(state || "Kaduna");
    const deals = findDeals(listing, db.listings, sheet.prices);
    const summary = deals.length ? await explain(deals, cropName(listing.crop), `${listing.quantity} ${listing.unit}s`).catch(() => "") : "";
    const price = sheet.prices.find((p) => p.key === `crop_${listing.crop}`);
    return NextResponse.json({ listing, deals, summary, price, pricesFetchedAt: sheet.fetchedAt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
