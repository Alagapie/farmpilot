import type { Climate, Confidence, FarmData, ForecastDay, Place, Soil, SoilValue } from "./types";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const UA = { "User-Agent": "FarmPilot/0.1 (hackathon demo)" };

async function getJson<T>(url: string, timeoutMs = 25_000): Promise<T> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).host} responded ${res.status}`);
  return res.json() as Promise<T>;
}

/** USDA soil texture triangle. */
export function textureClass(sand: number, clay: number): string {
  const silt = 100 - sand - clay;
  if (silt + 1.5 * clay < 15) return "sand";
  if (silt + 2 * clay < 30) return "loamy sand";
  if ((clay >= 7 && clay < 20 && sand > 52) || (clay < 7 && silt < 50)) return "sandy loam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52) return "loam";
  if ((silt >= 50 && clay >= 12 && clay < 27) || (silt >= 50 && silt < 80 && clay < 12)) return "silt loam";
  if (silt >= 80 && clay < 12) return "silt";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "sandy clay loam";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "clay loam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "silty clay loam";
  if (clay >= 35 && sand > 45) return "sandy clay";
  if (clay >= 40 && silt >= 40) return "silty clay";
  return "clay";
}

/**
 * Confidence from the width of SoilGrids' 90% prediction interval relative to
 * the estimate (pH uses absolute width, since its scale is logarithmic).
 */
function confidenceOf(name: string, value: number, low: number, high: number): Confidence {
  const width = name === "phh2o" ? (high - low) / 2.5 : (high - low) / Math.max(value, 1e-6);
  if (width < 0.6) return "high";
  if (width < 1.5) return "moderate";
  return "low";
}

interface SoilGridsLayer {
  name: string;
  unit_measure: { d_factor: number };
  depths: { range: { top_depth: number; bottom_depth: number }; values: Record<"mean" | "Q0.05" | "Q0.95", number | null> }[];
}

export async function getSoil(lat: number, lon: number): Promise<Soil> {
  const props = ["phh2o", "soc", "nitrogen", "clay", "sand", "cec"].map((p) => `property=${p}`).join("&");
  const depths = ["0-5cm", "5-15cm", "15-30cm"].map((d) => `depth=${d}`).join("&");
  const json = await getJson<{ properties: { layers: SoilGridsLayer[] } }>(
    `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&${props}&${depths}&value=mean&value=Q0.05&value=Q0.95`,
  );
  // Thickness-weighted over the 0-30cm topsoil, converted to conventional units.
  const value = (name: string): SoilValue | null => {
    const layer = json.properties.layers.find((l) => l.name === name);
    if (!layer) return null;
    const sums = { mean: 0, low: 0, high: 0 };
    let weight = 0;
    for (const d of layer.depths) {
      const { mean, "Q0.05": q05, "Q0.95": q95 } = d.values;
      if (mean == null || q05 == null || q95 == null) continue;
      const w = d.range.bottom_depth - d.range.top_depth;
      sums.mean += mean * w;
      sums.low += q05 * w;
      sums.high += q95 * w;
      weight += w;
    }
    if (!weight) return null;
    const scale = (v: number) => Math.round((v / weight / layer.unit_measure.d_factor) * 100) / 100;
    const [v, low, high] = [scale(sums.mean), scale(sums.low), scale(sums.high)];
    return { value: v, low, high, confidence: confidenceOf(name, v, low, high), source: "satellite" };
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
    texture: sand && clay ? textureClass(sand.value, clay.value) : "unknown",
  };
}

export async function getClimate(lat: number, lon: number): Promise<Climate> {
  const json = await getJson<{ header: { range?: string }; properties: { parameter: Record<string, Record<string, number>> } }>(
    `https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=PRECTOTCORR,T2M,T2M_RANGE&community=AG&longitude=${lon}&latitude=${lat}&format=JSON`,
  );
  const p = json.properties.parameter;
  // T2M_MAX/T2M_MIN in this climatology are monthly extremes, so typical daily
  // highs and lows come from the mean temperature and the mean daily range.
  const months = MONTHS.map((m, i) => ({
    month: m[0] + m.slice(1).toLowerCase(),
    rainMm: Math.round(p.PRECTOTCORR[m] * DAYS[i]),
    tMax: Math.round((p.T2M[m] + p.T2M_RANGE[m] / 2) * 10) / 10,
    tMin: Math.round((p.T2M[m] - p.T2M_RANGE[m] / 2) * 10) / 10,
  }));
  const rainyMonths = months.filter((m) => m.rainMm >= 75).map((m) => m.month);
  const years = json.header.range?.match(/(\d{4})\D+(\d{4})/);
  return {
    period: years ? `${years[1]}–${years[2]}` : "recent decades",
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

/** Forecast plus when it was actually fetched (it may come from a short cache). */
export function getLiveForecast(lat: number, lon: number) {
  return cached(`forecast:${lat.toFixed(3)},${lon.toFixed(3)}`, 30 * 60_000, async () => ({
    days: await getForecast(lat, lon),
    fetchedAt: new Date().toISOString(),
  }));
}

export async function getFarmData(lat: number, lon: number): Promise<FarmData> {
  const at = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const [place, soil, climate, forecast] = await Promise.all([
    cached(`place:${at}`, 24 * HOUR, () => reverseGeocode(lat, lon)),
    cached(`soil:${at}`, 24 * HOUR, () => getSoil(lat, lon)),
    cached(`climate:${at}`, 24 * HOUR, () => getClimate(lat, lon)),
    getLiveForecast(lat, lon),
  ]);
  return {
    place: place ?? { village: null, lga: null, state: null, country: null, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` },
    zone: climate ? agroZone(climate.annualRainMm, lat) : "Unknown",
    soil,
    climate,
    forecast: forecast?.days ?? [],
    forecastFetchedAt: forecast?.fetchedAt ?? null,
  };
}
