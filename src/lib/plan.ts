import { CROP_IDS, CROPS, type CropId, type PriceKey } from "@/data/crops";
import { cropEconomics, suitability, type CropEconomics, type LabourMode, type Suitability } from "./economics";
import { meta, MODELS } from "./meta";
import { effectiveSoil, plainRain, plainSoil } from "./plain";
import { getPriceSheet, type Price, type PriceSheet } from "./prices";
import type { Farm } from "./types";

export interface PlanAllocation {
  crop: CropId;
  hectares: number;
  variety: string;
  plantFrom: string;
  plantTo: string;
  why: string;
}

export interface SeasonPlan {
  headline: string;
  summary: string;
  allocations: PlanAllocation[];
  ranking: { crop: CropId; fit: "best" | "good" | "possible" | "not_advised"; reason: string }[];
  risks: { risk: string; action: string }[];
  budgetNote: string;
  beforePlanting: string[];
}

export interface PlanResult {
  plan: SeasonPlan;
  economics: CropEconomics[];
  /** Every crop costed for one hectare, for side-by-side comparison. */
  options: { crop: CropId; perHa: CropEconomics; suitability: Suitability }[];
  totals: { cost: number; budget: number; reserve: number; revenue: { low: number; expected: number; high: number }; profit: { low: number; expected: number; high: number } };
  warnings: string[];
  prices: PriceSheet;
  irrigation: boolean;
  labour: LabourMode;
  createdAt: string;
  model: string;
}

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    allocations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          crop: { type: "string", enum: CROP_IDS },
          hectares: { type: "number" },
          variety: { type: "string" },
          plantFrom: { type: "string" },
          plantTo: { type: "string" },
          why: { type: "string" },
        },
        required: ["crop", "hectares", "variety", "plantFrom", "plantTo", "why"],
        additionalProperties: false,
      },
    },
    ranking: {
      type: "array",
      items: {
        type: "object",
        properties: {
          crop: { type: "string", enum: CROP_IDS },
          fit: { type: "string", enum: ["best", "good", "possible", "not_advised"] },
          reason: { type: "string" },
        },
        required: ["crop", "fit", "reason"],
        additionalProperties: false,
      },
    },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: { risk: { type: "string" }, action: { type: "string" } },
        required: ["risk", "action"],
        additionalProperties: false,
      },
    },
    budgetNote: { type: "string" },
    beforePlanting: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "summary", "allocations", "ranking", "risks", "budgetNote", "beforePlanting"],
  additionalProperties: false,
};

const RESERVE = 0.1; // keep 10% of the budget for surprises

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

function applyOverrides(sheet: PriceSheet, overrides: Partial<Record<PriceKey, number>>): PriceSheet {
  return {
    ...sheet,
    prices: sheet.prices.map((p): Price => {
      const v = overrides[p.key];
      return v && v > 0 ? { ...p, typical: v, low: Math.round(v * 0.85), high: Math.round(v * 1.15), edited: true } : p;
    }),
  };
}

export interface PlanOptions {
  irrigation: boolean;
  labour: LabourMode;
  overrides?: Partial<Record<PriceKey, number>>;
}

