// Demo network for FarmPilot Connect around Zaria, Kaduna State.
// Markets are real places; farmers, transporters, storage and equipment are
// fictional demo listings, always labelled as such in the app, so the network
// is never empty in a demo. Real users' listings join the same pool.
import type { CropId } from "./crops";

export type Unit = "crate" | "basket" | "bag" | "tonne";

/** Kilograms per unit, for truck loading. */
export const UNIT_KG: Record<Unit, number> = { crate: 25, basket: 50, bag: 100, tonne: 1000 };

export interface Market {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Price level relative to today's state price, by crop (from market size and role). */
  priceFactor: Partial<Record<CropId, number>>;
  note: string;
}

export const MARKETS: Market[] = [
  { id: "giwa", name: "Giwa market", lat: 11.27, lon: 7.43, priceFactor: { tomato: 0.6, maize: 0.85, sorghum: 0.88, soybean: 0.85, rice: 0.85 }, note: "Village market, few buyers" },
  { id: "zaria", name: "Sabon Gari market, Zaria", lat: 11.11, lon: 7.72, priceFactor: { tomato: 0.8, maize: 0.95, sorghum: 0.95, soybean: 0.95, rice: 0.95 }, note: "Town market" },
  { id: "kaduna", name: "Kaduna Central Market", lat: 10.52, lon: 7.44, priceFactor: { tomato: 0.95, maize: 1.0, sorghum: 1.0, soybean: 1.0, rice: 1.0 }, note: "City market" },
  { id: "dawanau", name: "Dawanau grain market, Kano", lat: 12.05, lon: 8.47, priceFactor: { maize: 1.08, sorghum: 1.08, soybean: 1.1, rice: 1.05 }, note: "West Africa's largest grain market" },
  { id: "yankaba", name: "Yankaba vegetable market, Kano", lat: 12.01, lon: 8.56, priceFactor: { tomato: 1.0 }, note: "Big vegetable wholesale market" },
];

export interface Vehicle {
  id: string;
  owner: string;
  kind: string;
  capacityKg: number;
  perKm: number; // naira per km of the whole trip
  minCharge: number;
  baseLat: number;
  baseLon: number;
  refrigerated: boolean;
  rating: number;
}

export const VEHICLES: Vehicle[] = [
  { id: "v-pickup", owner: "Sani Haulage (demo)", kind: "Pickup van, 1.2 t", capacityKg: 1200, perKm: 650, minCharge: 15000, baseLat: 11.2, baseLon: 7.6, refrigerated: false, rating: 4.6 },
  { id: "v-5t", owner: "Kabir Logistics (demo)", kind: "5-tonne truck", capacityKg: 5000, perKm: 950, minCharge: 40000, baseLat: 11.11, baseLon: 7.72, refrigerated: false, rating: 4.8 },
  { id: "v-10t", owner: "Arewa Movers (demo)", kind: "10-tonne truck", capacityKg: 10000, perKm: 1350, minCharge: 70000, baseLat: 11.08, baseLon: 7.7, refrigerated: false, rating: 4.4 },
  { id: "v-cold", owner: "FreshLine Cold Van (demo)", kind: "Refrigerated van, 2 t", capacityKg: 2000, perKm: 1100, minCharge: 35000, baseLat: 11.11, baseLon: 7.72, refrigerated: true, rating: 4.7 },
];

export interface DemoListing {
  farmer: string;
  crop: CropId;
  quantity: number;
  unit: Unit;
  lat: number;
  lon: number;
  readyInDays: number;
  grade: "A" | "B" | "C" | null;
}

