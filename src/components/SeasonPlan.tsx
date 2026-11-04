"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, CircleAlert, CircleCheck, CircleX, ExternalLink, Loader2, RefreshCw, ShieldCheck, ShoppingCart, Sparkles, Sprout } from "lucide-react";
import { CROPS, type CostCategory, type CropId, type PriceKey } from "@/data/crops";
import type { CropEconomics, LabourMode } from "@/lib/economics";
import type { AllocationDetail, Fit, PlanResult } from "@/lib/plan";
import type { Price } from "@/lib/prices";
import { shortDay } from "@/lib/plain";
import type { Farm } from "@/lib/types";

export const CROP_EMOJI: Record<CropId, string> = { maize: "🌽", rice: "🍚", soybean: "🫘", sorghum: "🌾", cassava: "🥔", tomato: "🍅" };
const CROP_COLOR: Record<CropId, string> = { maize: "#e8a317", rice: "#3b82c4", soybean: "#9a6a3c", sorghum: "#b45309", cassava: "#7c3aed", tomato: "#dc2626" };

const FIT: Record<Fit, { text: string; cls: string }> = {
  excellent: { text: "Excellent fit", cls: "bg-leaf-600 text-white" },
  good: { text: "Good fit", cls: "bg-leaf-100 text-leaf-700" },
  conditional: { text: "Conditional fit", cls: "bg-sun-100 text-amber-800" },
  poor: { text: "Poor fit", cls: "bg-red-100 text-red-700" },
};

const CONF = { high: "text-leaf-700", medium: "text-amber-700", low: "text-red-700" } as const;
const RISK = { low: "text-leaf-700", medium: "text-amber-700", high: "text-red-700" } as const;

const naira = (n: number) => `${n < 0 ? "−" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
const qty = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
const pct = (n: number) => `${Math.round(n * 100)}%`;

// ---------------------------------------------------------------- setup

function Choice<T extends string>({ value, options, onChange }: { value: T; options: [T, string, string][]; onChange: (v: T) => void }) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {options.map(([v, label, hint]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-2xl border p-4 text-left ${value === v ? "border-leaf-600 bg-leaf-50" : "border-line bg-white hover:border-leaf-500"}`}
        >
          <span className="flex items-center justify-between font-semibold">
            {label}
            {value === v && <Check className="h-4 w-4 text-leaf-600" />}
          </span>
          <span className="mt-1 block text-sm text-muted">{hint}</span>
        </button>
      ))}
    </div>
  );
}

const STAGES = [
  "Checking today's input and crop prices (Muse Spark + web search)",
  "Scoring 6 crops for your zone, rain, soil and water (rules)",
  "Costing every crop from extension rates (calculation engine)",
  "Choosing crops, land and planting windows (Muse Wonder)",
  "Validating land, budget, arithmetic, rates and dates",
];

