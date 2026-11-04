// Turns technical farm data into plain words a farmer can act on, while keeping
// the underlying numbers, their uncertainty and their source visible.
import type { Climate, Confidence, ForecastDay, LabSoil, Soil, SoilValue } from "./types";

export type Level = "good" | "watch" | "act";

export interface PlainSoil {
  key: string;
  emoji: string;
  title: string;
  meaning: string;
  action: string;
  level: Level;
  /** Lab-style facts shown alongside the plain words. */
  label: string;
  estimate: string;
  rating: string;
  range: string | null;
  confidence: Confidence | "lab";
}

const fmt = (v: number, dp = 1) => v.toFixed(dp);

/** Lab results replace satellite estimates property by property. */
export function effectiveSoil(soil: Soil | null, lab?: LabSoil): Soil | null {
  if (!soil && !lab) return null;
  const base: Soil = soil ?? { ph: null, organicCarbon: null, nitrogen: null, clay: null, sand: null, cec: null, texture: "unknown" };
  const exact = (value: number): SoilValue => ({ value, low: value, high: value, confidence: "high", source: "lab" });
  return {
    ...base,
    ph: lab?.ph != null ? exact(lab.ph) : base.ph,
    organicCarbon: lab?.organicCarbonPct != null ? exact(lab.organicCarbonPct * 10) : base.organicCarbon,
    nitrogen: lab?.nitrogenPct != null ? exact(lab.nitrogenPct * 10) : base.nitrogen,
  };
}

const conf = (v: SoilValue): Confidence | "lab" => (v.source === "lab" ? "lab" : v.confidence);
const rangeOf = (v: SoilValue, dp = 1, unit = "") => (v.source === "lab" ? null : `likely ${fmt(v.low, dp)}–${fmt(v.high, dp)}${unit}`);
const lowMedHigh = (v: number, low: number, high: number) => (v < low ? "Low" : v < high ? "Medium" : "High");

export function phRating(ph: number) {
  if (ph < 5) return "Strongly acidic";
  if (ph < 5.5) return "Acidic";
  if (ph < 6) return "Slightly acidic";
  if (ph <= 7.3) return "Neutral";
  if (ph <= 7.8) return "Slightly alkaline";
  return "Alkaline";
}

