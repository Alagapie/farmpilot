// Shared state for FarmPilot Connect: every farmer's listings, shared trips and
// bookings live on the server so different farmers (browsers) see each other.
// Stored as a JSON file for local use; swap for a hosted database to deploy.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CropId } from "@/data/crops";
import { DEMO_LISTINGS, UNIT_KG, type Unit } from "@/data/connect-seed";

export type Grade = { grade: "A" | "B" | "C"; count?: number; ripePct?: number; uniformity?: number; note: string };

export interface Listing {
  id: string;
  farmerId: string;
  farmer: string;
  crop: CropId;
  quantity: number;
  unit: Unit;
  kg: number;
  lat: number;
  lon: number;
  place: string;
  readyFrom: string; // YYYY-MM-DD
  grade: Grade | null;
  demo: boolean;
  status: "open" | "booked" | "delivered";
  tripId: string | null;
  createdAt: string;
}

export type TripStatus = "booked" | "picked_up" | "delivered" | "paid";

export interface Trip {
  id: string;
  vehicleId: string;
  marketId: string;
  date: string;
  listingIds: string[];
  route: [number, number][];
  km: number;
  cost: number;
  shares: Record<string, number>; // listingId → naira
  revenue: Record<string, number>; // listingId → expected sale
  status: TripStatus;
  createdAt: string;
}

export interface Booking {
  id: string;
  kind: "storage" | "equipment";
  resourceId: string;
  farmerId: string;
  farmer: string;
  quantity: number;
  from: string;
  to: string;
  cost: number;
  status: "booked" | "cancelled";
  createdAt: string;
}

interface Db {
  seededOn: string;
  listings: Listing[];
  trips: Trip[];
  bookings: Booking[];
}

const FILE = path.join(process.cwd(), ".cache", "connect.json");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const addDays = (iso: string, d: number) => {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function demoListings(): Listing[] {
  return DEMO_LISTINGS.map((d, i) => ({
    id: `demo-${i}`,
    farmerId: `demo-farmer-${i}`,
    farmer: d.farmer,
    crop: d.crop,
    quantity: d.quantity,
    unit: d.unit,
    kg: d.quantity * UNIT_KG[d.unit],
    lat: d.lat,
    lon: d.lon,
    place: "near Shika, Giwa",
    readyFrom: addDays(today(), d.readyInDays),
    grade: d.grade ? { grade: d.grade, note: "Demo grade" } : null,
    demo: true,
    status: "open",
    tripId: null,
    createdAt: new Date().toISOString(),
  }));
}

let chain: Promise<unknown> = Promise.resolve();

async function load(): Promise<Db> {
  let db: Db;
  try {
    db = JSON.parse(await readFile(FILE, "utf8")) as Db;
  } catch {
    db = { seededOn: "", listings: [], trips: [], bookings: [] };
  }
  // Refresh demo neighbours each day so their produce is always "ready soon".
  if (db.seededOn !== today()) {
    const bookedDemo = new Set(db.listings.filter((l) => l.demo && l.status !== "open").map((l) => l.id));
    db.listings = [...db.listings.filter((l) => !l.demo || bookedDemo.has(l.id)), ...demoListings().filter((l) => !bookedDemo.has(l.id))];
    db.seededOn = today();
  }
  return db;
}

async function save(db: Db) {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(db, null, 2));
}

/** Read the store. */
export function read(): Promise<Db> {
  return (chain = chain.then(load, load)) as Promise<Db>;
}

/** Change the store; writes are serialised so concurrent requests don't clobber each other. */
export function update<T>(fn: (db: Db) => T): Promise<T> {
  const run = async () => {
    const db = await load();
    const result = fn(db);
    await save(db);
    return result;
  };
  const p = chain.then(run, run);
  chain = p;
  return p;
}

/** Put the demo network back to its starting state (for rehearsing a demo). */
export function resetDemo(farmerId?: string) {
  return update((db) => {
    db.trips = farmerId ? db.trips.filter((t) => !t.listingIds.some((id) => db.listings.find((l) => l.id === id)?.farmerId === farmerId)) : [];
    db.listings = [...db.listings.filter((l) => !l.demo && (!farmerId || l.farmerId !== farmerId)), ...demoListings()];
    db.bookings = farmerId ? db.bookings.filter((b) => b.farmerId !== farmerId) : [];
    db.seededOn = today();
  });
}
