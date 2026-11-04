// Weather-aware advice: rules check each task due this week against the
// weather, so every alert has a concrete, checkable reason.
import { CROPS, type CropId } from "@/data/crops";
import { addDays, daysBetween, type FarmTask } from "./calendar";
import { shortDay } from "./plain";
import type { ForecastDay } from "./types";

export type Day = ForecastDay & { simulated: boolean };

export interface Alert {
  id: string;
  level: "act" | "warn" | "wait" | "info";
  crop: CropId | null;
  title: string;
  message: string;
  reason: string;
}

const HEAVY = 20; // mm in a day
const day = (iso: string) => shortDay(iso);

export function activeTasks(today: string, tasks: FarmTask[], horizon = 7) {
  const until = addDays(today, horizon - 1);
  return tasks.filter((t) => t.start <= until && t.end >= today);
}

export function advise(today: string, tasks: FarmTask[], weather: Day[]): Alert[] {
  const alerts: Alert[] = [];
  const week = weather.slice(0, 7);
  const on = (iso: string) => weather.find((w) => w.date === iso);

  for (const t of activeTasks(today, tasks)) {
    const crop = CROPS[t.crop].name;
    // Days of this task's window that fall in the coming week.
    const window = week.filter((w) => w.date >= t.start && w.date <= t.end);
    const starts = t.start > today ? ` from ${day(t.start)}` : "";

    if (t.weather === "onset") {
      // Extension rule of thumb: about 3 good rains (20mm+) within 2 weeks means the season has started.
      const fortnight = weather.slice(0, 14);
      const heavy = fortnight.filter((w) => w.rainMm >= HEAVY);
      const total = fortnight.reduce((s, w) => s + w.rainMm, 0);
      if (heavy.length >= 2 || total >= 60) {
        const after = heavy[0] ?? fortnight.find((w) => w.rainMm >= 5);
        alerts.push({ id: t.id, level: "act", crop: t.crop, title: `Plant ${crop} now`, message: `The rains look steady. Plant the day after the rain on ${after ? day(after.date) : "the next wet day"}, while the soil is moist.`, reason: `${Math.round(total)}mm of rain expected in the next 14 days, ${heavy.length} day(s) of 20mm or more.` });
      } else if (today >= t.start) {
        alerts.push({ id: t.id, level: "wait", crop: t.crop, title: `Wait to plant ${crop}`, message: "The rains are not steady yet. Planting into dry soil risks losing your seed. Keep seed and land ready.", reason: `Only ${Math.round(total)}mm expected in the next 14 days.` });
      } else {
        alerts.push({ id: t.id, level: "info", crop: t.crop, title: `${crop} planting window opens ${day(t.start)}`, message: "Get seed, land and labour ready. Plant only once the rains are steady.", reason: "Planting window from your season plan." });
      }
      continue;
    }

    if (t.weather === "noHeavyRain") {
      // Best day: no heavy rain that day or the next; prefer moist soil after a light rain.
      const scored = window.map((w) => {
        const next = on(addDays(w.date, 1));
        const prev = on(addDays(w.date, -1));
        const bad = w.rainMm >= HEAVY || (next?.rainMm ?? 0) >= 25;
        const moist = w.rainMm >= 2 || (prev?.rainMm ?? 0) >= 5;
        return { w, bad, score: (bad ? -10 : 0) + (moist ? 2 : 0) };
      });
      const best = scored.filter((s) => !s.bad).sort((a, b) => b.score - a.score)[0];
      const firstBad = scored.find((s) => s.bad);
      if (best && firstBad && firstBad.w.date <= best.w.date) {
        alerts.push({ id: t.id, level: "warn", crop: t.crop, title: `Delay ${t.title.toLowerCase()}`, message: `Heavy rain is expected around ${day(firstBad.w.date)}. Wait and apply on ${day(best.w.date)} so the fertilizer isn't washed away.`, reason: `${Math.round(firstBad.w.rainMm)}mm on ${day(firstBad.w.date)}.` });
      } else if (best) {
        alerts.push({ id: t.id, level: "act", crop: t.crop, title: t.title, message: `Best day: ${day(best.w.date)}${best.score > 0 ? ", when the soil will be moist" : ""}. Cover the fertilizer with soil after applying.`, reason: best.score > 0 ? "Light rain before, no heavy rain after." : "No heavy rain forecast around that day." });
      } else if (window.length) {
        alerts.push({ id: t.id, level: "wait", crop: t.crop, title: `Hold ${t.title.toLowerCase()}`, message: "Heavy rain is expected all through this window. Apply as soon as it eases.", reason: "Heavy rain on every day in the window." });
      } else {
        alerts.push({ id: t.id, level: "info", crop: t.crop, title: t.title, message: `Due${starts}.`, reason: "From your season calendar." });
      }
      continue;
    }

    if (t.weather === "calmDry") {
      const best = window.find((w) => w.rainMm < 2 && w.windKmh < 15);
      if (best) alerts.push({ id: t.id, level: "act", crop: t.crop, title: t.title, message: `Spray on ${day(best.date)}, in the cool morning when it's calm. Wear gloves and a mask.`, reason: `Dry with light wind (${best.windKmh}km/h).` });
      else if (window.length) alerts.push({ id: t.id, level: "wait", crop: t.crop, title: `Don't spray yet (${crop})`, message: "Rain or strong wind would wash the spray off or blow it onto you. Wait for a calm, dry morning.", reason: "No calm, dry day in this window." });
      continue;
    }

    if (t.weather === "dryDays") {
      const next3 = week.slice(0, 3);
      const wet = next3.find((w) => w.rainMm >= 2);
      if (!wet) alerts.push({ id: t.id, level: "act", crop: t.crop, title: t.title, message: "The next 3 days look dry. Good days to harvest and dry your crop.", reason: "No rain forecast for 3 days." });
      else {
        const dry = week.find((w) => w.date > wet.date && w.rainMm < 1);
        alerts.push({ id: t.id, level: "warn", crop: t.crop, title: `Rain near harvest (${crop})`, message: `Rain is expected on ${day(wet.date)}. ${dry ? `Harvest from ${day(dry.date)}` : "Harvest between showers"}, and keep cut crop covered.`, reason: `${Math.round(wet.rainMm)}mm on ${day(wet.date)}.` });
      }
      continue;
    }

    alerts.push({ id: t.id, level: "info", crop: t.crop, title: t.title, message: `${t.detail}${starts ? ` Starts ${day(t.start)}.` : ""}`, reason: "From your season calendar." });
  }

  // Crop-stage weather risks: a crop counts as in the ground once its planting window has closed.
  const growing = [...new Set(tasks.filter((t) => t.kind === "plant").map((t) => t.crop))].filter((c) => {
    const plant = tasks.find((t) => t.crop === c && t.kind === "plant")!;
    const harvest = tasks.find((t) => t.crop === c && t.kind === "harvest");
    return today > plant.end && (!harvest || today < harvest.start);
  });
  const hot = week.slice(0, 3).find((w) => w.tMax >= 38);
  const young = growing.filter((c) => daysBetween(tasks.find((t) => t.crop === c && t.kind === "plant")!.end, today) <= 30);
  if (hot && young.length) {
    alerts.push({ id: "heat", level: "warn", crop: null, title: "Heat stress for young plants", message: `Very hot on ${day(hot.date)} (${Math.round(hot.tMax)}°C). Mulch around seedlings${young.includes("tomato") ? " and water tomato early morning and evening" : ""}.`, reason: `${Math.round(hot.tMax)}°C forecast.` });
  }
  const rainfed = growing.filter((c) => c !== "tomato");
  const weekRain = week.reduce((s, w) => s + w.rainMm, 0);
  if (rainfed.length && weekRain < 5) {
    alerts.push({ id: "dryspell", level: "warn", crop: null, title: "Dry spell coming", message: `Almost no rain for 7 days while ${rainfed.map((c) => CROPS[c].name).join(" and ")} ${rainfed.length > 1 ? "are" : "is"} growing. Weed now so weeds don't drink the water, and hold off on fertilizer until the rain returns.`, reason: `${Math.round(weekRain)}mm expected in 7 days.` });
  }

  const order = { warn: 0, wait: 1, act: 2, info: 3 };
  return alerts.sort((a, b) => order[a.level] - order[b.level]);
}
