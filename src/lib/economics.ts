// The one financial engine. Every naira shown anywhere in FarmPilot comes from
// here: quantities, costs and earnings are computed from the knowledge base and
// the price sheet, never by the language model.
import { CROPS, type CostCategory, type CropId, type PriceKey } from "@/data/crops";
import type { Price } from "./prices";
import type { Farm } from "./types";

export interface CostLine {
  item: PriceKey;
  label: string;
  category: CostCategory;
  quantity: number;
  unit: string;
  unitPrice: number;
  cost: number;
  when: string;
  note?: string;
}

export interface Scenario {
  harvest: number; // units harvested
  sellable: number; // after post-harvest losses
  price: number; // naira per unit
  revenue: number;
  margin: number; // revenue minus listed costs
}

export interface CropEconomics {
  crop: CropId;
  hectares: number;
  lines: CostLine[];
  totalCost: number;
  unit: string; // harvest unit
  postHarvestLoss: number;
  scenarios: { low: Scenario; expected: Scenario; high: Scenario };
  monthsOnLand: number;
  /** Expected margin per month the land is occupied, for fair comparison. */
  marginPerMonth: number;
  /** Expected margin per naira spent. */
  returnOnCost: number;
}

export interface Suitability {
  crop: CropId;
  zoneFit: "good" | "possible" | "poor";
  rainOk: boolean;
  seasonOk: boolean;
  /** Something the farmer must confirm before this crop makes sense. */
  condition: string | null;
  notes: string[];
}

/** Who does the farm work; family labour is not a cash cost. */
export type LabourMode = "family" | "mixed" | "hired";
export const HIRED_SHARE: Record<LabourMode, number> = { family: 0.2, mixed: 0.5, hired: 1 };

export interface EconomicsContext {
  experience: Farm["experience"];
  prices: Price[];
  labour: LabourMode;
  /** Soil total nitrogen in g/kg, used to trim nitrogen top-dressing. */
  soilNitrogen?: number | null;
}

const priceOf = (prices: Price[], key: PriceKey) => prices.find((p) => p.key === key);

// Fertilizer is commonly sold by the measure in local markets, so bags and litres
// are costed to the nearest tenth; seed packs, sachets and stem bundles come whole.
const buyable = (qty: number, unit: string) => (/pack|bundle|sachet/.test(unit) ? Math.ceil(qty - 1e-9) : Math.ceil(qty * 10 - 1e-9) / 10);

/** Share of the standard nitrogen top-dressing to apply given soil nitrogen. */
export function nitrogenFactor(soilN: number | null | undefined) {
  if (soilN == null) return 1;
  if (soilN >= 2) return 0.5;
  if (soilN >= 1) return 0.75;
  return 1;
}