export function plainSoil(soil: Soil): PlainSoil[] {
  const out: PlainSoil[] = [];

  if (soil.ph) {
    const p = soil.ph;
    const ph = p.value;
    const facts = { key: "ph", label: "Soil pH", estimate: fmt(ph), rating: phRating(ph), range: rangeOf(p), confidence: conf(p) };
    // A satellite range that reaches into acidic soil makes the lime decision uncertain.
    const mightBeAcidic = p.source === "satellite" && ph >= 5.5 && p.low < 5.5;
    if (ph < 5.5) {
      out.push({ ...facts, emoji: "🍋", level: "act", title: "Your soil is sour (acidic)", meaning: "Plants struggle to take up food from sour soil.", action: "Spread agricultural lime or wood ash before planting. Confirm with a soil test first." });
    } else if (ph < 6) {
      out.push({
        ...facts,
        emoji: "🍋",
        level: "watch",
        title: "Your soil is slightly sour",
        meaning: "That's normal here. Maize, cassava, soybean and rice usually grow well.",
        action: mightBeAcidic
          ? `Probably no lime needed, but it could be as sour as pH ${fmt(p.low)}. Do a soil test before you spend money on lime.`
          : "No lime needed. Keep adding manure to keep it healthy.",
      });
    } else if (ph <= 7.5) {
      out.push({ ...facts, emoji: "👍", level: "good", title: "Your soil's sourness is just right", meaning: "Most crops can easily take up food from this soil.", action: mightBeAcidic ? "Nothing to fix, but a soil test would confirm it." : "Nothing to fix here." });
    } else {
      out.push({ ...facts, emoji: "🧂", level: "act", title: "Your soil is alkaline", meaning: "Some plant foods get locked up, and leaves may turn pale.", action: "Add plenty of manure or compost. Ask an extension worker about sulphur." });
    }
  }

  if (soil.organicCarbon) {
    const v = soil.organicCarbon;
    const oc = v.value;
    const facts = { key: "om", label: "Organic carbon", estimate: `${fmt(oc)} g/kg (${fmt(oc / 10, 2)}%)`, rating: lowMedHigh(oc, 10, 20), range: rangeOf(v, 1, " g/kg"), confidence: conf(v) };
    if (oc < 10) {
      out.push({ ...facts, emoji: "🍂", level: "act", title: "Your soil is hungry for manure", meaning: "It has little natural compost, so it dries out fast and holds little plant food.", action: "Add animal dung or compost. Don't burn crop leftovers; leave them on the field." });
    } else if (oc < 20) {
      out.push({ ...facts, emoji: "🍂", level: "watch", title: "Your soil has some natural compost", meaning: "It holds water and plant food fairly well.", action: "Keep adding manure every season so it doesn't run down." });
    } else {
      out.push({ ...facts, emoji: "🌿", level: "good", title: "Your soil is rich in natural compost", meaning: "It holds water and plant food well.", action: "Keep it that way: return crop leftovers to the soil." });
    }
  }

  if (soil.nitrogen) {
    const v = soil.nitrogen;
    const n = v.value;
    const facts = { key: "n", label: "Total nitrogen", estimate: `${fmt(n, 2)} g/kg (${fmt(n / 10, 3)}%)`, rating: lowMedHigh(n, 1, 2), range: rangeOf(v, 2, " g/kg"), confidence: conf(v) };
    if (n < 1) {
      out.push({ ...facts, emoji: "🌱", level: "act", title: "Low in plant food (nitrogen)", meaning: "Maize and rice will grow small and yellow without fertilizer.", action: "Use NPK at planting and urea later. Beans like soybean feed the soil by themselves." });
    } else if (n < 2) {
      out.push({ ...facts, emoji: "🌱", level: "watch", title: "Some plant food (nitrogen)", meaning: "Enough to start, but hungry crops like maize will need more.", action: "Give cereals one top-up of urea when they are knee high." });
    } else {
      out.push({ ...facts, emoji: "🌱", level: "good", title: "Rich in plant food (nitrogen)", meaning: "Crops will get a good start from the soil itself.", action: "You can use less nitrogen fertilizer than usual." });
    }
  }

  if (soil.cec) {
    const v = soil.cec;
    const cec = v.value;
    const facts = { key: "cec", label: "Nutrient holding (CEC)", estimate: `${fmt(cec)} cmol/kg`, rating: lowMedHigh(cec, 10, 20), range: rangeOf(v, 1, " cmol/kg"), confidence: conf(v) };
    if (cec < 10) {
      out.push({ ...facts, emoji: "💧", level: "watch", title: "Fertilizer washes away easily", meaning: "Heavy rain can carry fertilizer away before your plants use it.", action: "Split fertilizer into 2 smaller doses instead of one big one." });
    } else {
      out.push({ ...facts, emoji: "💧", level: "good", title: "Your soil holds fertilizer well", meaning: "Plant food stays in the soil for your crops to use.", action: "Normal fertilizer timing is fine." });
    }
  }

  if (soil.sand && soil.clay) {
    const sand = soil.sand.value;
    const clay = soil.clay.value;
    const facts = {
      key: "tex",
      label: "Texture",
      estimate: soil.texture[0].toUpperCase() + soil.texture.slice(1),
      rating: `${Math.round(sand)}% sand · ${Math.round(clay)}% clay · ${Math.round(100 - sand - clay)}% silt`,
      range: null,
      confidence: (soil.sand.confidence === "low" || soil.clay.confidence === "low" ? "low" : "moderate") as Confidence,
    };
    if (sand > 70) {
      out.push({ ...facts, emoji: "🏜️", level: "watch", title: "Sandy soil that drains fast", meaning: "Water runs through quickly, so crops feel dry spells sooner.", action: "Mulch the soil and plant as soon as the rains are steady." });
    } else if (clay > 45) {
      out.push({ ...facts, emoji: "🧱", level: "watch", title: "Heavy clay soil", meaning: "It can hold too much water and get waterlogged.", action: "Plant on ridges or raised beds so roots don't drown." });
    } else {
      out.push({ ...facts, emoji: "✋", level: "good", title: "Good, easy-to-work soil", meaning: "It drains well but still holds moisture for your crops.", action: "Ridges or flat planting both work." });
    }
  }

  return out;
}

