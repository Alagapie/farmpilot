// Season planning pipeline:
//   1. farm facts  2. live prices  3. crop suitability (rules)  4. economics (engine)
//   5. Muse Wonder chooses crops, areas, varieties and windows  6. validator checks
//   and repairs the result. Muse Wonder never produces money figures.
import { CROP_IDS, CROPS, type CropId, type PriceKey } from "@/data/crops";
import { cropEconomics, nitrogenFactor, riskAdjusted, suitability, type CropEconomics, type EconomicsContext, type LabourMode, type Suitability } from "./economics";
import { meta, MODELS } from "./meta";
import { effectiveSoil, plainRain, plainSoil } from "./plain";
import { getPriceSheet, type Price, type PriceSheet } from "./prices";
import { validatePlan, type Check } from "./validate";
import type { Farm } from "./types";

export type Fit = "excellent" | "good" | "conditional" | "poor";

export interface PlanAllocation {
  crop: CropId;
  hectares: number;
  variety: string;
  /** Nursery sowing date for transplanted crops, else "". */
  nurseryStart: string;
  /** Sowing (or transplanting) window: an estimate, triggered by the planting rule. */
  plantFrom: string;
  plantTo: string;
  why: string;
}

export interface SeasonPlan {
  headline: string;
  summary: string;
  allocations: PlanAllocation[];
  unusedLandReason: string;
  ranking: { crop: CropId; fit: Fit; reason: string }[];
  whatWouldChange: string[];
  risks: { risk: string; action: string }[];
  beforePlanting: string[];
}

export interface AllocationDetail {
  allocation: PlanAllocation;
  economics: CropEconomics;
  harvestFrom: string;
  harvestTo: string;
  plantingTrigger: string;
  /** Set when the seed price is for a different product than the chosen variety. */
  seedPriceNote: string | null;
}

export interface Budget {
  total: number;
  reserve: number;
  availableForFarming: number;
  planned: number;
  remainingSpendable: number;
  remainingTotal: number;
}

export interface PlanResult {
  plan: SeasonPlan;
  details: AllocationDetail[];
  /** Every crop costed for one hectare, for side-by-side comparison. */
  options: { crop: CropId; perHa: CropEconomics; suitability: Suitability; riskAdjusted: number }[];
  budget: Budget;
  land: { total: number; allocated: number; unallocated: number };
  totals: { cost: number; revenue: Record<"low" | "expected" | "high", number>; margin: Record<"low" | "expected" | "high", number> };
  checks: Check[];
  warnings: string[];
  prices: PriceSheet;
  irrigation: boolean;
  labour: LabourMode;
  createdAt: string;
  model: string;
}

const RESERVE = 0.1; // keep 10% of the budget for surprises

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
          nurseryStart: { type: "string" },
          plantFrom: { type: "string" },
          plantTo: { type: "string" },
          why: { type: "string" },
        },
        required: ["crop", "hectares", "variety", "nurseryStart", "plantFrom", "plantTo", "why"],
        additionalProperties: false,
      },
    },
    unusedLandReason: { type: "string" },
    ranking: {
      type: "array",
      items: {
        type: "object",
        properties: {
          crop: { type: "string", enum: CROP_IDS },
          fit: { type: "string", enum: ["excellent", "good", "conditional", "poor"] },
          reason: { type: "string" },
        },
        required: ["crop", "fit", "reason"],
        additionalProperties: false,
      },
    },
    whatWouldChange: { type: "array", items: { type: "string" } },
    risks: {
      type: "array",
      items: {
        type: "object",
        properties: { risk: { type: "string" }, action: { type: "string" } },
        required: ["risk", "action"],
        additionalProperties: false,
      },
    },
    beforePlanting: { type: "array", items: { type: "string" } },
  },
  required: ["headline", "summary", "allocations", "unusedLandReason", "ranking", "whatWouldChange", "risks", "beforePlanting"],
  additionalProperties: false,
};

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

function applyOverrides(sheet: PriceSheet, overrides: Partial<Record<PriceKey, number>>): PriceSheet {
  return {
    ...sheet,
    prices: sheet.prices.map((p): Price => {
      const v = overrides[p.key];
      return v && v > 0 ? { ...p, typical: v, low: Math.round(v * 0.85), high: Math.round(v * 1.15), edited: true, confidence: "high" } : p;
    }),
  };
}