export function cropEconomics(crop: CropId, hectares: number, ctx: EconomicsContext): CropEconomics {
  const c = CROPS[crop];
  const { prices } = ctx;
  const line = (item: PriceKey, label: string, category: CostCategory, rawQty: number, when: string, note?: string): CostLine => {
    const p = priceOf(prices, item);
    const unit = p?.unit ?? "";
    const quantity = buyable(rawQty, unit);
    const unitPrice = p?.typical ?? 0;
    return { item, label, category, quantity, unit, unitPrice, cost: Math.round(quantity * unitPrice), when, note };
  };

  const nFactor = nitrogenFactor(ctx.soilNitrogen);
  const lines: CostLine[] = c.inputs.map((i) =>
    line(
      i.item,
      i.label,
      i.category,
      i.perHa * hectares * (i.nitrogen ? nFactor : 1),
      i.when,
      i.nitrogen && nFactor < 1 ? `Reduced to ${Math.round(nFactor * 100)}% of the standard rate because your soil already has some nitrogen.` : i.note,
    ),
  );

  if (c.needsPloughing) {
    lines.push(line("ploughing", "Tractor ploughing & harrowing", "Land & labour", hectares, "Before planting", "Some operators charge a minimum fee for small plots."));
  }
  const days = c.labourDaysPerHa * hectares * HIRED_SHARE[ctx.labour];
  lines.push(
    line(
      "labour_day",
      ctx.labour === "hired" ? "Hired labour (planting, weeding, harvest, threshing)" : "Hired help (the rest is family labour)",
      "Land & labour",
      Math.ceil(days),
      "Through the season",
    ),
  );

  const [yLow, yExp, yHigh] = c.yieldPerHa[ctx.experience].map((y) => y * hectares);
  // Packaging and transport are bought for the expected harvest.
  const sellableExpected = yExp * (1 - c.postHarvestLoss);
  if (c.packaging) {
    lines.push(line(c.packaging.item, c.packaging.label, "Harvest & selling", Math.ceil(sellableExpected * c.packaging.perUnit), "At harvest"));
  }
  lines.push(
    line(
      "transport_bag",
      "Transport to market",
      "Harvest & selling",
      Math.ceil(sellableExpected * c.transportPerUnit),
      "When selling",
      c.transportPerUnit !== 1 ? `Counted as ${c.transportPerUnit} bag-loads per ${c.yieldUnit.replace(/s?\s*\(.*\)$/, "")}.` : undefined,
    ),
  );

  const totalCost = lines.reduce((s, l) => s + l.cost, 0);
  const cp = priceOf(prices, `crop_${crop}` as PriceKey);
  const typical = cp?.typical ?? 0;
  const scenario = (harvest: number, price: number): Scenario => {
    const sellable = Math.round(harvest * (1 - c.postHarvestLoss) * 10) / 10;
    const revenue = Math.round(sellable * price);
    return { harvest: Math.round(harvest * 10) / 10, sellable, price, revenue, margin: revenue - totalCost };
  };
  // Worst case pairs a poor harvest with a low price; best case a good harvest with a high price.
  const scenarios = {
    low: scenario(yLow, cp?.low || typical),
    expected: scenario(yExp, typical),
    high: scenario(yHigh, cp?.high || typical),
  };

  return {
    crop,
    hectares,
    lines,
    totalCost,
    unit: c.yieldUnit,
    postHarvestLoss: c.postHarvestLoss,
    scenarios,
    monthsOnLand: c.monthsOnLand,
    marginPerMonth: Math.round(scenarios.expected.margin / c.monthsOnLand),
    returnOnCost: totalCost ? scenarios.expected.margin / totalCost : 0,
  };
}

export function suitability(crop: CropId, farm: Farm, irrigation: boolean): Suitability {
  const c = CROPS[crop];
  const { zone, climate } = farm.data;
  const zoneFit = c.zones.good.includes(zone) ? "good" : c.zones.possible.includes(zone) ? "possible" : "poor";
  const rain = climate?.annualRainMm ?? 0;
  const rainyDays = (climate?.rainyMonths.length ?? 0) * 30;
  const notes: string[] = [];
  const rainOk = crop === "tomato" ? true : rain >= c.minRainMm;
  if (!rainOk) notes.push(`needs about ${c.minRainMm}mm of rain a year; this farm averages ${rain}mm`);
  // Cassava keeps growing through the dry season; tomato here is a dry-season irrigated crop.
  const seasonOk = crop === "cassava" ? rain >= c.minRainMm : crop === "tomato" ? irrigation : rainyDays >= c.growingDays[0];
  if (!seasonOk && crop === "tomato") notes.push("main season here is the dry season, which needs irrigation");
  else if (!seasonOk) notes.push(`needs ${c.growingDays[0]}+ days; the rainy season here is about ${rainyDays} days`);
  // Rice depends on field water we cannot see from satellite data.
  const condition = crop === "rice" && !irrigation ? (c.condition ?? null) : null;
  return { crop, zoneFit, rainOk, seasonOk, condition, notes };
}

/** Simple risk-adjusted score: expected margin, penalised by the worst-case loss and risk levels. */
export function riskAdjusted(e: CropEconomics): number {
  const c = CROPS[e.crop];
  const level = { low: 0, medium: 1, high: 2 };
  const riskPoints = level[c.risk.production] + level[c.risk.market] + level[c.risk.capital];
  const worstLoss = Math.max(0, -e.scenarios.low.margin);
  return Math.round(e.marginPerMonth * c.monthsOnLand - 0.5 * worstLoss - riskPoints * 0.05 * e.totalCost);
}
