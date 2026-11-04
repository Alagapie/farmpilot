// Deterministic crop economics: quantities, costs and earnings come from the
// knowledge base and the price sheet, never from the language model.
import { CROPS, type CropId, type PriceKey } from "@/data/crops";
import type { Price } from "./prices";
import type { Farm } from "./types";

export interface CostLine {
  item: PriceKey;
  label: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  cost: number;
  when: string;
}

export interface CropEconomics {
  crop: CropId;
  hectares: number;
  lines: CostLine[];
  totalCost: number;
  harvest: { low: number; expected: number; high: number; unit: string };
  cropPrice: { low: number; typical: number; high: number; unit: string };
  revenue: { low: number; expected: number; high: number };
  profit: { low: number; expected: number; high: number };
}

export interface Suitability {
  crop: CropId;
  zoneFit: "good" | "possible" | "poor";
  rainOk: boolean;
  seasonOk: boolean;
  notes: string[];
}

const priceOf = (prices: Price[], key: PriceKey) => prices.find((p) => p.key === key);

/** Who does the farm work; family labour is not a cash cost. */
export type LabourMode = "family" | "mixed" | "hired";
export const HIRED_SHARE: Record<LabourMode, number> = { family: 0.2, mixed: 0.5, hired: 1 };

// Fertilizer is commonly sold by the measure in local markets, so bags and litres
// are costed to the nearest tenth; seed packs and stem bundles come whole.
const buyable = (qty: number, unit: string) => (/pack|bundle/.test(unit) ? Math.ceil(qty) : Math.ceil(qty * 10 - 1e-9) / 10);

export function cropEconomics(crop: CropId, hectares: number, experience: Farm["experience"], prices: Price[], labourMode: LabourMode = "mixed"): CropEconomics {
  const c = CROPS[crop];
  const lines: CostLine[] = c.inputs.map((input) => {
    const p = priceOf(prices, input.item);
    const unit = p?.unit ?? "";
    const quantity = buyable(input.perHa * hectares, unit);
    const unitPrice = p?.typical ?? 0;
    return { item: input.item, label: input.label, quantity, unit, unitPrice, cost: quantity * unitPrice, when: input.when };
  });

  if (c.needsPloughing) {
    const p = priceOf(prices, "ploughing");
    const unitPrice = p?.typical ?? 0;
    lines.push({ item: "ploughing", label: "Tractor ploughing & harrowing", quantity: hectares, unit: "hectare", unitPrice, cost: Math.round(hectares * unitPrice), when: "Before planting" });
  }
  const labour = priceOf(prices, "labour_day");
  const days = Math.ceil(c.labourDaysPerHa * hectares * HIRED_SHARE[labourMode]);
  lines.push({
    item: "labour_day",
    label: labourMode === "hired" ? "Hired labour (planting, weeding, harvest)" : "Hired help (the rest is family labour)",
    quantity: days,
    unit: "person-days",
    unitPrice: labour?.typical ?? 0,
    cost: days * (labour?.typical ?? 0),
    when: "Through the season",
  });

  const totalCost = lines.reduce((s, l) => s + l.cost, 0);
  const [yLow, yExp, yHigh] = c.yieldPerHa[experience].map((y) => y * hectares);
  const cp = priceOf(prices, `crop_${crop}` as PriceKey);
  const cropPrice = { low: cp?.low || cp?.typical || 0, typical: cp?.typical ?? 0, high: cp?.high || cp?.typical || 0, unit: cp?.unit ?? "" };
  // Worst case pairs a poor harvest with a low price; best case a good harvest with a high price.
  const revenue = { low: yLow * cropPrice.low, expected: yExp * cropPrice.typical, high: yHigh * cropPrice.high };

  return {
    crop,
    hectares,
    lines,
    totalCost,
    harvest: { low: Math.round(yLow), expected: Math.round(yExp), high: Math.round(yHigh), unit: c.yieldUnit },
    cropPrice,
    revenue,
    profit: { low: revenue.low - totalCost, expected: revenue.expected - totalCost, high: revenue.high - totalCost },
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
  return { crop, zoneFit, rainOk, seasonOk, notes };
}