export async function buildPlan(farm: Farm, { irrigation, labour, overrides = {} }: PlanOptions): Promise<PlanResult> {
  const sheet = applyOverrides(await getPriceSheet(farm.data.place.state ?? "Nigeria"), overrides);
  const soil = effectiveSoil(farm.data.soil, farm.labSoil);
  const spendable = farm.budgetNaira * (1 - RESERVE);

  const options = CROP_IDS.map((id) => ({
    crop: id,
    perHa: cropEconomics(id, 1, farm.experience, sheet.prices, labour),
    suitability: suitability(id, farm, irrigation),
  }));

  const candidates = options.map(({ crop: id, perHa, suitability: fit }) => {
    const c = CROPS[id];
    return {
      crop: id,
      suitability: fit,
      growingDays: c.growingDays,
      varieties: c.varieties,
      plantingRule: c.plantingRule,
      strengths: c.strengths,
      risks: c.risks,
      soilNotes: c.soilNotes,
      perHectare: {
        cost: Math.round(perHa.totalCost),
        costLines: perHa.lines.map((l) => `${l.label}: ${l.quantity} ${l.unit} × ${naira(l.unitPrice)}`),
        harvest: `${perHa.harvest.low}–${perHa.harvest.high} ${perHa.harvest.unit} (expected ${perHa.harvest.expected})`,
        cropPrice: `${naira(perHa.cropPrice.low)}–${naira(perHa.cropPrice.high)} per ${perHa.cropPrice.unit}`,
        profit: { low: Math.round(perHa.profit.low), expected: Math.round(perHa.profit.expected), high: Math.round(perHa.profit.high) },
        maxAffordableHectares: Math.round((spendable / perHa.totalCost) * 100) / 100,
      },
      priceConfidence: sheet.prices.find((p) => p.key === `crop_${id}`)?.confidence ?? "low",
    };
  });

  const facts = {
    today: new Date().toISOString().slice(0, 10),
    farm: {
      location: farm.data.place.label,
      zone: farm.data.zone,
      hectares: farm.hectares,
      budgetNaira: farm.budgetNaira,
      spendableAfterReserveNaira: Math.round(spendable),
      experience: farm.experience,
      goal: farm.goal,
      cropsFarmerIsConsidering: farm.interests,
      irrigationForDrySeason: irrigation,
      farmWork: labour === "family" ? "mostly family labour" : labour === "mixed" ? "family plus some hired help" : "all hired labour",
    },
    rain: farm.data.climate
      ? { ...plainRain(farm.data.climate), rainyMonths: farm.data.climate.rainyMonths, annualMm: farm.data.climate.annualRainMm }
      : "unknown",
    soil: soil ? plainSoil(soil).map(({ label, estimate, rating, confidence, title }) => ({ label, estimate, rating, confidence, title })) : "unknown",
    crops: candidates,
  };

  const res = await meta().chat.completions.create({
    model: MODELS.wonder,
    reasoning_effort: "medium",
    messages: [
      {
        role: "developer",
        content: `You are FarmPilot's season planner, an experienced Nigerian agronomist and farm business adviser.
Choose what this smallholder farmer should plant in their next main season, and how much land to give each crop.

Decide using: agro-ecological zone fit, rainfall and season length, soil (note the confidence of satellite estimates), the farmer's experience, goal and interests, cost per hectare against the budget, profit ranges, price confidence and risk.

Hard rules:
- Total hectares across allocations must not exceed the farm size.
- Total cost (perHectare.cost × hectares, summed) must not exceed spendableAfterReserveNaira. If the budget cannot cover all the land, plant less and say so in budgetNote.
- At most 2 crops for "new" farmers, at most 3 otherwise. Avoid allocations smaller than 0.1 ha.
- Pick varieties only from the crop's varieties list.
- plantFrom and plantTo (YYYY-MM-DD) give a planting window of 1 to 3 weeks. They must follow the crop's planting rule and the rainy months; use the next main rainy season after today unless an irrigated dry-season crop can start now.
- Never invent prices, yields or costs; the app computes all money figures from the data you are given. You may refer to them qualitatively.
- If a crop's price confidence is low, mention that its earnings are uncertain.
- If no crop has a positive expected profit, say so honestly in summary and budgetNote, and choose the lowest-risk plan (or suggest planting less).
- Rank every crop in "crops" in ranking, best first.

Every text field must be filled in; never return an empty string.
Writing: the farmer reads every text field. Use very simple English, short sentences, no jargon. "why" and "reason" at most 30 words each. 3 to 5 risks. 3 to 5 beforePlanting steps for the coming weeks.`,
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "season_plan", strict: true, schema: SCHEMA } },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("The planner returned an empty answer");
  const plan = JSON.parse(content) as SeasonPlan;

  // Enforce the hard limits on what the model proposed, and repair empty text.
  const warnings: string[] = [];
  const names = (ids: CropId[]) => ids.map((id) => CROPS[id].name).join(" and ");
  if (!plan.headline.trim()) plan.headline = `Plant ${names(plan.allocations.map((a) => a.crop))} next season`;
  plan.risks = plan.risks
    .map((r) => {
      if (r.action.trim()) return r;
      const [first, ...rest] = r.risk.split(/(?<=\.)\s+/);
      return { risk: first, action: rest.join(" ") };
    })
    .filter((r) => r.risk.trim());
  // A crop that cannot grow here is never a "good fit", whatever the model said.
  plan.ranking = plan.ranking.map((r) => {
    const s = options.find((o) => o.crop === r.crop)?.suitability;
    return s && (!s.seasonOk || !s.rainOk || s.zoneFit === "poor") ? { ...r, fit: "not_advised" as const } : r;
  });
  plan.allocations = plan.allocations.filter((a) => CROPS[a.crop] && a.hectares > 0);
  const allocated = plan.allocations.reduce((s, a) => s + a.hectares, 0);
  if (allocated > farm.hectares * 1.001) {
    const k = farm.hectares / allocated;
    plan.allocations = plan.allocations.map((a) => ({ ...a, hectares: Math.round(a.hectares * k * 100) / 100 }));
    warnings.push("The plan used more land than you have, so each crop's area was scaled down to fit.");
  }

  const economics = plan.allocations.map((a) => cropEconomics(a.crop, a.hectares, farm.experience, sheet.prices, labour));
  const cost = economics.reduce((s, e) => s + e.totalCost, 0);
  const sum = (k: "low" | "expected" | "high", f: "revenue" | "profit") => economics.reduce((s, e) => s + e[f][k], 0);
  if (cost > farm.budgetNaira) warnings.push(`This plan costs ${naira(cost)}, more than your ${naira(farm.budgetNaira)} budget. Plant less land or find more money first.`);
  else if (cost > spendable) warnings.push(`This plan uses almost all your budget. Try to keep about ${naira(farm.budgetNaira * RESERVE)} aside for surprises.`);
  const lowConfidence = plan.allocations.filter((a) => sheet.prices.find((p) => p.key === `crop_${a.crop}`)?.confidence === "low");
  if (lowConfidence.length) warnings.push(`Selling prices for ${lowConfidence.map((a) => CROPS[a.crop].name).join(", ")} are uncertain. Check your local market and update the price.`);

  return {
    plan,
    economics,
    options,
    totals: {
      cost,
      budget: farm.budgetNaira,
      reserve: farm.budgetNaira - cost,
      revenue: { low: sum("low", "revenue"), expected: sum("expected", "revenue"), high: sum("high", "revenue") },
      profit: { low: sum("low", "profit"), expected: sum("expected", "profit"), high: sum("high", "profit") },
    },
    warnings,
    prices: sheet,
    irrigation,
    labour,
    createdAt: new Date().toISOString(),
    model: MODELS.wonder,
  };
}