/** Sentences that state money amounts are dropped: every naira figure must come from the engine. */
const MONEY = /₦|naira|\bN\s?\d[\d,]{2,}/i;
function withoutMoney(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((s) => !MONEY.test(s))
    .join(" ")
    .trim();
}

export interface PlanOptions {
  irrigation: boolean;
  labour: LabourMode;
  overrides?: Partial<Record<PriceKey, number>>;
}

export async function buildPlan(farm: Farm, { irrigation, labour, overrides = {} }: PlanOptions): Promise<PlanResult> {
  // 1–2. Facts and prices
  const sheet = applyOverrides(await getPriceSheet(farm.data.place.state ?? "Nigeria"), overrides);
  const soil = effectiveSoil(farm.data.soil, farm.labSoil);
  const ctx: EconomicsContext = { experience: farm.experience, prices: sheet.prices, labour, soilNitrogen: soil?.nitrogen?.value ?? null };
  const spendable = Math.round(farm.budgetNaira * (1 - RESERVE));

  // 3–4. Suitability rules and per-hectare economics for every crop
  const options = CROP_IDS.map((id) => {
    const perHa = cropEconomics(id, 1, ctx);
    return { crop: id, perHa, suitability: suitability(id, farm, irrigation), riskAdjusted: riskAdjusted(perHa) };
  });

  const candidates = options.map(({ crop: id, perHa, suitability: fit, riskAdjusted: score }) => {
    const c = CROPS[id];
    return {
      crop: id,
      suitability: fit,
      growingDays: c.growingDays,
      nurseryDays: c.nurseryDays ?? 0,
      monthsOnLand: c.monthsOnLand,
      varieties: c.varieties,
      plantingRule: c.plantingRule,
      risk: c.risk,
      strengths: c.strengths,
      risks: c.risks,
      soilNotes: c.soilNotes,
      perHectare: {
        cost: perHa.totalCost,
        expectedMargin: perHa.scenarios.expected.margin,
        worstCaseMargin: perHa.scenarios.low.margin,
        bestCaseMargin: perHa.scenarios.high.margin,
        marginPerMonthOnLand: perHa.marginPerMonth,
        riskAdjustedScore: score,
        maxAffordableHectares: Math.round((spendable / perHa.totalCost) * 100) / 100,
      },
      sellingPrice: (() => {
        const p = sheet.prices.find((x) => x.key === `crop_${id}`);
        return { confidence: p?.confidence ?? "low", type: p?.priceType ?? "unknown" };
      })(),
    };
  });

  const facts = {
    today: new Date().toISOString().slice(0, 10),
    farm: {
      location: farm.data.place.label,
      zone: farm.data.zone,
      hectares: farm.hectares,
      budgetNaira: farm.budgetNaira,
      spendableAfterReserveNaira: spendable,
      experience: farm.experience,
      goal: farm.goal,
      cropsFarmerIsConsidering: farm.interests,
      irrigationForDrySeason: irrigation,
      farmWork: labour === "family" ? "mostly family labour" : labour === "mixed" ? "family plus some hired help" : "all hired labour",
    },
    rain: farm.data.climate ? { ...plainRain(farm.data.climate), rainyMonths: farm.data.climate.rainyMonths } : "unknown",
    soil: soil
      ? {
          properties: plainSoil(soil).map(({ label, estimate, rating, confidence }) => ({ label, estimate, rating, source: confidence === "lab" ? "lab test" : `satellite estimate (${confidence} confidence)` })),
          unknown: ["drainage", "water-holding capacity", "phosphorus", "potassium", "field slope"],
        }
      : "unknown",
    crops: candidates,
  };

  // 5. Muse Wonder decides
  const res = await meta().chat.completions.create({
    model: MODELS.wonder,
    reasoning_effort: "medium",
    messages: [
      {
        role: "developer",
        content: `You are FarmPilot's season planner, an experienced Nigerian agronomist and farm business adviser.
Choose what this smallholder farmer should plant in their next season and how much land to give each crop.

The app has already: checked each crop's suitability with rules ("suitability"), and computed every crop's economics per hectare from extension rates and live prices ("perHectare"). Use them. Decide on: suitability, the farmer's experience, goal and interests, risk-adjusted economics (not just the biggest margin), worst-case loss against the budget, time on the land, and price confidence.

Hard rules:
- Total hectares must not exceed the farm size. Total cost (perHectare.cost × hectares) must not exceed spendableAfterReserveNaira.
- Leaving land unplanted is allowed when money, water, labour or risk make it wise. Always explain it in unusedLandReason (write "All land is used." if none is left).
- At most 2 crops for "new" farmers, at most 3 otherwise. No allocation under 0.1 ha.
- Pick varieties only from the crop's varieties list.
- Dates are YYYY-MM-DD. plantFrom–plantTo is the sowing or transplanting window (1 to 3 weeks), an estimate that follows the crop's planting rule and the rainy months, using the next suitable season after today.
- For crops with nurseryDays > 0, set nurseryStart = plantFrom minus nurseryDays; otherwise nurseryStart is "".
- ranking: every crop, best first. fit: "excellent" (strong suitability supported by the data), "good" (suitable with manageable limits), "conditional" (only if a condition the farmer must confirm is met; say which), "poor" (major constraints). A crop whose suitability has seasonOk or rainOk false, or zoneFit "poor", is "poor". A crop with a suitability condition is at best "conditional".
- whatWouldChange: 2 to 4 short statements of what would change your decision (for example more water, a lab soil test, a higher selling price).
- Soil: say whether a soil fact is a lab test or a satellite estimate when it matters. Do not claim things the data does not show (drainage and water-holding are unknown).
- Soybean improves the nitrogen balance when well nodulated (inoculant helps); do not say it fixes a nitrogen shortage by itself.
- Use correct pest names, e.g. "Tuta absoluta (tomato leaf miner)", "fall armyworm". For pesticides, say to scout first and follow the label rate and pre-harvest interval.
- NEVER write money amounts, prices, costs or profit figures in any text field. The app shows all numbers.

Writing: the farmer reads every text field. Use very simple English, short sentences, no jargon. Every text field must be filled in. "why" and "reason" at most 30 words each. 3 to 5 risks, each with an action. 3 to 5 beforePlanting steps for the coming weeks.`,
      },
      { role: "user", content: JSON.stringify(facts) },
    ],
    response_format: { type: "json_schema", json_schema: { name: "season_plan", strict: true, schema: SCHEMA } },
  });
  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("The planner returned an empty answer");
  const plan = JSON.parse(content) as SeasonPlan;

  // 6. Repair and validate
  const warnings: string[] = [];
  plan.allocations = plan.allocations.filter((a) => CROPS[a.crop] && a.hectares > 0);
  const allocatedRaw = plan.allocations.reduce((s, a) => s + a.hectares, 0);
  if (allocatedRaw > farm.hectares * 1.001) {
    const k = farm.hectares / allocatedRaw;
    plan.allocations = plan.allocations.map((a) => ({ ...a, hectares: Math.floor(a.hectares * k * 100) / 100 }));
    warnings.push("The plan used more land than you have, so each crop's area was scaled down to fit.");
  }

  // Strip any money figures the model wrote, and fill empty text.
  const names = plan.allocations.map((a) => CROPS[a.crop].name).join(" and ");
  plan.headline = withoutMoney(plan.headline) || `Plant ${names} next season`;
  plan.summary = withoutMoney(plan.summary);
  plan.unusedLandReason = withoutMoney(plan.unusedLandReason);
  plan.allocations = plan.allocations.map((a) => ({ ...a, why: withoutMoney(a.why) }));
  plan.whatWouldChange = plan.whatWouldChange.map(withoutMoney).filter(Boolean);
  plan.beforePlanting = plan.beforePlanting.map(withoutMoney).filter(Boolean);
  plan.risks = plan.risks
    .map((r) => {
      const risk = withoutMoney(r.risk);
      const action = withoutMoney(r.action);
      if (action) return { risk, action };
      const [first, ...rest] = risk.split(/(?<=\.)\s+/);
      return { risk: first, action: rest.join(" ") };
    })
    .filter((r) => r.risk);

  // Suitability rules outrank the model's label.
  plan.ranking = plan.ranking.map((r) => {
    const s = options.find((o) => o.crop === r.crop)?.suitability;
    if (!s) return { ...r, reason: withoutMoney(r.reason) };
    const poor = !s.seasonOk || !s.rainOk || s.zoneFit === "poor";
    const fit: Fit = poor ? "poor" : s.condition && (r.fit === "excellent" || r.fit === "good") ? "conditional" : r.fit;
    return { ...r, fit, reason: withoutMoney(r.reason) };
  });

  // Transplanted crops: the nursery date follows from the transplant window.
  plan.allocations = plan.allocations.map((a) => {
    const nursery = CROPS[a.crop].nurseryDays;
    return { ...a, nurseryStart: nursery ? addDays(a.plantFrom, -nursery) : "" };
  });

  const details: AllocationDetail[] = plan.allocations.map((a) => {
    const c = CROPS[a.crop];
    const seedItem = c.inputs[0].item;
    const seedPrice = sheet.prices.find((p) => p.key === seedItem);
    const varietyKey = a.variety.split(/[\s(/]+/).slice(0, 2).join(" ").toLowerCase();
    const matched = seedPrice?.matchedProduct ?? "";
    const seedPriceNote =
      seedPrice && !seedPrice.edited && matched && !matched.toLowerCase().includes(varietyKey)
        ? `Seed price is for ${matched}, not ${a.variety}; treat it as an estimate and ask your agro-dealer.`
        : null;
    return {
      allocation: a,
      economics: cropEconomics(a.crop, a.hectares, ctx),
      harvestFrom: addDays(a.plantFrom, c.growingDays[0]),
      harvestTo: addDays(a.plantTo, c.growingDays[1]),
      plantingTrigger: c.plantingRule,
      seedPriceNote,
    };
  });

  const cost = details.reduce((s, d) => s + d.economics.totalCost, 0);
  const sum = (k: "low" | "expected" | "high", f: "revenue" | "margin") => details.reduce((s, d) => s + d.economics.scenarios[k][f], 0);
  const allocated = Math.round(plan.allocations.reduce((s, a) => s + a.hectares, 0) * 100) / 100;
  const budget: Budget = {
    total: farm.budgetNaira,
    reserve: farm.budgetNaira - spendable,
    availableForFarming: spendable,
    planned: cost,
    remainingSpendable: spendable - cost,
    remainingTotal: farm.budgetNaira - cost,
  };

  if (cost > farm.budgetNaira) warnings.push(`This plan costs ${naira(cost)}, more than your ${naira(farm.budgetNaira)} budget. Plant less land or find more money first.`);
  else if (cost > spendable) warnings.push(`This plan dips into your emergency reserve of ${naira(budget.reserve)}. Try to keep that money aside for surprises.`);
  for (const d of details) {
    const p = sheet.prices.find((x) => x.key === `crop_${d.allocation.crop}`);
    if (p?.confidence === "low") warnings.push(`The selling price for ${CROPS[d.allocation.crop].name} is uncertain. Check your local market and type your price below.`);
    if (p?.priceType === "wholesale" || p?.priceType === "retail") warnings.push(`The ${CROPS[d.allocation.crop].name} price found is a ${p.priceType} market price; buyers at the farm gate usually pay less. Type your farm-gate price below if you know it.`);
    if (d.seedPriceNote) warnings.push(d.seedPriceNote);
  }
  if (nitrogenFactor(ctx.soilNitrogen) < 1) warnings.push("Urea rates were reduced because your soil estimate shows some nitrogen; a soil test will confirm the right amount.");

  const result: Omit<PlanResult, "checks"> = {
    plan,
    details,
    options,
    budget,
    land: { total: farm.hectares, allocated, unallocated: Math.max(0, Math.round((farm.hectares - allocated) * 100) / 100) },
    totals: {
      cost,
      revenue: { low: sum("low", "revenue"), expected: sum("expected", "revenue"), high: sum("high", "revenue") },
      margin: { low: sum("low", "margin"), expected: sum("expected", "margin"), high: sum("high", "margin") },
    },
    warnings,
    prices: sheet,
    irrigation,
    labour,
    createdAt: new Date().toISOString(),
    model: MODELS.wonder,
  };
  return { ...result, checks: validatePlan(result, farm) };
}
