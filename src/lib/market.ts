// Sell-or-store: seasonal price patterns (from WFP market history, inflation
// removed) applied to today's price and this farmer's expected harvest.
import seasonality from "@/data/seasonality.json";
import { CROPS, type CropId } from "@/data/crops";
import type { Price } from "./prices";

export interface CropSeason {
  index: number[]; // 12 months, mean 1
  observations: number;
  series: number;
  markets: number;
}

interface SeasonalityFile {
  source: string;
  sourceUrl: string;
  period: string | null;
  generatedAt: string | null;
  regions: Record<string, Partial<Record<CropId, CropSeason>>>;
}

export const SEASONALITY = seasonality as SeasonalityFile;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// How each crop can be held back from sale.
const STORAGE: Record<CropId, { method: string; lossPerMonth: number; bagPerUnit: number; maxMonths: number } | null> = {
  maize: { method: "hermetic (PICS) bags", lossPerMonth: 0.005, bagPerUnit: 1, maxMonths: 8 },
  sorghum: { method: "hermetic (PICS) bags", lossPerMonth: 0.005, bagPerUnit: 1, maxMonths: 8 },
  soybean: { method: "hermetic (PICS) bags", lossPerMonth: 0.005, bagPerUnit: 1, maxMonths: 6 },
  rice: { method: "hermetic (PICS) bags", lossPerMonth: 0.005, bagPerUnit: 1, maxMonths: 8 },
  cassava: { method: "leaving roots in the ground", lossPerMonth: 0.01, bagPerUnit: 0, maxMonths: 4 },
  tomato: null, // perishable within days
};

export const regionFor = (lat: number) => (lat >= 9 ? "north" : "south");

export function seasonFor(crop: CropId, lat: number): CropSeason | null {
  const region = regionFor(lat);
  return SEASONALITY.regions[region]?.[crop] ?? SEASONALITY.regions[region === "north" ? "south" : "north"]?.[crop] ?? null;
}

export interface StoreOption {
  month: number; // 0–11
  monthsStored: number;
  price: number;
  sellable: number;
  revenue: number;
  storageCost: number;
  net: number;
  gainVsHarvest: number;
}

export interface SellOrStore {
  crop: CropId;
  unit: string;
  harvestMonth: number;
  todayMonth: number;
  todayPrice: number;
  harvestPrice: number;
  storage: (typeof STORAGE)[CropId];
  options: StoreOption[];
  best: StoreOption | null;
  season: CropSeason;
}

/**
 * Compare selling at harvest with storing for each later month.
 * Prices are in today's naira: the index removes inflation, so real market
 * prices will usually be higher by the inflation rate as well.
 */
export function sellOrStore(crop: CropId, lat: number, harvestIso: string, sellable: number, prices: Price[]): SellOrStore | null {
  const season = seasonFor(crop, lat);
  const cropPrice = prices.find((p) => p.key === `crop_${crop}`);
  if (!season || !cropPrice?.typical) return null;
  const idx = season.index;
  const todayMonth = new Date().getMonth();
  const harvestMonth = new Date(`${harvestIso}T12:00:00`).getMonth();
  const todayPrice = cropPrice.typical;
  const harvestPrice = (todayPrice * idx[harvestMonth]) / idx[todayMonth];
  const storage = STORAGE[crop];
  const bagPrice = prices.find((p) => p.key === "hermetic_bag")?.typical ?? 0;

  const atHarvest = sellable * harvestPrice;
  const options: StoreOption[] = [];
  const maxMonths = storage?.maxMonths ?? 0;
  for (let k = 0; k <= maxMonths; k++) {
    const month = (harvestMonth + k) % 12;
    const price = (harvestPrice * idx[month]) / idx[harvestMonth];
    const kept = k === 0 ? sellable : sellable * (1 - (storage?.lossPerMonth ?? 0) * k);
    const storageCost = k === 0 || !storage ? 0 : Math.ceil(sellable * storage.bagPerUnit) * bagPrice;
    const revenue = kept * price;
    const net = revenue - storageCost;
    options.push({ month, monthsStored: k, price: Math.round(price), sellable: Math.round(kept * 10) / 10, revenue: Math.round(revenue), storageCost, net: Math.round(net), gainVsHarvest: Math.round(net - atHarvest) });
  }
  const best = options.reduce<StoreOption | null>((b, o) => (o.gainVsHarvest > (b?.gainVsHarvest ?? 0) ? o : b), null);
  return { crop, unit: CROPS[crop].yieldUnit, harvestMonth, todayMonth, todayPrice, harvestPrice: Math.round(harvestPrice), storage, options, best, season };
}
