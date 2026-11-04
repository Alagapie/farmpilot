// Ask FarmPilot: a Muse Spark agent whose farm facts and numbers come only from
// tools over the farmer's own data and FarmPilot's engines.
import { CROP_IDS, CROPS, type CropId } from "@/data/crops";
import { advise } from "./advisor";
import { buildCalendar } from "./calendar";
import { cropEconomics } from "./economics";
import { meta, MODELS } from "./meta";
import { effectiveSoil, plainForecast, plainRain, plainSoil } from "./plain";
import type { PlanResult } from "./plan";
import { getPriceSheet } from "./prices";
import type { Farm } from "./types";
import { weatherFrom } from "./weather-sim";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AgentReply {
  answer: string;
  tools: string[];
  sources: { title: string; url: string }[];
}

const TOOL_LABEL: Record<string, string> = {
  get_farm_profile: "your farm profile",
  get_season_plan: "your season plan",
  get_calendar: "your calendar",
  get_weather: "the weather forecast",
  get_advice_for_date: "weather checks for your tasks",
  crop_guide: "the crop guide",
  cost_crop: "the cost calculator",
  get_prices: "today's prices",
  web_search: "the web",
};

const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "function" as const,
  name,
  description,
  strict: true,
  parameters: { type: "object", properties, required, additionalProperties: false },
});

const TOOLS = [
  { type: "web_search" as const },
  fn("get_farm_profile", "The farmer's location, farming zone, farm size, budget, experience, goal, soil (with source and confidence) and typical rainfall pattern."),
  fn("get_season_plan", "The farmer's current season plan: crops, hectares, varieties, nursery/planting/harvest windows, budget, expected margins and warnings."),
  fn(
    "get_calendar",
    "Dated farm tasks from the season plan between two dates (YYYY-MM-DD).",
    { from: { type: "string", description: "Start date, YYYY-MM-DD" }, to: { type: "string", description: "End date, YYYY-MM-DD" } },
    ["from", "to"],
  ),
  fn("get_weather", "The live 16-day weather forecast for the farm, with a plain summary."),
  fn(
    "get_advice_for_date",
    "Rule-checked advice for the week starting on a date: which tasks are due and whether the weather suits them (planting, fertilizer, spraying, harvest). Beyond 16 days the weather is simulated from averages.",
    { date: { type: "string", description: "YYYY-MM-DD" } },
    ["date"],
  ),
  fn(
    "crop_guide",
    "Extension guidance for a crop: varieties, spacing, seed rate, fertilizer and inputs per hectare, planting rule, growing days, risks and soil notes.",
    { crop: { type: "string", enum: CROP_IDS } },
    ["crop"],
  ),
  fn(
    "cost_crop",
    "Compute quantities, costs, harvest and margin for growing a crop on a given area, with today's prices and this farmer's experience.",
    { crop: { type: "string", enum: CROP_IDS }, hectares: { type: "number" } },
    ["crop", "hectares"],
  ),
  fn("get_prices", "Today's input and crop prices for the farmer's state, with source, date, confidence and price type."),
];

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

