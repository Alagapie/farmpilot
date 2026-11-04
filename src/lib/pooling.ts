// Logistics matching: for a farmer's produce, compare every market going alone
// against sharing a truck with nearby farmers whose produce is ready at the same
// time. All money comes from this deterministic engine.
import { CROPS, type CropId } from "@/data/crops";
import { MARKETS, UNIT_KG, VEHICLES, type Market, type Vehicle } from "@/data/connect-seed";
import type { Listing } from "./connect-store";
import type { Price } from "./prices";

const ROAD_FACTOR = 1.3; // roads wind; straight-line distance × 1.3
const POOL_RADIUS_KM = 25;
const READY_WINDOW_DAYS = 3;

export function km(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h)) * ROAD_FACTOR;
}

const group = (c: CropId) => (c === "tomato" ? "fresh" : c === "cassava" ? "roots" : "grain");

/** Price sheet units, in kg, so any listing unit can be priced. */
const SHEET_UNIT_KG: Record<CropId, number> = { maize: 100, sorghum: 100, soybean: 100, rice: 100, cassava: 1000, tomato: 50 };

export function pricePerKg(crop: CropId, prices: Price[]) {
  const p = prices.find((x) => x.key === `crop_${crop}`);
  return p?.typical ? p.typical / SHEET_UNIT_KG[crop] : 0;
}

/** Fresh tomato loses value on hot roads; refrigeration slows it down. */
function transitLoss(crop: CropId, tripKm: number, vehicle: Vehicle) {
  if (group(crop) !== "fresh") return 0;
  return Math.min(0.25, (tripKm / 100) * (vehicle.refrigerated ? 0.005 : 0.03));
}

export interface Stop {
  listingId: string;
  farmer: string;
  crop: CropId;
  kg: number;
  quantity: number;
  unit: Listing["unit"];
  lat: number;
  lon: number;
  demo: boolean;
  kmToMarket: number;
}

export interface Deal {
  key: string;
  marketId: string;
  marketName: string;
  marketNote: string;
  mode: "solo" | "shared";
  vehicle: Vehicle;
  stops: Stop[]; // pickup order; yours included
  route: [number, number][];
  tripKm: number;
  tripCost: number;
  yourShare: number;
  /** Every farmer on the truck: listingId → naira. */
  shares: Record<string, number>;
  shareBasis: string;
  pricePerUnit: number;
  revenue: number;
  lossPct: number;
  net: number;
  vsBestSolo: number; // extra naira vs the best option going alone
}

function routeThrough(vehicle: Vehicle, stops: Stop[], market: Market) {
  // Nearest-neighbour pickup order from the truck's base, then to market.
  const left = [...stops];
  const order: Stop[] = [];
  let at: [number, number] = [vehicle.baseLat, vehicle.baseLon];
  while (left.length) {
    left.sort((a, b) => km(at, [a.lat, a.lon]) - km(at, [b.lat, b.lon]));
    const next = left.shift()!;
    order.push(next);
    at = [next.lat, next.lon];
  }
  const points: [number, number][] = [[vehicle.baseLat, vehicle.baseLon], ...order.map((s) => [s.lat, s.lon] as [number, number]), [market.lat, market.lon]];
  let approach = 0;
  for (let i = 0; i < points.length - 1; i++) approach += km(points[i], points[i + 1]);
  // Trucks charge for the trip out plus half the empty return (they look for a return load).
  const back = km([market.lat, market.lon], [vehicle.baseLat, vehicle.baseLon]) * 0.5;
  const tripKm = Math.round(approach + back);
  return { order, points, tripKm, cost: Math.round(Math.max(vehicle.minCharge, vehicle.perKm * tripKm)) };
}

/** Each farmer pays in proportion to the load they put on the truck × how far it travels. */
function split(order: Stop[], cost: number) {
  const weight = order.map((s) => s.kg * Math.max(s.kmToMarket, 1));
  const total = weight.reduce((a, b) => a + b, 0);
  return Object.fromEntries(order.map((s, i) => [s.listingId, Math.round((cost * weight[i]) / total)]));
}

