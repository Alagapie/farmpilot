import type { Climate, FarmData, ForecastDay, Place, Soil } from "./types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const UA = { "User-Agent": "FarmPilot/0.1 (hackathon demo)" };

async function getJson<T>(url: string, timeoutMs = 25_000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json() as Promise<T>;
}

function textureClass(sand: number, clay: number): string {
  if (clay >= 40) return "clay";
  if (clay >= 27) return sand > 45 ? "sandy clay loam" : "clay loam";
  if (sand >= 85) return "sand";
  if (sand >= 70) return "loamy sand";
  if (sand >= 52) return "sandy loam";
  return "loam";
}

interface SoilGridsLayer {
  name: string;
  unit_measure: { d_factor: number };
  depths: { range: { top_depth: number; bottom_depth: number }; values: { mean: number | null } }[];
}

export async function getSoil(lat: number, lon: number): Promise<Soil> {
  const props = ["phh2o", "soc", "nitrogen", "clay", "sand", "cec"].map((p) => `property=${p}`).join("&");
  const depths = ["0-5cm", "5-15cm", "15-30cm"].map((d) => `depth=${d}`).join("&");
  const json = await getJson<{ properties: { layers: SoilGridsLayer[] } }>(
    `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&${props}&${depths}&value=mean`,
  );
  // Thickness-weighted mean over the 0-30cm topsoil, converted to conventional units.
  const value = (name: string): number | null => {
    const layer = json.properties.layers.find((l) => l.name === name);
    if (!layer) return null;
    let sum = 0;
    let weight = 0;
    for (const d of layer.depths) {
      if (d.values.mean == null) continue;
      const w = d.range.bottom_depth - d.range.top_depth;
      sum += (d.values.mean / layer.unit_measure.d_factor) * w;
      weight += w;
    }
    return weight ? Math.round((sum / weight) * 100) / 100 : null;
  };
  const sand = value("sand");
  const clay = value("clay");
  return {
    ph: value("phh2o"),
    organicCarbon: value("soc"),
    nitrogen: value("nitrogen"),
    clay,
    sand,
    cec: value("cec"),
    texture: sand != null && clay != null ? textureClass(sand, clay) : "unknown",
  };
}

export async function getClimate(lat: number, lon: number): Promise<Climate> {
  const json = await getJson<{ properties: { parameter: Record<string, Record<string, number>> } }>(
    `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR,T2M_MAX,T2M_MIN&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`,
  );
  const p = json.properties.parameter;
  const months = MONTHS.map((m, i) => ({
    month: m[0] + m.slice(1).toLowerCase(),
    rainMm: Math.round(p.PRECTOTCORR[m] * DAYS[i]),
    tMax: p.T2M_MAX[m],
    tMin: p.T2M_MIN[m],
  }));
  const rainyMonths = months.filter((m) => m.rainMm >= 75).map((m) => m.month);
  return {
    annualRainMm: months.reduce((s, m) => s + m.rainMm, 0),
    months,
    rainyMonths,
    onsetMonth: rainyMonths[0] ?? null,
    cessationMonth: rainyMonths.at(-1) ?? null,
  };
}

export async function getForecast(lat: number, lon: number): Promise<ForecastDay[]> {
  const json = await getJson<{ daily: Record<string, (number | string)[]> }>(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&forecast_days=16&timezone=Africa%2FLagos`,
  );
  const d = json.daily;
  return (d.time as string[]).map((date, i) => ({
    date,
    rainMm: Number(d.precipitation_sum[i] ?? 0),
    rainChance: Number(d.precipitation_probability_max[i] ?? 0),
    tMax: Number(d.temperature_2m_max[i]),
    tMin: Number(d.temperature_2m_min[i]),
    windKmh: Number(d.wind_speed_10m_max[i]),
  }));
}

export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  const json = await getJson<{ address?: Record<string, string> }>(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
  );
  const a = json.address ?? {};
  const village = a.village ?? a.town ?? a.city ?? a.hamlet ?? null;
  const lga = a.county ?? a.state_district ?? null;
  const state = a.state ?? null;
  return {
    village,
    lga,
    state,
    country: a.country ?? null,
    label: [village, lga, state].filter(Boolean).join(", ") || `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
  };
}

/** Nigeria's agro-ecological zones, estimated from rainfall and latitude. */
export function agroZone(annualRainMm: number, lat: number): string {
  if (annualRainMm < 600) return "Sahel Savanna";
  if (annualRainMm < 1000) return "Sudan Savanna";
  if (lat >= 9 && annualRainMm < 1400) return "Northern Guinea Savanna";
  if (lat >= 7.5 && annualRainMm < 1600) return "Southern Guinea Savanna";
  if (annualRainMm < 2000 && lat >= 6.3) return "Derived Savanna";
  return "Humid Rainforest";
}

// Free public APIs are rate-limited and occasionally flaky, so retry once and
// cache successful answers in memory (soil and climate don't change; forecasts do).
const HOUR = 3_600_000;
const cache = new Map<string, { at: number; value: unknown }>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const value = await load();
      cache.set(key, { at: Date.now(), value });
      return value;
    } catch (err) {
      console.warn(`[farmdata] ${key.split(":")[0]} attempt ${attempt + 1} failed:`, (err as Error).message);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return hit ? (hit.value as T) : null;
}

export async function getFarmData(lat: number, lon: number): Promise<FarmData> {
  const at = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const [place, soil, climate, forecast] = await Promise.all([
    cached(`place:${at}`, 24 * HOUR, () => reverseGeocode(lat, lon)),
    cached(`soil:${at}`, 24 * HOUR, () => getSoil(lat, lon)),
    cached(`climate:${at}`, 24 * HOUR, () => getClimate(lat, lon)),
    cached(`forecast:${at}`, HOUR, () => getForecast(lat, lon)),
  ]);
  return {
    place: place ?? { village: null, lga: null, state: null, country: null, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` },
    zone: climate ? agroZone(climate.annualRainMm, lat) : "Unknown",
    soil,
    climate,
    forecast: forecast ?? [],
  };
}