async function runTool(name: string, args: Record<string, unknown>, farm: Farm): Promise<unknown> {
  const plan = farm.plan as PlanResult | undefined;
  const hasPlan = !!plan && Array.isArray(plan.details);
  const state = farm.data.place.state ?? "Nigeria";
  switch (name) {
    case "get_farm_profile": {
      const soil = effectiveSoil(farm.data.soil, farm.labSoil);
      return {
        name: farm.name,
        location: farm.data.place.label,
        zone: farm.data.zone,
        hectares: farm.hectares,
        acres: Math.round(farm.hectares * 2.471 * 10) / 10,
        sizeMeasuredBy: farm.hectaresSource,
        budgetNaira: farm.budgetNaira,
        experience: farm.experience,
        goal: farm.goal,
        soil: soil ? plainSoil(soil).map(({ label, estimate, rating, range, confidence, title, action }) => ({ label, estimate, rating, range, source: confidence === "lab" ? "lab test" : `satellite estimate, ${confidence} confidence`, meaning: title, action })) : "unknown",
        rain: farm.data.climate ? { ...plainRain(farm.data.climate), period: farm.data.climate.period, annualMm: farm.data.climate.annualRainMm } : "unknown",
      };
    }
    case "get_season_plan": {
      if (!hasPlan) return { plan: null, note: "No season plan yet. Suggest the farmer opens the Season plan tab to build one." };
      return {
        headline: plan.plan.headline,
        crops: plan.details.map((d) => ({
          crop: CROPS[d.allocation.crop].name,
          hectares: d.allocation.hectares,
          variety: d.allocation.variety,
          nurseryStart: d.allocation.nurseryStart || null,
          plantWindow: [d.allocation.plantFrom, d.allocation.plantTo],
          harvestWindow: [d.harvestFrom, d.harvestTo],
          costNaira: d.economics.totalCost,
          expectedMarginNaira: d.economics.scenarios.expected.margin,
          worstCaseMarginNaira: d.economics.scenarios.low.margin,
          shoppingList: d.economics.lines.map((l) => `${l.label}: ${l.quantity} × ${l.unit} (₦${l.cost.toLocaleString("en-NG")}) — ${l.when}`),
        })),
        budget: plan.budget,
        unplantedHectares: plan.land.unallocated,
        warnings: plan.warnings,
      };
    }
    case "get_calendar": {
      if (!hasPlan) return { tasks: [], note: "No season plan yet." };
      const from = String(args.from);
      const to = String(args.to);
      return { tasks: buildCalendar(plan).filter((t) => t.start <= to && t.end >= from).map(({ title, detail, start, end }) => ({ title, detail, start, end })) };
    }
    case "get_weather":
      return { source: "Open-Meteo live forecast", fetchedAt: farm.data.forecastFetchedAt, summary: farm.data.forecast.length ? plainForecast(farm.data.forecast) : null, days: farm.data.forecast };
    case "get_advice_for_date": {
      if (!hasPlan) return { alerts: [], note: "No season plan yet." };
      const date = String(args.date) || todayIso();
      const weather = weatherFrom(date, 14, farm.data.forecast, farm.data.climate, farm.data.place.label);
      return {
        date,
        weatherIsSimulated: weather.slice(0, 7).some((w) => w.simulated),
        alerts: advise(date, buildCalendar(plan), weather).map(({ level, title, message, reason }) => ({ level, title, message, reason })),
      };
    }
    case "crop_guide": {
      const c = CROPS[args.crop as CropId];
      if (!c) return { error: "Unknown crop" };
      return { ...c, inputsPerHectare: c.inputs, zonesThatSuit: c.zones, yieldPerHa: c.yieldPerHa[farm.experience], yieldUnit: c.yieldUnit };
    }
    case "cost_crop": {
      const sheet = await getPriceSheet(state);
      const soil = effectiveSoil(farm.data.soil, farm.labSoil);
      const e = cropEconomics(args.crop as CropId, Number(args.hectares), {
        experience: farm.experience,
        prices: sheet.prices,
        labour: hasPlan ? plan.labour : "mixed",
        soilNitrogen: soil?.nitrogen?.value ?? null,
      });
      return { ...e, note: "Margin is an estimate after listed costs, not guaranteed profit." };
    }
    case "get_prices": {
      const sheet = await getPriceSheet(state);
      return {
        state: sheet.state,
        fetchedAt: sheet.fetchedAt,
        prices: sheet.prices.map(({ label, unit, typical, low, high, confidence, priceType, matchedProduct, sourceTitle, sourceUrl, sourceDate }) => ({ label, unit, typical, low, high, confidence, priceType, matchedProduct, source: sourceTitle, sourceUrl, sourceDate })),
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
}

const INSTRUCTIONS = (farm: Farm) => `You are FarmPilot, a friendly farming adviser for smallholder farmers in Nigeria. You are talking to the farmer of "${farm.name}" in ${farm.data.place.label}. Today is ${todayIso()}.

How to answer:
- Use the tools for anything about this farm: profile, plan, calendar, weather, prices, costs. Never guess farm facts.
- Every number (naira, bags, kg, dates, yields) must come from a tool result. Do not do your own money arithmetic; call cost_crop instead.
- Use web_search only for general or current questions the tools can't answer, and say where the information came from.
- Say when something is an estimate: satellite soil, simulated weather, wholesale prices, margins.
- Pesticides and herbicides: say to scout first, follow the product label rate and pre-harvest interval, wear protective clothing. Never invent a dose.
- If a question needs an expert to see the crop (sick plants, unknown pests), say so and suggest the local extension officer.
- If asked about something unrelated to farming, answer briefly and steer back to the farm.

Style: very simple English, short sentences, warm and direct, as if speaking. Keep answers under 120 words. Use a short list only for steps or quantities.`;

// Web search lists the pages it read on the call itself.
const INCLUDE: ["web_search_call.action.sources"] = ["web_search_call.action.sources"];

export async function askAgent(farm: Farm, history: ChatTurn[]): Promise<AgentReply> {
  const used = new Set<string>();
  const sources = new Map<string, string>();
  const input = [
    { role: "developer" as const, content: INSTRUCTIONS(farm) },
    ...history.slice(-12).map((t) => ({ role: t.role, content: t.content })),
  ];

  let res = await meta().responses.create({ model: MODELS.spark, reasoning: { effort: "low" }, tools: TOOLS, include: INCLUDE, input });
  for (let step = 0; step < 6; step++) {
    for (const item of res.output) {
      if (item.type === "web_search_call") {
        used.add("web_search");
        const found = (item.action as { sources?: { url?: string }[] } | undefined)?.sources ?? [];
        for (const src of found) if (src.url && sources.size < 4) sources.set(src.url, new URL(src.url).hostname.replace(/^www\./, ""));
      }
      if (item.type === "message") {
        for (const c of item.content) {
          if (c.type === "output_text") for (const a of c.annotations ?? []) if (a.type === "url_citation") sources.set(a.url, a.title ?? a.url);
        }
      }
    }
    const calls = res.output.filter((o) => o.type === "function_call");
    if (!calls.length) break;
    const outputs = await Promise.all(
      calls.map(async (call) => {
        if (call.type !== "function_call") throw new Error("unreachable");
        used.add(call.name);
        let result: unknown;
        try {
          result = await runTool(call.name, JSON.parse(call.arguments || "{}"), farm);
        } catch (err) {
          result = { error: (err as Error).message };
        }
        return { type: "function_call_output" as const, call_id: call.call_id, output: JSON.stringify(result) };
      }),
    );
    res = await meta().responses.create({ model: MODELS.spark, reasoning: { effort: "low" }, tools: TOOLS, include: INCLUDE, previous_response_id: res.id, input: outputs });
  }

  // The model may narrate between tool calls; the answer is its last message.
  const last = res.output.filter((o) => o.type === "message").at(-1);
  const answer = last?.type === "message" ? last.content.map((c) => (c.type === "output_text" ? c.text : "")).join("").trim() : "";
  return {
    answer: answer || "Sorry, I couldn't find an answer to that. Please try asking another way.",
    tools: [...used].map((t) => TOOL_LABEL[t] ?? t),
    sources: [...sources].map(([url, title]) => ({ url, title })),
  };
}