const toStop = (l: Listing, market: Market): Stop => ({
  listingId: l.id,
  farmer: l.farmer,
  crop: l.crop,
  kg: l.kg,
  quantity: l.quantity,
  unit: l.unit,
  lat: l.lat,
  lon: l.lon,
  demo: l.demo,
  kmToMarket: km([l.lat, l.lon], [market.lat, market.lon]),
});

function evaluate(listing: Listing, partners: Listing[], vehicle: Vehicle, market: Market, perKg: number): Omit<Deal, "vsBestSolo" | "key"> | null {
  const load = [listing, ...partners];
  if (load.reduce((s, l) => s + l.kg, 0) > vehicle.capacityKg) return null;
  const stops = load.map((l) => toStop(l, market));
  const { order, points, tripKm, cost } = routeThrough(vehicle, stops, market);
  const shares = split(order, cost);
  const yourShare = shares[listing.id];
  const factor = market.priceFactor[listing.crop] ?? 0;
  const lossPct = transitLoss(listing.crop, km([listing.lat, listing.lon], [market.lat, market.lon]), vehicle);
  const revenue = Math.round(listing.kg * perKg * factor * (1 - lossPct));
  return {
    marketId: market.id,
    marketName: market.name,
    marketNote: market.note,
    mode: partners.length ? "shared" : "solo",
    vehicle,
    stops: order,
    route: points,
    tripKm,
    tripCost: cost,
    yourShare,
    shares,
    shareBasis: "Each farmer pays for their load × the distance it travels.",
    pricePerUnit: Math.round(perKg * factor * UNIT_KG[listing.unit]),
    revenue,
    lossPct,
    net: revenue - yourShare,
  };
}

/** All sensible deals for one listing: per market, the best solo and best shared option. */
export function findDeals(listing: Listing, pool: Listing[], prices: Price[]): Deal[] {
  const perKg = pricePerKg(listing.crop, prices);
  if (!perKg) return [];
  const neighbours = pool
    .filter((l) => l.id !== listing.id && l.status === "open" && l.farmerId !== listing.farmerId)
    .filter((l) => group(l.crop) === group(listing.crop))
    .filter((l) => Math.abs((new Date(l.readyFrom).getTime() - new Date(listing.readyFrom).getTime()) / 86_400_000) <= READY_WINDOW_DAYS)
    .map((l) => ({ l, d: km([listing.lat, listing.lon], [l.lat, l.lon]) }))
    .filter((x) => x.d <= POOL_RADIUS_KM)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.l);

  const deals: Omit<Deal, "vsBestSolo" | "key">[] = [];
  for (const market of MARKETS.filter((m) => m.priceFactor[listing.crop])) {
    // Tomato over long distances only makes sense refrigerated or quickly; let the numbers decide.
    let bestSolo: Omit<Deal, "vsBestSolo" | "key"> | null = null;
    let bestShared: Omit<Deal, "vsBestSolo" | "key"> | null = null;
    for (const vehicle of VEHICLES) {
      const solo = evaluate(listing, [], vehicle, market, perKg);
      if (solo && (!bestSolo || solo.net > bestSolo.net)) bestSolo = solo;
      // Greedily add the nearest compatible neighbours while they fit and keep lowering our share.
      let partners: Listing[] = [];
      let best = solo;
      for (const n of neighbours) {
        const trial = evaluate(listing, [...partners, n], vehicle, market, perKg);
        if (trial && (!best || trial.yourShare < best.yourShare)) {
          partners = [...partners, n];
          best = trial;
        }
      }
      if (best && best.mode === "shared" && (!bestShared || best.net > bestShared.net)) bestShared = best;
    }
    if (bestSolo) deals.push(bestSolo);
    if (bestShared) deals.push(bestShared);
  }

  const baseline = Math.max(...deals.filter((d) => d.mode === "solo").map((d) => d.net), 0);
  return deals
    .map((d) => ({ ...d, key: `${d.marketId}:${d.mode}:${d.vehicle.id}:${d.stops.map((s) => s.listingId).join(",")}`, vsBestSolo: d.net - baseline }))
    .sort((a, b) => b.net - a.net);
}

export const cropName = (c: CropId) => CROPS[c].name;
