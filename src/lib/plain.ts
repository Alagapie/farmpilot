// Turns technical farm data into plain words a farmer can act on.
import type { Climate, ForecastDay, Soil } from "./types";

export type Level = "good" | "watch" | "act";

export interface PlainSoil {
  key: string;
  emoji: string;
  title: string;
  meaning: string;
  action: string;
  level: Level;
  technical: string;
}

export function plainSoil(soil: Soil): PlainSoil[] {
  const out: PlainSoil[] = [];

  if (soil.ph != null) {
    const ph = soil.ph;
    out.push(
      ph < 5.5
        ? { key: "ph", emoji: "🍋", level: "act", title: "Your soil is sour (acidic)", meaning: "Plants struggle to take up food from sour soil.", action: "Spread agricultural lime or wood ash before planting.", technical: `pH ${ph.toFixed(1)}` }
        : ph < 6
          ? { key: "ph", emoji: "🍋", level: "watch", title: "Your soil is slightly sour", meaning: "That's normal here. Maize, cassava, soybean and rice still grow well.", action: "No lime needed. Keep adding manure to keep it healthy.", technical: `pH ${ph.toFixed(1)}` }
          : ph <= 7.5
            ? { key: "ph", emoji: "👍", level: "good", title: "Your soil's sourness is just right", meaning: "Most crops can easily take up food from this soil.", action: "Nothing to fix here.", technical: `pH ${ph.toFixed(1)}` }
            : { key: "ph", emoji: "🧂", level: "act", title: "Your soil is alkaline", meaning: "Some plant foods get locked up, and leaves may turn pale.", action: "Add plenty of manure or compost. Ask an extension worker about sulphur.", technical: `pH ${ph.toFixed(1)}` },
    );
  }

  if (soil.organicCarbon != null) {
    const oc = soil.organicCarbon;
    out.push(
      oc < 10
        ? { key: "om", emoji: "🍂", level: "act", title: "Your soil is hungry for manure", meaning: "It has little natural compost, so it dries out fast and holds little plant food.", action: "Add animal dung or compost. Don't burn crop leftovers; leave them on the field.", technical: `${oc.toFixed(1)} g/kg organic carbon` }
        : oc < 20
          ? { key: "om", emoji: "🍂", level: "watch", title: "Your soil has some natural compost", meaning: "It holds water and plant food fairly well.", action: "Keep adding manure every season so it doesn't run down.", technical: `${oc.toFixed(1)} g/kg organic carbon` }
          : { key: "om", emoji: "🌿", level: "good", title: "Your soil is rich in natural compost", meaning: "It holds water and plant food well.", action: "Keep it that way: return crop leftovers to the soil.", technical: `${oc.toFixed(1)} g/kg organic carbon` },
    );
  }

  if (soil.nitrogen != null) {
    const n = soil.nitrogen;
    out.push(
      n < 1
        ? { key: "n", emoji: "🌱", level: "act", title: "Low in plant food (nitrogen)", meaning: "Maize and rice will grow small and yellow without fertilizer.", action: "Use NPK at planting and urea later. Beans like soybean feed the soil by themselves.", technical: `${n.toFixed(2)} g/kg nitrogen` }
        : n < 2
          ? { key: "n", emoji: "🌱", level: "watch", title: "Some plant food (nitrogen)", meaning: "Enough to start, but hungry crops like maize will need more.", action: "Give cereals one top-up of urea when they are knee high.", technical: `${n.toFixed(2)} g/kg nitrogen` }
          : { key: "n", emoji: "🌱", level: "good", title: "Rich in plant food (nitrogen)", meaning: "Crops will get a good start from the soil itself.", action: "You can use less nitrogen fertilizer than usual.", technical: `${n.toFixed(2)} g/kg nitrogen` },
    );
  }

  if (soil.cec != null) {
    const cec = soil.cec;
    out.push(
      cec < 10
        ? { key: "cec", emoji: "💧", level: "watch", title: "Fertilizer washes away easily", meaning: "Heavy rain can carry fertilizer away before your plants use it.", action: "Split fertilizer into 2 smaller doses instead of one big one.", technical: `CEC ${cec.toFixed(1)} cmol/kg` }
        : { key: "cec", emoji: "💧", level: "good", title: "Your soil holds fertilizer well", meaning: "Plant food stays in the soil for your crops to use.", action: "Normal fertilizer timing is fine.", technical: `CEC ${cec.toFixed(1)} cmol/kg` },
    );
  }

  if (soil.sand != null && soil.clay != null) {
    const technical = `${Math.round(soil.sand)}% sand, ${Math.round(soil.clay)}% clay (${soil.texture})`;
    out.push(
      soil.sand > 70
        ? { key: "tex", emoji: "🏜️", level: "watch", title: "Sandy soil that drains fast", meaning: "Water runs through quickly, so crops feel dry spells sooner.", action: "Mulch the soil and plant as soon as the rains are steady.", technical }
        : soil.clay > 45
          ? { key: "tex", emoji: "🧱", level: "watch", title: "Heavy clay soil", meaning: "It can hold too much water and get waterlogged.", action: "Plant on ridges or raised beds so roots don't drown.", technical }
          : { key: "tex", emoji: "✋", level: "good", title: "Good, easy-to-work soil", meaning: "It drains well but still holds moisture for your crops.", action: "Ridges or flat planting both work.", technical },
    );
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
    ? `Rains come from ${range(climate.rainyMonths)}, about ${climate.rainyMonths.length} months.`
    : "Rain is light all year here. Plan for irrigation.";
  const tips = [
    climate.onsetMonth && `Plant after 2–3 steady rains in ${climate.onsetMonth}, not the very first one. Early rains often stop again.`,
    `The heaviest rain falls in ${range(ordered)}.`,
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

export const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });

export function plainForecast(days: ForecastDay[]) {
  const rainDay = days.find((d) => d.rainMm >= 5);
  const hottest = days.reduce((a, b) => (b.tMax > a.tMax ? b : a), days[0]);
  const windy = days.find((d) => d.windKmh >= 35);
  const headline = rainDay
    ? `Rain is coming on ${shortDay(rainDay.date)}.`
    : "Dry days ahead. No real rain expected for the next 2 weeks.";
  const tips = [
    !rainDay && "A good time to harvest, dry your crops, or clear land.",
    hottest && hottest.tMax >= 35 && `Very hot afternoons (up to ${Math.round(hottest.tMax)}°C). Water seedlings early morning or evening.`,
    windy && `Strong wind on ${shortDay(windy.date)}. Don't spray chemicals that day.`,
    rainDay && "Hold off on fertilizer until just after the rain, not right before it.",
  ].filter(Boolean) as string[];
  return { headline, tips };
}