export function monthWeather(rainMm: number) {
  if (rainMm < 25) return { icon: "☀️", word: "Dry" };
  if (rainMm < 75) return { icon: "🌦️", word: "Light rain" };
  if (rainMm < 200) return { icon: "🌧️", word: "Rainy" };
  return { icon: "⛈️", word: "Very wet" };
}

const range = (months: string[]) => (months.length > 1 ? `${months[0]} to ${months.at(-1)}` : months[0] ?? "");

export function plainRain(climate: Climate) {
  const wettest = [...climate.months].sort((a, b) => b.rainMm - a.rainMm).slice(0, 3).map((m) => m.month);
  const ordered = climate.months.filter((m) => wettest.includes(m.month)).map((m) => m.month);
  const dry = climate.months.filter((m) => m.rainMm < 25).map((m) => m.month);
  const headline = climate.rainyMonths.length
    ? `Rains usually come from ${range(climate.rainyMonths)}, about ${climate.rainyMonths.length} months.`
    : "Rain is light all year here. Plan for irrigation.";
  const tips = [
    climate.onsetMonth && `Plant after 2–3 steady rains in ${climate.onsetMonth}, not the very first one. Early rains often stop again.`,
    `The heaviest rain usually falls in ${range(ordered)}.`,
    dry.length >= 2 && `${dry.length} dry months (${dry.join(", ")}). Farming then needs irrigation.`,
  ].filter(Boolean) as string[];
  return { headline, tips };
}

export function dayWeather(d: ForecastDay) {
  if (d.rainMm >= 10) return { icon: "🌧️", word: "Rain" };
  if (d.rainMm >= 2) return { icon: "🌦️", word: "Showers" };
  if (d.tMax >= 35) return { icon: "🔥", word: "Very hot" };
  return { icon: "☀️", word: "Dry" };
}

// Forecast dates are calendar days in Nigeria; parse them as local noon so they never shift a day.
const asDate = (iso: string) => new Date(`${iso}T12:00:00`);
export const shortDay = (iso: string) => asDate(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
export const weekday = (iso: string) => asDate(iso).toLocaleDateString("en-NG", { weekday: "short" });
export const dayOfMonth = (iso: string) => asDate(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });

export function plainForecast(days: ForecastDay[]) {
  const rainDay = days.find((d) => d.rainMm >= 5);
  const hottest = days.reduce((a, b) => (b.tMax > a.tMax ? b : a), days[0]);
  const windy = days.find((d) => d.windKmh >= 35);
  const last = days.at(-1);
  const headline = rainDay
    ? `Rain is expected on ${shortDay(rainDay.date)}.`
    : `Dry days ahead. No real rain expected up to ${last ? shortDay(last.date) : "the next 2 weeks"}.`;
  const tips = [
    !rainDay && "A good time to harvest, dry your crops, or clear land.",
    hottest && hottest.tMax >= 35 && `Very hot afternoons (up to ${Math.round(hottest.tMax)}°C on ${shortDay(hottest.date)}). Water seedlings early morning or evening.`,
    windy && `Strong wind on ${shortDay(windy.date)}. Don't spray chemicals that day.`,
    rainDay && "Hold off on fertilizer until just after the rain, not right before it.",
  ].filter(Boolean) as string[];
  return { headline, tips };
}
