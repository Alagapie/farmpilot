import { NextResponse } from "next/server";
import { SEASONALITY, sellOrStore } from "@/lib/market";
import type { PlanResult } from "@/lib/plan";
import { getPriceSheet } from "@/lib/prices";
import type { Farm } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// Sell-or-store analysis for every crop in the farmer's plan.
export async function POST(req: Request) {
  const { farm } = (await req.json()) as { farm: Farm };
  const plan = farm.plan as PlanResult | undefined;
  if (!plan?.details) return NextResponse.json({ error: "Build a season plan first" }, { status: 400 });
  try {
    const sheet = await getPriceSheet(farm.data.place.state ?? "Nigeria");
    // Keep any selling prices the farmer typed in the plan.
    const prices = sheet.prices.map((p) => plan.prices.prices.find((q) => q.key === p.key && q.edited) ?? p);
    const crops = plan.details.map((d) => ({
      crop: d.allocation.crop,
      analysis: sellOrStore(d.allocation.crop, farm.lat, d.harvestFrom, d.economics.scenarios.expected.sellable, prices),
      price: prices.find((p) => p.key === `crop_${d.allocation.crop}`) ?? null,
      bag: prices.find((p) => p.key === "hermetic_bag") ?? null,
    }));
    return NextResponse.json({ crops, data: { source: SEASONALITY.source, sourceUrl: SEASONALITY.sourceUrl, period: SEASONALITY.period }, pricesFetchedAt: sheet.fetchedAt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