/** Neighbouring demo farmers with produce ready soon. */
export const DEMO_LISTINGS: DemoListing[] = [
  { farmer: "Aisha (demo)", crop: "tomato", quantity: 80, unit: "crate", lat: 11.205, lon: 7.565, readyInDays: 2, grade: "A" },
  { farmer: "Yusuf (demo)", crop: "tomato", quantity: 60, unit: "crate", lat: 11.16, lon: 7.62, readyInDays: 3, grade: "B" },
  { farmer: "Bello (demo)", crop: "tomato", quantity: 45, unit: "crate", lat: 11.235, lon: 7.6, readyInDays: 4, grade: "A" },
  { farmer: "Halima (demo)", crop: "maize", quantity: 30, unit: "bag", lat: 11.19, lon: 7.55, readyInDays: 1, grade: "A" },
  { farmer: "Ibrahim (demo)", crop: "maize", quantity: 25, unit: "bag", lat: 11.14, lon: 7.63, readyInDays: 5, grade: "B" },
  { farmer: "Zainab (demo)", crop: "soybean", quantity: 18, unit: "bag", lat: 11.22, lon: 7.58, readyInDays: 3, grade: "A" },
  { farmer: "Musa K. (demo)", crop: "sorghum", quantity: 22, unit: "bag", lat: 11.17, lon: 7.54, readyInDays: 2, grade: "B" },
];

export interface StorageSite {
  id: string;
  name: string;
  kind: "cold room" | "warehouse";
  lat: number;
  lon: number;
  capacity: number; // units (crates for cold rooms, bags for warehouses)
  unit: Unit;
  pricePerUnitDay: number;
  crops: CropId[];
  tempC: string | null;
  /** How long produce keeps here, vs in the open. */
  keepsDays: Partial<Record<CropId, { open: number; stored: number }>>;
}

export const STORAGE_SITES: StorageSite[] = [
  { id: "s-cold-zaria", name: "Solar cold room, Zaria (demo)", kind: "cold room", lat: 11.1, lon: 7.7, capacity: 300, unit: "crate", pricePerUnitDay: 150, crops: ["tomato"], tempC: "10–13°C", keepsDays: { tomato: { open: 3, stored: 21 } } },
  { id: "s-cold-giwa", name: "Community cold room, Giwa (demo)", kind: "cold room", lat: 11.26, lon: 7.44, capacity: 120, unit: "crate", pricePerUnitDay: 120, crops: ["tomato"], tempC: "10–13°C", keepsDays: { tomato: { open: 3, stored: 18 } } },
  { id: "s-wh-shika", name: "Cooperative warehouse, Shika (demo)", kind: "warehouse", lat: 11.19, lon: 7.58, capacity: 800, unit: "bag", pricePerUnitDay: 8, crops: ["maize", "sorghum", "soybean", "rice"], tempC: null, keepsDays: { maize: { open: 60, stored: 240 }, sorghum: { open: 60, stored: 240 }, soybean: { open: 45, stored: 180 }, rice: { open: 60, stored: 240 } } },
];

export interface Equipment {
  id: string;
  owner: string;
  kind: "irrigation pump" | "tractor" | "thresher" | "sprayer";
  name: string;
  lat: number;
  lon: number;
  rate: number;
  per: "hour" | "hectare" | "day";
  note: string;
}

export const EQUIPMENT: Equipment[] = [
  { id: "e-pump-1", owner: "Garba (demo)", kind: "irrigation pump", name: "3-inch petrol pump + hoses", lat: 11.2, lon: 7.57, rate: 2500, per: "hour", note: "Fuel not included" },
  { id: "e-pump-2", owner: "Shika Youth Co-op (demo)", kind: "irrigation pump", name: "Solar pump kit", lat: 11.18, lon: 7.6, rate: 1500, per: "hour", note: "No fuel needed; daytime only" },
  { id: "e-tractor-1", owner: "Zaria Tractor Hire (demo)", kind: "tractor", name: "75hp tractor with disc plough + harrow", lat: 11.12, lon: 7.7, rate: 62000, per: "hectare", note: "Minimum 1 acre" },
  { id: "e-thresher-1", owner: "Danladi (demo)", kind: "thresher", name: "Multi-crop thresher", lat: 11.21, lon: 7.55, rate: 18000, per: "day", note: "Maize, sorghum, soybean" },
  { id: "e-sprayer-1", owner: "Agro-Dealer Giwa (demo)", kind: "sprayer", name: "16L knapsack sprayer + mask & gloves", lat: 11.27, lon: 7.43, rate: 1500, per: "day", note: "Protective kit included" },
];
