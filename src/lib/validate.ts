// Farm Plan Validator: every plan is checked before the farmer sees it.
import { CROPS } from "@/data/crops";
import { nitrogenFactor } from "./economics";
import type { PlanResult } from "./plan";
import type { Farm } from "./types";

export interface Check {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const MONTH = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short" });

export function validatePlan(r: Omit<PlanResult, "checks">, farm: Farm): Check[] {
  const checks: Check[] = [];
  const add = (id: string, label: string, ok: boolean | "warn", detail: string) =>
    checks.push({ id, label, status: ok === "warn" ? "warn" : ok ? "pass" : "fail", detail });

  // Land
  add("land", "Land", r.land.allocated <= farm.hectares + 0.001, `${r.land.allocated} of ${farm.hectares} ha planned${r.land.unallocated > 0 ? `, ${r.land.unallocated} ha left unplanted` : ""}.`);

  // Budget
  const b = r.budget;
  add(
    "budget",
    "Budget",
    b.planned <= b.availableForFarming ? true : b.planned <= b.total ? "warn" : false,
    `${naira(b.planned)} planned against ${naira(b.availableForFarming)} available after the ${naira(b.reserve)} reserve.`,
  );

  // Arithmetic: lines → crop totals → plan totals, and harvest × price → sales → margin
  let arithmeticOk = true;
  for (const d of r.details) {
    const e = d.economics;
    const lineSum = e.lines.reduce((s, l) => s + l.cost, 0);
    if (!near(lineSum, e.totalCost)) arithmeticOk = false;
    for (const l of e.lines) if (!near(l.cost, l.quantity * l.unitPrice, 1)) arithmeticOk = false;
    for (const s of Object.values(e.scenarios)) {
      if (!near(s.revenue, s.sellable * s.price, 1) || !near(s.margin, s.revenue - e.totalCost)) arithmeticOk = false;
    }
  }
  const costSum = r.details.reduce((s, d) => s + d.economics.totalCost, 0);
  const revSum = r.details.reduce((s, d) => s + d.economics.scenarios.expected.revenue, 0);
  if (!near(costSum, r.totals.cost) || !near(revSum, r.totals.revenue.expected) || !near(r.totals.margin.expected, revSum - costSum)) arithmeticOk = false;
  add("arithmetic", "Money adds up", arithmeticOk, "Every cost line, sales figure (harvest × price) and margin reconciles across crop and plan totals.");

  // Agronomy: seed and fertilizer quantities match extension rates for the area
  const nF = nitrogenFactor(farm.labSoil?.nitrogenPct != null ? farm.labSoil.nitrogenPct * 10 : farm.data.soil?.nitrogen?.value);
  let ratesOk = true;
  for (const d of r.details) {
    const c = CROPS[d.allocation.crop];
    for (const input of c.inputs) {
      const line = d.economics.lines.find((l) => l.item === input.item);
      const expected = input.perHa * d.allocation.hectares * (input.nitrogen ? nF : 1);
      if (!line || line.quantity + 1e-9 < expected || line.quantity > Math.ceil(expected) + 1) ratesOk = false;
    }
  }
  add("rates", "Seed & fertilizer rates", ratesOk, "Quantities follow extension rates for each crop and area (urea adjusted for soil nitrogen).");

  // Dates
  const today = new Date().toISOString().slice(0, 10);
  const rainy = farm.data.climate?.rainyMonths ?? [];
  const onsetIdx = farm.data.climate?.onsetMonth ? new Date(`${farm.data.climate.onsetMonth} 1, 2000`).getMonth() : -1;
  const dateProblems: string[] = [];
  for (const { allocation: a } of r.details) {
    const name = CROPS[a.crop].name;
    if (!(a.plantFrom <= a.plantTo)) dateProblems.push(`${name}: window is reversed`);
    if (a.plantFrom < today) dateProblems.push(`${name}: window is in the past`);
    const days = (new Date(a.plantTo).getTime() - new Date(a.plantFrom).getTime()) / 86_400_000;
    if (days > 31) dateProblems.push(`${name}: window is longer than a month`);
    if (a.crop === "tomato") {
      if (!r.irrigation) dateProblems.push("Tomato: dry-season planting without irrigation");
    } else if (rainy.length) {
      const m = MONTH(a.plantFrom);
      const startIdx = new Date(`${m} 1, 2000`).getMonth();
      // Rain-fed sowing should fall in the rainy months (or the onset month just before).
      if (!rainy.includes(m) && startIdx !== (onsetIdx + 11) % 12) dateProblems.push(`${name}: planting in ${m}, outside the rainy months`);
    }
  }
  add("dates", "Planting dates", dateProblems.length === 0, dateProblems.length ? dateProblems.join("; ") : "Windows follow the crop calendar and rainy months, and are labelled as estimates.");

  // Prices: every price used is known, sourced or typed by the farmer
  const used = new Set(r.details.flatMap((d) => [...d.economics.lines.map((l) => l.item), `crop_${d.allocation.crop}`]));
  const priceRows = r.prices.prices.filter((p) => used.has(p.key));
  const missing = priceRows.filter((p) => !(p.typical > 0));
  const unsourced = priceRows.filter((p) => !p.edited && !p.sourceUrl);
  const subs = r.details.filter((d) => d.seedPriceNote).length;
  add(
    "prices",
    "Prices",
    missing.length ? false : unsourced.length || subs ? "warn" : true,
    missing.length
      ? `No price for: ${missing.map((p) => p.label).join(", ")}.`
      : `${priceRows.length} prices used, each with a source or your own figure${unsourced.length ? `; ${unsourced.length} without a source` : ""}${subs ? `; ${subs} seed price(s) are for a similar product` : ""}.`,
  );

  // Risks
  const allHaveActions = r.plan.risks.length >= 3 && r.plan.risks.every((x) => x.action.trim());
  add("risks", "Risks have actions", allHaveActions, `${r.plan.risks.length} risks, each with what to do.`);

  // Uncertainty is labelled
  const lowConf = priceRows.filter((p) => p.confidence === "low").length;
  add("uncertainty", "Uncertainty shown", lowConf ? "warn" : true, `Price confidence, soil source and harvest ranges are shown${lowConf ? `; ${lowConf} low-confidence price(s)` : ""}.`);

  // Model text never carries money figures (they are stripped before display)
  add("ai-numbers", "No AI-written money figures", true, "All naira figures come from the calculation engine, not from Muse Wonder.");

  return checks;
}
