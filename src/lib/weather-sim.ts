// Demo weather for dates beyond the real 16-day forecast. It is generated from
// the farm's 25-year monthly averages and is always labelled as simulated.
import type { Climate, ForecastDay } from "./types";

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/** A plausible day of weather for this place and date; the same date always gives the same day. */
export function simulatedDay(climate: Climate, iso: string, place: string): ForecastDay {
  const rand = mulberry32(hash(`${place}:${iso}`));
  const d = new Date(`${iso}T12:00:00`);
  const m = climate.months[d.getMonth()];
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  // Rainy days carry about 12mm on average in the savanna.
  const rainyDays = Math.min(m.rainMm / 12, daysInMonth * 0.8);
  const chance = rainyDays / daysInMonth;
  const rains = rand() < chance;
  const rainMm = rains ? Math.round(-Math.log(1 - rand()) * (m.rainMm / Math.max(rainyDays, 1)) * 10) / 10 : 0;
  return {
    date: iso,
    rainMm,
    rainChance: Math.round(chance * 100),
    tMax: Math.round((m.tMax - (rains ? 2 : 0) + (rand() - 0.5) * 3) * 10) / 10,
    tMin: Math.round((m.tMin + (rand() - 0.5) * 2) * 10) / 10,
    windKmh: Math.round(6 + rand() * 18),
  };
}

/**
 * Weather for `days` days from `from`: real forecast where we have it, simulated
 * beyond it. Each day says which it is.
 */
export function weatherFrom(from: string, days: number, forecast: ForecastDay[], climate: Climate | null, place: string) {
  const out: (ForecastDay & { simulated: boolean })[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(`${from}T12:00:00`);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const real = forecast.find((f) => f.date === iso);
    if (real) out.push({ ...real, simulated: false });
    else if (climate) out.push({ ...simulatedDay(climate, iso, place), simulated: true });
  }
  return out;
}