function Building({ started }: { started: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.floor((now - started) / 1000);
  const stage = secs < 8 ? 0 : secs < 10 ? 1 : secs < 12 ? 2 : secs < 50 ? 3 : 4;
  return (
    <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <Sparkles className="h-8 w-8 text-leaf-600" />
      <h2 className="mt-3 text-2xl font-bold">Building your season plan…</h2>
      <p className="text-sm text-muted">This takes about a minute. FarmPilot is doing real research, not guessing. ({secs}s)</p>
      <ul className="mt-6 space-y-3">
        {STAGES.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 text-sm ${i <= stage ? "text-ink" : "text-muted/50"}`}>
            {i < stage ? <Check className="h-4 w-4 text-leaf-600" /> : i === stage ? <Loader2 className="h-4 w-4 animate-spin text-leaf-600" /> : <span className="h-4 w-4 rounded-full border border-line" />}
            {s}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- plan pieces

function Checks({ result }: { result: PlanResult }) {
  const [open, setOpen] = useState(false);
  const fails = result.checks.filter((c) => c.status === "fail").length;
  const warns = result.checks.filter((c) => c.status === "warn").length;
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className={`h-5 w-5 ${fails ? "text-red-600" : "text-leaf-600"}`} /> Plan checks
        </span>
        <span className="text-sm">
          <b className="text-leaf-700">{result.checks.length - fails - warns} passed</b>
          {warns > 0 && <b className="ml-2 text-amber-700">{warns} to watch</b>}
          {fails > 0 && <b className="ml-2 text-red-700">{fails} failed</b>}
          <span className="ml-2 text-muted">{open ? "Hide" : "Show"}</span>
        </span>
      </button>
      {open && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {result.checks.map((c) => (
            <li key={c.id} className="flex gap-2 rounded-2xl bg-canvas p-3 text-sm">
              {c.status === "pass" ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-leaf-600" />
              ) : c.status === "warn" ? (
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <span>
                <b>{c.label}.</b> {c.detail}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LandCard({ result }: { result: PlanResult }) {
  const { land, plan } = result;
  const segs = [
    ...plan.allocations.map((a) => ({ key: a.crop, label: `${CROPS[a.crop].name} · ${a.hectares} ha`, ha: a.hectares, color: CROP_COLOR[a.crop] })),
    ...(land.unallocated > 0 ? [{ key: "free", label: `Not planted · ${land.unallocated} ha`, ha: land.unallocated, color: "#d6d3c8" }] : []),
  ];
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">🗺️ Your land</h2>
      <p className="text-sm text-muted">{land.total} ha in total</p>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full">
        {segs.map((s) => (
          <div key={s.key} style={{ width: `${(s.ha / land.total) * 100}%`, background: s.color }} title={s.label} />
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="text-muted">{pct(s.ha / land.total)}</span>
          </li>
        ))}
      </ul>
      {plan.unusedLandReason && land.unallocated > 0 && <p className="mt-3 rounded-2xl bg-canvas p-3 text-sm">{plan.unusedLandReason}</p>}
    </section>
  );
}

function BudgetCard({ result }: { result: PlanResult }) {
  const b = result.budget;
  const rows: [string, number, string?][] = [
    ["Total money you have", b.total],
    ["Emergency reserve (10%)", -b.reserve, "Kept aside for price rises, replanting or illness"],
    ["Available for farming", b.availableForFarming],
    ["Planned spending", -b.planned],
    ["Left to spend", b.remainingSpendable],
  ];
  const usedPct = Math.min((b.planned / b.availableForFarming) * 100, 100);
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">💰 Your budget</h2>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-canvas">
        <div className={`h-full rounded-full ${b.planned > b.availableForFarming ? "bg-red-500" : "bg-leaf-500"}`} style={{ width: `${usedPct}%` }} />
      </div>
      <table className="mt-3 w-full text-sm">
        <tbody>
          {rows.map(([label, v, hint], i) => (
            <tr key={label} className={i === 2 || i === 4 ? "border-t border-line font-bold" : ""}>
              <td className="py-1.5">
                {label}
                {hint && <span className="block text-xs font-normal text-muted">{hint}</span>}
              </td>
              <td className={`py-1.5 text-right ${v < 0 ? "text-muted" : ""}`}>{naira(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">If nothing goes wrong you keep the reserve too: {naira(b.remainingTotal)} unspent in total.</p>
    </section>
  );
}

function OutcomeCard({ result }: { result: PlanResult }) {
  const { totals } = result;
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">📈 What you could earn</h2>
      <div className={`mt-3 rounded-2xl p-4 ${totals.margin.expected >= 0 ? "bg-leaf-50" : "bg-red-50"}`}>
        <p className="text-xs text-muted">Estimated margin after listed costs</p>
        <p className={`text-2xl font-bold ${totals.margin.expected >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(totals.margin.expected)}</p>
        <p className="text-xs text-muted">
          Bad year {naira(totals.margin.low)} · good year {naira(totals.margin.high)}
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-canvas p-3">
          <dt className="text-xs text-muted">Expected sales</dt>
          <dd className="font-bold">{naira(totals.revenue.expected)}</dd>
        </div>
        <div className="rounded-2xl bg-canvas p-3">
          <dt className="text-xs text-muted">Listed costs</dt>
          <dd className="font-bold">{naira(totals.cost)}</dd>
        </div>
      </dl>
      {totals.margin.low < 0 && (
        <p className="mt-3 text-sm">
          Be ready: in a bad year (poor rain and low prices) you could lose up to <b className="text-red-700">{naira(-totals.margin.low)}</b>.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        This is an estimate, not a guaranteed profit. It includes the costs listed in each shopping list, harvest losses, bags and transport. It does not include
        land rent, loan interest or storage.{" "}
        {result.labour === "family" ? "Family does most work (20% hired)." : result.labour === "mixed" ? "Family plus hired help (50% hired)." : "All work hired."} Family labour isn&apos;t
        counted as cash.
      </p>
    </section>
  );
}

const CATEGORY_ORDER: CostCategory[] = ["Seed & planting material", "Fertilizer & soil", "Crop protection", "Water", "Land & labour", "Harvest & selling"];

function ShoppingList({ e }: { e: CropEconomics }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 font-semibold">How much</th>
            <th className="px-3 py-2 font-semibold">Price</th>
            <th className="px-3 py-2 text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.filter((cat) => e.lines.some((l) => l.category === cat)).map((cat) => (
            <CategoryRows key={cat} cat={cat} e={e} />
          ))}
          <tr className="border-t border-line bg-canvas font-bold">
            <td className="px-3 py-2" colSpan={3}>
              Total listed costs
            </td>
            <td className="px-3 py-2 text-right">{naira(e.totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CategoryRows({ cat, e }: { cat: CostCategory; e: CropEconomics }) {
  const lines = e.lines.filter((l) => l.category === cat);
  return (
    <>
      <tr className="border-t border-line bg-canvas/50">
        <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {cat}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold text-muted">{naira(lines.reduce((s, l) => s + l.cost, 0))}</td>
      </tr>
      {lines.map((l) => (
        <tr key={l.item} className="border-t border-line align-top">
          <td className="px-3 py-2">
            <span className="font-medium">{l.label}</span>
            <span className="block text-xs text-muted">{l.when}</span>
            {l.note && <span className="block text-xs text-amber-800">{l.note}</span>}
          </td>
          <td className="px-3 py-2">
            {qty(l.quantity)} × {l.unit}
            {/50kg bag/.test(l.unit) && !Number.isInteger(l.quantity) && <span className="block text-xs text-muted">= {Math.round(l.quantity * 50)} kg</span>}
          </td>
          <td className="px-3 py-2 text-muted">{naira(l.unitPrice)}</td>
          <td className="px-3 py-2 text-right font-semibold">{naira(l.cost)}</td>
        </tr>
      ))}
    </>
  );
}

function SalesMath({ e }: { e: CropEconomics }) {
  const rows = [
    ["Bad year", e.scenarios.low],
    ["Expected", e.scenarios.expected],
    ["Good year", e.scenarios.high],
  ] as const;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Case</th>
            <th className="px-3 py-2 font-semibold">Harvest → to sell</th>
            <th className="px-3 py-2 font-semibold">× Price</th>
            <th className="px-3 py-2 text-right font-semibold">= Sales</th>
            <th className="px-3 py-2 text-right font-semibold">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, s]) => (
            <tr key={label} className={`border-t border-line ${label === "Expected" ? "font-semibold" : ""}`}>
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2">
                {qty(s.harvest)} → {qty(s.sellable)} <span className="text-xs text-muted">{e.unit}</span>
              </td>
              <td className="px-3 py-2">{naira(s.price)}</td>
              <td className="px-3 py-2 text-right">{naira(s.revenue)}</td>
              <td className={`px-3 py-2 text-right ${s.margin >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(s.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        &quot;To sell&quot; allows {pct(e.postHarvestLoss)} for losses from pests, spoilage and handling. Margin = sales − {naira(e.totalCost)} listed costs.
      </p>
    </div>
  );
}

function CropPlanCard({ d }: { d: AllocationDetail }) {
  const { allocation: a, economics: e } = d;
  const crop = CROPS[a.crop];
  const dates: [string, string, string][] = [
    ...(a.nurseryStart ? [["Start nursery", shortDay(a.nurseryStart), `${crop.nurseryDays} days in the nursery`] as [string, string, string]] : []),
    [a.nurseryStart ? "Transplant" : "Plant", `${shortDay(a.plantFrom)} – ${shortDay(a.plantTo)}`, "Estimated window"],
    ["Harvest", `${shortDay(d.harvestFrom)} – ${shortDay(d.harvestTo)}`, `${crop.growingDays[0]}–${crop.growingDays[1]} days`],
  ];
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h3 className="flex flex-wrap items-center gap-2 text-xl font-bold">
        <span className="text-2xl">{CROP_EMOJI[a.crop]}</span> {crop.name}
        <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-sm font-semibold text-leaf-700">{a.hectares} ha</span>
      </h3>
      <p className="mt-1 text-sm text-muted">
        Variety: <b className="text-ink">{a.variety}</b>
        {crop.varieties.find((v) => v.name === a.variety) && <> · {crop.varieties.find((v) => v.name === a.variety)?.note}</>}
      </p>
      <p className="mt-3 text-[15px]">{a.why}</p>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {dates.map(([label, value, hint]) => (
          <div key={label} className="rounded-2xl bg-sky-500/10 p-3">
            <p className="text-xs text-muted">{label}</p>
            <p className="font-bold">{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm">
        <span className="font-semibold text-sky-500">When to plant: </span>
        {d.plantingTrigger} The dates are estimates; the rains decide.
      </p>

      <h4 className="mb-2 mt-5 flex items-center gap-2 font-bold">
        <ShoppingCart className="h-4 w-4 text-leaf-600" /> Shopping list
      </h4>
      <ShoppingList e={e} />
      <p className="mt-2 text-xs text-muted">
        Seed: {crop.seedNote} Spacing: {crop.spacing}.
      </p>
      {d.seedPriceNote && <p className="mt-1 text-xs font-semibold text-amber-800">{d.seedPriceNote}</p>}

      <h4 className="mb-2 mt-5 font-bold">🧮 Sales and margin</h4>
      <SalesMath e={e} />
    </section>
  );
}

function Comparison({ result }: { result: PlanResult }) {
  const ranked = [...result.options].sort((a, b) => b.riskAdjusted - a.riskAdjusted);
  const order = new Map(ranked.map((o, i) => [o.crop, i + 1]));
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">⚖️ How the crops compare</h2>
      <p className="text-sm text-muted">
        Per hectare on your farm, with your experience and today&apos;s prices. Crops stay on the land for different times, so compare margin per month too. Small plots cost a
        little more per hectare because seed packs and bundles come whole.
      </p>
      <ul className="mt-4 space-y-3">
        {result.plan.ranking.map((r) => {
          const o = result.options.find((x) => x.crop === r.crop);
          const chosen = result.plan.allocations.some((a) => a.crop === r.crop);
          const c = CROPS[r.crop];
          return (
            <li key={r.crop} className={`rounded-2xl border p-4 ${chosen ? "border-leaf-500 bg-leaf-50/60" : "border-line"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-bold">
                  <span className="text-xl">{CROP_EMOJI[r.crop]}</span>
                  {c.name}
                  {chosen && <span className="text-xs font-semibold text-leaf-700">· in your plan</span>}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${FIT[r.fit].cls}`}>{FIT[r.fit].text}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{r.reason}</p>
              {o?.suitability.condition && <p className="mt-1 text-xs font-semibold text-amber-800">Condition: {o.suitability.condition}</p>}
              {o && (
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  <span>
                    Cost/ha <b>{naira(o.perHa.totalCost)}</b>
                  </span>
                  <span>
                    Margin/ha <b className={o.perHa.scenarios.expected.margin >= 0 ? "text-leaf-700" : "text-red-700"}>{naira(o.perHa.scenarios.expected.margin)}</b>
                  </span>
                  <span>
                    Worst case <b className={o.perHa.scenarios.low.margin >= 0 ? "" : "text-red-700"}>{naira(o.perHa.scenarios.low.margin)}</b>
                  </span>
                  <span>
                    {c.monthsOnLand} months · <b>{naira(o.perHa.marginPerMonth)}</b>/month
                  </span>
                  <span>
                    Production risk <b className={RISK[c.risk.production]}>{c.risk.production}</b>
                  </span>
                  <span>
                    Market risk <b className={RISK[c.risk.market]}>{c.risk.market}</b>
                  </span>
                  <span>
                    Money needed <b className={RISK[c.risk.capital]}>{c.risk.capital}</b>
                  </span>
                  <span>
                    Risk-adjusted rank <b>#{order.get(r.crop)}</b>
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Risk-adjusted rank weighs expected margin against the worst-case loss and production, market and money risk.</p>
    </section>
  );
}

function PricesUsed({ result, onReplan, busy }: { result: PlanResult; onReplan: (overrides: Partial<Record<PriceKey, number>>) => void; busy: boolean }) {
  const [edits, setEdits] = useState<Partial<Record<PriceKey, string>>>({});
  const relevant = new Set<PriceKey>();
  for (const d of result.details) {
    for (const l of d.economics.lines) relevant.add(l.item);
    relevant.add(`crop_${d.allocation.crop}` as PriceKey);
  }
  const rows = result.prices.prices.filter((p) => relevant.has(p.key));
  const changed = Object.entries(edits).filter(([, v]) => v && Number(v) > 0);

  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">🏷️ Prices used</h2>
      <p className="text-sm text-muted">
        Found by Muse Spark web search for {result.prices.state} on {new Date(result.prices.fetchedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.
        Crop prices should be what a buyer pays you at the farm gate. If your market is different, type your price and re-plan.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">Price used</th>
              <th className="px-3 py-2 font-semibold">Priced product · source</th>
              <th className="px-3 py-2 font-semibold">Your price (₦)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p: Price) => (
              <tr key={p.key} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <span className="font-medium">{p.label}</span>
                  <span className="block text-xs text-muted">per {p.unit}</span>
                </td>
                <td className="px-3 py-2">
                  <b>{naira(p.typical)}</b>
                  {p.edited ? (
                    <span className="block text-xs font-semibold text-sky-500">your price</span>
                  ) : (
                    <span className="block text-xs text-muted">
                      {naira(p.low)}–{naira(p.high)} · <span className={`font-semibold ${CONF[p.confidence]}`}>{p.confidence} confidence</span>
                      <span className="block">{p.priceType} price</span>
                    </span>
                  )}
                </td>
                <td className="max-w-[260px] px-3 py-2 text-xs">
                  {p.matchedProduct && <span className="block font-medium text-ink">{p.matchedProduct}</span>}
                  {p.sourceUrl ? (
                    <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-leaf-700 hover:underline">
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{p.sourceTitle || p.sourceUrl}</span>
                    </a>
                  ) : (
                    <span className="text-muted">No source</span>
                  )}
                  {p.sourceDate && <span className="block text-muted">{p.sourceDate}</span>}
                </td>
                <td className="px-3 py-2">
                  <input
                    inputMode="numeric"
                    value={edits[p.key] ?? ""}
                    onChange={(e) => setEdits({ ...edits, [p.key]: e.target.value.replace(/[^\d]/g, "") })}
                    placeholder={Math.round(p.typical).toString()}
                    className="w-28 rounded-lg border border-line px-2 py-1 outline-none focus:border-leaf-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => onReplan(Object.fromEntries(changed.map(([k, v]) => [k, Number(v)])))}
        disabled={!changed.length || busy}
        className="mt-3 flex items-center gap-2 rounded-xl bg-leaf-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        <RefreshCw className="h-4 w-4" /> Re-plan with my prices
      </button>
    </section>
  );
}

// ---------------------------------------------------------------- main

/** Plans saved before the validator existed lack its fields; they must be rebuilt. */
const isCurrentPlan = (p: Farm["plan"]): p is PlanResult => !!p && Array.isArray((p as PlanResult).details) && Array.isArray((p as PlanResult).checks);

export default function SeasonPlan({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const result = isCurrentPlan(farm.plan) ? farm.plan : undefined;
  const [irrigation, setIrrigation] = useState<"no" | "yes">(result?.irrigation ? "yes" : "no");
  const [labour, setLabour] = useState<LabourMode>(result?.labour ?? "mixed");
  const [started, setStarted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function build(overrides: Partial<Record<PriceKey, number>> = {}) {
    setStarted(Date.now());
    setError(null);
    try {
      // Keep any prices the farmer typed before, and add the new ones.
      const kept = Object.fromEntries((result?.prices.prices ?? []).filter((p) => p.edited).map((p) => [p.key, p.typical]));
      const farmOnly: Farm = { ...farm, plan: undefined };
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farm: farmOnly, irrigation: irrigation === "yes", labour, overrides: { ...kept, ...overrides } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Planning failed");
      onUpdate({ ...farm, plan: data as PlanResult });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarted(null);
    }
  }

  if (started) return <Building started={started} />;

  if (!result || editing) {
    return (
      <section className="rounded-3xl border border-line bg-white p-6 sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-leaf-600">
          <Sprout className="h-4 w-4" /> Season plan · by Muse Wonder
        </p>
        <h2 className="mt-2 text-2xl font-bold">Two quick questions before we plan</h2>
        <p className="mt-1 text-muted">
          FarmPilot will compare 6 crops for your {farm.hectares.toFixed(2)} ha in {farm.data.place.label} with ₦{farm.budgetNaira.toLocaleString("en-NG")} to spend.
        </p>

        <div className="mt-6">
          <p className="font-semibold">1. Do you have water to farm in the dry season?</p>
          <Choice
            value={irrigation}
            onChange={setIrrigation}
            options={[
              ["no", "No, only rain", "I farm in the rainy season"],
              ["yes", "Yes, I can irrigate", "River, borehole, dam or fadama"],
            ]}
          />
        </div>
        <div className="mt-6">
          <p className="font-semibold">2. Who will do most of the farm work?</p>
          <Choice
            value={labour}
            onChange={setLabour}
            options={[
              ["family", "Mostly my family", "We hire help only at busy times"],
              ["mixed", "Family + hired help", "About half the work is paid"],
              ["hired", "I hire workers", "I pay for nearly all the work"],
            ]}
          />
        </div>

        {error && <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => build()} className="flex items-center gap-2 rounded-2xl bg-leaf-600 px-6 py-4 font-semibold text-white hover:bg-leaf-700">
            Build my season plan <ArrowRight className="h-5 w-5" />
          </button>
          {result && (
            <button onClick={() => setEditing(false)} className="rounded-2xl border border-line px-5 py-4 font-semibold">
              Cancel
            </button>
          )}
        </div>
      </section>
    );
  }

  const { plan } = result;
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-leaf-900 p-6 text-white sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-leaf-100">
          <Sparkles className="h-4 w-4" /> Your season plan · by Muse Wonder
        </p>
        <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">{plan.headline}</h1>
        <p className="mt-3 max-w-3xl text-leaf-100">{plan.summary}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {plan.allocations.map((a) => (
            <span key={a.crop} className="rounded-2xl bg-white/10 px-4 py-2">
              <span className="mr-1 text-lg">{CROP_EMOJI[a.crop]}</span>
              <b>{CROPS[a.crop].name}</b> · {a.hectares} ha · {a.nurseryStart ? `nursery ${shortDay(a.nurseryStart)}` : `plant ${shortDay(a.plantFrom)}`}
            </span>
          ))}
        </div>
      </section>

      <Checks result={result} />

      {result.warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 rounded-2xl bg-sun-100 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> {w}
        </p>
      ))}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {result.details.map((d) => (
            <CropPlanCard key={d.allocation.crop} d={d} />
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          <OutcomeCard result={result} />
          <BudgetCard result={result} />
          <LandCard result={result} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-3xl border border-line bg-white p-5 sm:p-6 lg:col-span-2">
          <h2 className="text-lg font-bold">⚠️ Risks and what to do</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {plan.risks.map((r) => (
              <li key={r.risk} className="rounded-2xl border border-line p-4">
                <p className="font-semibold">{r.risk}</p>
                {r.action && (
                  <p className="mt-1 text-sm">
                    <span className="font-semibold text-leaf-700">Do this: </span>
                    {r.action}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
        <div className="min-w-0 space-y-4">
          <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold">📝 Before you plant</h2>
            <ol className="mt-3 space-y-2 text-[15px]">
              {plan.beforePlanting.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-100 text-xs font-bold text-leaf-700">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </section>
          <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold">🔄 What would change this plan</h2>
            <ul className="mt-3 space-y-2 text-[15px]">
              {plan.whatWouldChange.map((s) => (
                <li key={s} className="flex gap-2">
                  <span>•</span>
                  {s}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <Comparison result={result} />
      <PricesUsed result={result} onReplan={build} busy={!!started} />

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-xs text-muted">
        <span>
          Planned {new Date(result.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} by {result.model}. Seed,
          fertilizer and yield figures follow IITA / NAERLS extension guides; they are planning estimates, not guarantees.
        </span>
        <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 font-semibold text-ink">
          <RefreshCw className="h-3.5 w-3.5" /> Change answers & re-plan
        </button>
      </div>
    </div>
  );
}
