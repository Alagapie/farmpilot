"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleAlert, CircleCheck, CircleX, ExternalLink, Loader2, RefreshCw, ShieldCheck, ShoppingCart, Sparkles, Sprout } from "lucide-react";
import { CROPS, type CostCategory, type CropId, type PriceKey } from "@/data/crops";
import type { CropEconomics, LabourMode } from "@/lib/economics";
import type { AllocationDetail, Fit, PlanResult } from "@/lib/plan";
import type { Price } from "@/lib/prices";
import { shortDay } from "@/lib/plain";
import type { Farm } from "@/lib/types";

export const CROP_EMOJI: Record<CropId, string> = { maize: "🌽", rice: "🍚", soybean: "🫘", sorghum: "🌾", cassava: "🥔", tomato: "🍅" };
const CROP_COLOR: Record<CropId, string> = { maize: "#e8a317", rice: "#3b82c4", soybean: "#9a6a3c", sorghum: "#b45309", cassava: "#7c3aed", tomato: "#dc2626" };

const FIT: Record<Fit, { text: string; cls: string; order: number }> = {
  excellent: { text: "Excellent fit", cls: "bg-leaf-600 text-white", order: 0 },
  good: { text: "Good fit", cls: "bg-leaf-100 text-leaf-700", order: 1 },
  conditional: { text: "Conditional", cls: "bg-sun-100 text-amber-800", order: 2 },
  poor: { text: "Poor fit", cls: "bg-red-100 text-red-700", order: 3 },
};

const CONF = { high: "text-leaf-700", medium: "text-amber-700", low: "text-red-700" } as const;
const RISK = { low: "text-leaf-700", medium: "text-amber-700", high: "text-red-700" } as const;

const naira = (n: number) => `${n < 0 ? "−" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
const qty = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Card({ title, children, className = "", aside }: { title?: React.ReactNode; children: React.ReactNode; className?: string; aside?: React.ReactNode }) {
  return (
    <section className={`min-w-0 rounded-3xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

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
    <Card>
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
    </Card>
  );
}

// ---------------------------------------------------------------- overview

function Kpis({ result }: { result: PlanResult }) {
  const { land, budget, totals } = result;
  const items = [
    { label: "Land planted", value: `${land.allocated} of ${land.total} ha`, hint: land.unallocated > 0 ? `${land.unallocated} ha left unplanted` : "All your land" },
    { label: "Planned cost", value: naira(totals.cost), hint: `of ${naira(budget.availableForFarming)} available` },
    { label: "Expected margin", value: naira(totals.margin.expected), hint: `bad year ${naira(totals.margin.low)}`, tone: totals.margin.expected >= 0 ? "good" : "bad" },
    { label: "Money left", value: naira(budget.remainingSpendable), hint: `+ ${naira(budget.reserve)} reserve` },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-2xl bg-white/10 p-3">
          <p className="text-xs text-leaf-100">{k.label}</p>
          <p className={`text-xl font-bold ${k.tone === "bad" ? "text-red-200" : ""}`}>{k.value}</p>
          <p className="text-xs text-leaf-100/80">{k.hint}</p>
        </div>
      ))}
    </div>
  );
}

function Checks({ result }: { result: PlanResult }) {
  const [open, setOpen] = useState(false);
  const fails = result.checks.filter((c) => c.status === "fail").length;
  const warns = result.checks.filter((c) => c.status === "warn").length;
  return (
    <div className="rounded-2xl border border-line bg-white px-4 py-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <ShieldCheck className={`h-4 w-4 ${fails ? "text-red-600" : "text-leaf-600"}`} /> Plan checks:{" "}
          <span className="text-leaf-700">{result.checks.length - fails - warns} passed</span>
          {warns > 0 && <span className="text-amber-700">· {warns} to watch</span>}
          {fails > 0 && <span className="text-red-700">· {fails} failed</span>}
        </span>
        <span className="text-muted">{open ? "Hide" : "Show details"}</span>
      </button>
      {open && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.checks.map((c) => (
            <li key={c.id} className="flex gap-2 rounded-xl bg-canvas p-3 text-sm">
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
    </div>
  );
}

// Warnings about one crop's prices are shown grouped under that crop instead.
const CROP_WARNING = /selling price for|price found is a|^Seed price is for/i;

function ThingsToCheck({ result, onPrices }: { result: PlanResult; onPrices: () => void }) {
  const general = result.warnings.filter((w) => !CROP_WARNING.test(w));
  const perCrop = result.details
    .map((d) => {
      const p = result.prices.prices.find((x) => x.key === `crop_${d.allocation.crop}`);
      const items: string[] = [];
      if (p && !p.edited && (p.confidence !== "high" || p.priceType !== "farm-gate")) {
        items.push(`Selling price is a ${p.priceType} price with ${p.confidence} confidence. Ask buyers what they pay at the farm gate.`);
      }
      if (d.seedPriceNote) items.push(`Seed was priced as ${d.seedPriceNote.replace(/^Seed price is for /, "").replace(/; treat it.*$/, "")}. Ask your agro-dealer for ${d.allocation.variety}.`);
      return { crop: d.allocation.crop, items };
    })
    .filter((c) => c.items.length);
  if (!general.length && !perCrop.length) return null;
  return (
    <Card title="⚠️ Things to check" aside={perCrop.length > 0 && <button onClick={onPrices} className="text-sm font-semibold text-leaf-700 hover:underline">Update prices →</button>}>
      <ul className="space-y-3 text-sm">
        {perCrop.map((c) => (
          <li key={c.crop} className="flex gap-3">
            <span className="text-xl">{CROP_EMOJI[c.crop]}</span>
            <div>
              <p className="font-semibold">{CROPS[c.crop].name}</p>
              <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-muted">
                {c.items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
        {general.map((w) => (
          <li key={w} className="flex gap-3">
            <span className="text-xl">•</span>
            <p className="text-muted">{w}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CropSummary({ d, onOpen }: { d: AllocationDetail; onOpen: () => void }) {
  const { allocation: a, economics: e } = d;
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-2 text-lg font-bold">
          <span className="text-2xl">{CROP_EMOJI[a.crop]}</span> {CROPS[a.crop].name}
          <span className="rounded-full bg-leaf-100 px-2 py-0.5 text-xs font-semibold text-leaf-700">{a.hectares} ha</span>
        </p>
        <button onClick={onOpen} className="shrink-0 text-sm font-semibold text-leaf-700 hover:underline">
          Details →
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">{a.variety}</p>
      <p className="mt-2 text-sm">{a.why}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-xl bg-canvas p-2.5">
          <dt className="text-xs text-muted">{a.nurseryStart ? "Nursery" : "Plant"}</dt>
          <dd className="font-semibold">{shortDay(a.nurseryStart || a.plantFrom)}</dd>
        </div>
        <div className="rounded-xl bg-canvas p-2.5">
          <dt className="text-xs text-muted">Harvest from</dt>
          <dd className="font-semibold">{shortDay(d.harvestFrom)}</dd>
        </div>
        <div className="rounded-xl bg-canvas p-2.5">
          <dt className="text-xs text-muted">Cost</dt>
          <dd className="font-semibold">{naira(e.totalCost)}</dd>
        </div>
        <div className="rounded-xl bg-canvas p-2.5">
          <dt className="text-xs text-muted">Expected margin</dt>
          <dd className={`font-semibold ${e.scenarios.expected.margin >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(e.scenarios.expected.margin)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Overview({ result, openCrop, openTab }: { result: PlanResult; openCrop: (c: CropId) => void; openTab: (t: Tab) => void }) {
  const { plan } = result;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <Card title="Your crops">
          <div className="space-y-3">
            {result.details.map((d) => (
              <CropSummary key={d.allocation.crop} d={d} onOpen={() => openCrop(d.allocation.crop)} />
            ))}
          </div>
          {result.land.unallocated > 0 && plan.unusedLandReason && (
            <p className="mt-3 rounded-2xl bg-canvas p-3 text-sm">
              <b>Why {result.land.unallocated} ha is left unplanted:</b> {plan.unusedLandReason}
            </p>
          )}
        </Card>
        <Card title="Risks and what to do">
          <ul className="grid gap-3 sm:grid-cols-2">
            {plan.risks.map((r) => (
              <li key={r.risk} className="rounded-2xl bg-canvas p-4 text-sm">
                <p className="font-semibold">{r.risk}</p>
                {r.action && (
                  <p className="mt-1">
                    <span className="font-semibold text-leaf-700">Do this: </span>
                    {r.action}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="min-w-0 space-y-4">
        <ThingsToCheck result={result} onPrices={() => openTab("prices")} />
        <Card title="📝 Before you plant">
          <ol className="space-y-2 text-sm">
            {plan.beforePlanting.map((s, i) => (
              <li key={s} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-leaf-100 text-xs font-bold text-leaf-700">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </Card>
        <Card title="🔄 What would change this plan">
          <ul className="list-disc space-y-1.5 pl-5 text-sm">
            {plan.whatWouldChange.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- crops

const CATEGORY_ORDER: CostCategory[] = ["Seed & planting material", "Fertilizer & soil", "Crop protection", "Water", "Land & labour", "Harvest & selling"];

function ShoppingList({ e }: { e: CropEconomics }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 font-semibold">How much</th>
            <th className="px-3 py-2 text-right font-semibold">Price</th>
            <th className="px-3 py-2 text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORY_ORDER.filter((cat) => e.lines.some((l) => l.category === cat)).map((cat) => {
            const lines = e.lines.filter((l) => l.category === cat);
            return (
              <CategoryRows key={cat} cat={cat} lines={lines} />
            );
          })}
          <tr className="border-t-2 border-line bg-canvas font-bold">
            <td className="px-3 py-2.5" colSpan={3}>
              Total listed costs
            </td>
            <td className="px-3 py-2.5 text-right">{naira(e.totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function CategoryRows({ cat, lines }: { cat: CostCategory; lines: CropEconomics["lines"] }) {
  return (
    <>
      <tr className="border-t border-line bg-canvas/60">
        <td colSpan={3} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          {cat}
        </td>
        <td className="px-3 py-1.5 text-right text-xs font-semibold text-muted">{naira(lines.reduce((s, l) => s + l.cost, 0))}</td>
      </tr>
      {lines.map((l) => (
        <tr key={l.item} className="border-t border-line/60 align-top">
          <td className="px-3 py-2">
            <span className="font-medium">{l.label}</span>
            <span className="block text-xs text-muted">{l.when}</span>
            {l.note && <span className="block text-xs text-amber-800">{l.note}</span>}
          </td>
          <td className="whitespace-nowrap px-3 py-2">
            {qty(l.quantity)} × {l.unit}
            {/50kg bag/.test(l.unit) && !Number.isInteger(l.quantity) && <span className="block text-xs text-muted">= {Math.round(l.quantity * 50)} kg</span>}
          </td>
          <td className="whitespace-nowrap px-3 py-2 text-right text-muted">{naira(l.unitPrice)}</td>
          <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{naira(l.cost)}</td>
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
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Case</th>
            <th className="px-3 py-2 font-semibold">To sell</th>
            <th className="px-3 py-2 text-right font-semibold">× Price</th>
            <th className="px-3 py-2 text-right font-semibold">= Sales</th>
            <th className="px-3 py-2 text-right font-semibold">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, s]) => (
            <tr key={label} className={`border-t border-line ${label === "Expected" ? "bg-leaf-50/60 font-semibold" : ""}`}>
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2">
                {qty(s.sellable)} <span className="text-xs font-normal text-muted">of {qty(s.harvest)} harvested</span>
              </td>
              <td className="px-3 py-2 text-right">{naira(s.price)}</td>
              <td className="px-3 py-2 text-right">{naira(s.revenue)}</td>
              <td className={`px-3 py-2 text-right ${s.margin >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(s.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-xs text-muted">
        Quantities in {e.unit}. &quot;To sell&quot; allows {pct(e.postHarvestLoss)} for losses from pests, spoilage and handling. Margin = sales − {naira(e.totalCost)} listed
        costs.
      </p>
    </div>
  );
}

function CropDetail({ d }: { d: AllocationDetail }) {
  const { allocation: a, economics: e } = d;
  const crop = CROPS[a.crop];
  const variety = crop.varieties.find((v) => v.name === a.variety);
  const dates: [string, string, string][] = [
    ...(a.nurseryStart ? [["Start nursery", shortDay(a.nurseryStart), `${crop.nurseryDays} days in the nursery`] as [string, string, string]] : []),
    [a.nurseryStart ? "Transplant" : "Plant", `${shortDay(a.plantFrom)} – ${shortDay(a.plantTo)}`, "Estimated window"],
    ["Harvest", `${shortDay(d.harvestFrom)} – ${shortDay(d.harvestTo)}`, `${crop.growingDays[0]}–${crop.growingDays[1]} days`],
  ];
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="flex flex-wrap items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{CROP_EMOJI[a.crop]}</span> {crop.name}
          <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-sm font-semibold text-leaf-700">{a.hectares} ha</span>
        </h3>
        <p className="mt-1 text-sm text-muted">
          <b className="text-ink">{a.variety}</b>
          {variety && ` · ${variety.note}`}
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
        <p className="mt-3 text-sm">
          <span className="font-semibold text-sky-500">When to plant: </span>
          {d.plantingTrigger} The dates are estimates; the rains decide.
        </p>
        <p className="mt-1 text-sm text-muted">
          Spacing: {crop.spacing}. Seed: {crop.seedNote}
        </p>
      </Card>

      <Card title={<span className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-leaf-600" /> Shopping list</span>} aside={<span className="font-bold">{naira(e.totalCost)}</span>}>
        <ShoppingList e={e} />
        {d.seedPriceNote && <p className="mt-2 text-xs text-amber-800">{d.seedPriceNote}</p>}
      </Card>

      <Card title="🧮 Sales and margin">
        <SalesMath e={e} />
      </Card>
    </div>
  );
}

function Crops({ result, crop, setCrop }: { result: PlanResult; crop: CropId; setCrop: (c: CropId) => void }) {
  const d = result.details.find((x) => x.allocation.crop === crop) ?? result.details[0];
  return (
    <div className="space-y-4">
      {result.details.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {result.details.map((x) => (
            <button
              key={x.allocation.crop}
              onClick={() => setCrop(x.allocation.crop)}
              className={`rounded-2xl px-4 py-2 font-semibold ${x === d ? "bg-leaf-600 text-white" : "border border-line bg-white hover:border-leaf-500"}`}
            >
              {CROP_EMOJI[x.allocation.crop]} {CROPS[x.allocation.crop].name} · {x.allocation.hectares} ha
            </button>
          ))}
        </div>
      )}
      <CropDetail d={d} />
    </div>
  );
}

// ---------------------------------------------------------------- money

function Money({ result }: { result: PlanResult }) {
  const { totals, budget: b, land, plan } = result;
  const rows: [string, number, string?][] = [
    ["Total money you have", b.total],
    ["Emergency reserve (10%)", -b.reserve, "Kept aside for price rises, replanting or illness"],
    ["Available for farming", b.availableForFarming],
    ["Planned spending", -b.planned],
    ["Left to spend", b.remainingSpendable],
  ];
  const segs = [
    ...plan.allocations.map((a) => ({ key: a.crop, label: `${CROPS[a.crop].name} · ${a.hectares} ha`, ha: a.hectares, color: CROP_COLOR[a.crop] })),
    ...(land.unallocated > 0 ? [{ key: "free", label: `Not planted · ${land.unallocated} ha`, ha: land.unallocated, color: "#d6d3c8" }] : []),
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="📈 What you could earn" className="lg:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Bad year", totals.margin.low, totals.revenue.low],
              ["Expected", totals.margin.expected, totals.revenue.expected],
              ["Good year", totals.margin.high, totals.revenue.high],
            ] as const
          ).map(([label, margin, revenue]) => (
            <div key={label} className={`rounded-2xl p-4 ${label === "Expected" ? (margin >= 0 ? "bg-leaf-50" : "bg-red-50") : "bg-canvas"}`}>
              <p className="text-xs text-muted">{label}</p>
              <p className={`text-2xl font-bold ${margin >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(margin)}</p>
              <p className="text-xs text-muted">sales {naira(revenue)}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Crop</th>
                <th className="px-3 py-2 text-right font-semibold">Cost</th>
                <th className="px-3 py-2 text-right font-semibold">Expected sales</th>
                <th className="px-3 py-2 text-right font-semibold">Expected margin</th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((d) => (
                <tr key={d.allocation.crop} className="border-t border-line">
                  <td className="px-3 py-2">
                    {CROP_EMOJI[d.allocation.crop]} {CROPS[d.allocation.crop].name} <span className="text-muted">· {d.allocation.hectares} ha</span>
                  </td>
                  <td className="px-3 py-2 text-right">{naira(d.economics.totalCost)}</td>
                  <td className="px-3 py-2 text-right">{naira(d.economics.scenarios.expected.revenue)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${d.economics.scenarios.expected.margin >= 0 ? "text-leaf-700" : "text-red-700"}`}>
                    {naira(d.economics.scenarios.expected.margin)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-line bg-canvas font-bold">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">{naira(totals.cost)}</td>
                <td className="px-3 py-2 text-right">{naira(totals.revenue.expected)}</td>
                <td className={`px-3 py-2 text-right ${totals.margin.expected >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(totals.margin.expected)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {totals.margin.low < 0 && (
          <p className="mt-3 text-sm">
            Be ready: in a bad year (poor rain and low prices) you could lose up to <b className="text-red-700">{naira(-totals.margin.low)}</b>.
          </p>
        )}
        <p className="mt-2 text-xs text-muted">
          An estimate, not a guaranteed profit. Includes every cost in the shopping lists, harvest losses, bags and transport; not land rent, loan interest or storage.{" "}
          {result.labour === "family" ? "Family does most work (20% hired)." : result.labour === "mixed" ? "Family plus hired help (50% hired)." : "All work hired."} Family labour
          isn&apos;t counted as cash.
        </p>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card title="💰 Your budget">
          <div className="h-3 overflow-hidden rounded-full bg-canvas">
            <div className={`h-full rounded-full ${b.planned > b.availableForFarming ? "bg-red-500" : "bg-leaf-500"}`} style={{ width: `${Math.min((b.planned / b.availableForFarming) * 100, 100)}%` }} />
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
          <p className="mt-2 text-xs text-muted">If nothing goes wrong you also keep the reserve: {naira(b.remainingTotal)} unspent in total.</p>
        </Card>
        <Card title="🗺️ Your land">
          <div className="flex h-4 overflow-hidden rounded-full">
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
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- compare

function Compare({ result }: { result: PlanResult }) {
  const fitOf = new Map(result.plan.ranking.map((r) => [r.crop, r]));
  const chosen = new Set(result.plan.allocations.map((a) => a.crop));
  // Only crops that can actually grow here are ranked on risk-adjusted return.
  const ranked = result.options.filter((o) => fitOf.get(o.crop)?.fit !== "poor").sort((a, b) => b.riskAdjusted - a.riskAdjusted);
  const rank = new Map(ranked.map((o, i) => [o.crop, i + 1]));
  const rows = [...result.options].sort((a, b) => {
    const fa = FIT[fitOf.get(a.crop)?.fit ?? "poor"].order;
    const fb = FIT[fitOf.get(b.crop)?.fit ?? "poor"].order;
    return Number(chosen.has(b.crop)) - Number(chosen.has(a.crop)) || fa - fb || (rank.get(a.crop) ?? 99) - (rank.get(b.crop) ?? 99);
  });
  return (
    <Card title="⚖️ How the crops compare">
      <p className="-mt-1 mb-4 text-sm text-muted">
        One hectare on your farm, with your experience and today&apos;s prices. Crops stay on the land for different times, so look at the margin per month too.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Crop</th>
              <th className="px-3 py-2 font-semibold">Fit</th>
              <th className="px-3 py-2 text-right font-semibold">Cost/ha</th>
              <th className="px-3 py-2 text-right font-semibold">Margin/ha</th>
              <th className="px-3 py-2 text-right font-semibold">Worst case</th>
              <th className="px-3 py-2 text-right font-semibold">Per month</th>
              <th className="px-3 py-2 font-semibold">Risk: grow · sell · money</th>
              <th className="px-3 py-2 text-center font-semibold">Rank</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const r = fitOf.get(o.crop);
              const c = CROPS[o.crop];
              const e = o.perHa.scenarios;
              return (
                <tr key={o.crop} className={`border-t border-line align-top ${chosen.has(o.crop) ? "bg-leaf-50/60" : ""}`}>
                  <td className="max-w-[260px] px-3 py-3">
                    <p className="font-semibold">
                      {CROP_EMOJI[o.crop]} {c.name}
                      {chosen.has(o.crop) && <span className="ml-1 text-xs text-leaf-700">· in your plan</span>}
                    </p>
                    {r && <p className="mt-0.5 text-xs text-muted">{r.reason}</p>}
                    {o.suitability.condition && <p className="mt-0.5 text-xs font-semibold text-amber-800">Only if: {o.suitability.condition.replace(/^Only if /, "")}</p>}
                  </td>
                  <td className="px-3 py-3">{r && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${FIT[r.fit].cls}`}>{FIT[r.fit].text}</span>}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">{naira(o.perHa.totalCost)}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right font-semibold ${e.expected.margin >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(e.expected.margin)}</td>
                  <td className={`whitespace-nowrap px-3 py-3 text-right ${e.low.margin >= 0 ? "" : "text-red-700"}`}>{naira(e.low.margin)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {naira(o.perHa.marginPerMonth)}
                    <span className="block text-xs text-muted">{c.monthsOnLand} months</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs">
                    <b className={RISK[c.risk.production]}>{c.risk.production}</b> · <b className={RISK[c.risk.market]}>{c.risk.market}</b> ·{" "}
                    <b className={RISK[c.risk.capital]}>{c.risk.capital}</b>
                  </td>
                  <td className="px-3 py-3 text-center font-bold">{rank.has(o.crop) ? `#${rank.get(o.crop)}` : <span className="text-xs font-normal text-muted">not ranked</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Rank weighs expected margin against the worst-case loss and growing, selling and money risk. Poor-fit crops aren&apos;t ranked because they can&apos;t be grown well here.
        Small plots cost a little more per hectare because seed packs and bundles come whole.
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------- prices

function Prices({ result, onReplan, busy }: { result: PlanResult; onReplan: (overrides: Partial<Record<PriceKey, number>>) => void; busy: boolean }) {
  const [edits, setEdits] = useState<Partial<Record<PriceKey, string>>>({});
  const relevant = new Set<PriceKey>();
  for (const d of result.details) {
    for (const l of d.economics.lines) relevant.add(l.item);
    relevant.add(`crop_${d.allocation.crop}` as PriceKey);
  }
  const rows = result.prices.prices.filter((p) => relevant.has(p.key));
  const selling = rows.filter((p) => p.key.startsWith("crop_"));
  const buying = rows.filter((p) => !p.key.startsWith("crop_"));
  const changed = Object.entries(edits).filter(([, v]) => v && Number(v) > 0);
  const host = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "source";
    }
  };

  const table = (title: string, list: Price[]) => (
    <div>
      <h3 className="mb-2 font-bold">{title}</h3>
      <div className="overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 text-right font-semibold">Price used</th>
              <th className="px-3 py-2 font-semibold">How sure</th>
              <th className="px-3 py-2 font-semibold">Source</th>
              <th className="px-3 py-2 font-semibold">Your price (₦)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.key} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <span className="font-medium">{p.label.split(":")[0]}</span>
                  <span className="block text-xs text-muted">per {p.unit}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <b>{naira(p.typical)}</b>
                  {!p.edited && (
                    <span className="block text-xs text-muted">
                      {naira(p.low)}–{naira(p.high)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-xs">
                  {p.edited ? (
                    <b className="text-sky-500">Your price</b>
                  ) : (
                    <>
                      <b className={CONF[p.confidence]}>{p.confidence}</b>
                      <span className="block text-muted">{p.priceType}</span>
                    </>
                  )}
                </td>
                <td className="max-w-[240px] px-3 py-2 text-xs">
                  {p.sourceUrl ? (
                    <a href={p.sourceUrl} target="_blank" rel="noreferrer" title={p.matchedProduct} className="inline-flex items-center gap-1 font-medium text-leaf-700 hover:underline">
                      <ExternalLink className="h-3 w-3 shrink-0" /> {host(p.sourceUrl)}
                    </a>
                  ) : (
                    <span className="text-muted">No source</span>
                  )}
                  <span className="block text-muted">{p.sourceDate}</span>
                  {p.matchedProduct && <span className="mt-0.5 line-clamp-2 block text-muted" title={p.matchedProduct}>{p.matchedProduct}</span>}
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
    </div>
  );

  return (
    <Card
      title="🏷️ Prices used"
      aside={
        <button
          onClick={() => onReplan(Object.fromEntries(changed.map(([k, v]) => [k, Number(v)])))}
          disabled={!changed.length || busy}
          className="flex items-center gap-2 rounded-xl bg-leaf-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          <RefreshCw className="h-4 w-4" /> Re-plan with my prices{changed.length ? ` (${changed.length})` : ""}
        </button>
      }
    >
      <p className="-mt-1 mb-4 text-sm text-muted">
        Found by Muse Spark web search for {result.prices.state} on{" "}
        {new Date(result.prices.fetchedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}. Prices change fast: if your market is different,
        type your price and re-plan. Selling prices should be what a buyer pays you at the farm gate.
      </p>
      <div className="space-y-5">
        {table("What you sell", selling)}
        {table("What you buy", buying)}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- main

type Tab = "overview" | "crops" | "money" | "compare" | "prices";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "crops", label: "Crops & shopping list" },
  { id: "money", label: "Money" },
  { id: "compare", label: "Compare crops" },
  { id: "prices", label: "Prices" },
];

/** Plans saved before the validator existed lack its fields; they must be rebuilt. */
export const isCurrentPlan = (p: Farm["plan"]): p is PlanResult => !!p && Array.isArray((p as PlanResult).details) && Array.isArray((p as PlanResult).checks);

export default function SeasonPlan({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const result = isCurrentPlan(farm.plan) ? farm.plan : undefined;
  const [irrigation, setIrrigation] = useState<"no" | "yes">(result?.irrigation ? "yes" : "no");
  const [labour, setLabour] = useState<LabourMode>(result?.labour ?? "mixed");
  const [started, setStarted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [crop, setCrop] = useState<CropId | null>(null);

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
      setTab("overview");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStarted(null);
    }
  }

  if (started) return <Building started={started} />;

  if (!result || editing) {
    return (
      <Card>
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
      </Card>
    );
  }

  const { plan } = result;
  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-leaf-900 p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-leaf-100">
            <Sparkles className="h-4 w-4" /> Your season plan · by Muse Wonder
          </p>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">
            <RefreshCw className="h-3.5 w-3.5" /> Change answers & re-plan
          </button>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">{plan.headline}</h1>
        <p className="mt-2 max-w-3xl text-leaf-100">{plan.summary}</p>
        <Kpis result={result} />
      </section>

      <Checks result={result} />

      <nav className="sticky top-[104px] z-[5] -mx-1 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white/95 p-1 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold ${tab === t.id ? "bg-leaf-600 text-white" : "text-muted hover:bg-canvas hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <Overview
          result={result}
          openCrop={(c) => {
            setCrop(c);
            setTab("crops");
          }}
          openTab={setTab}
        />
      )}
      {tab === "crops" && <Crops result={result} crop={crop ?? result.details[0].allocation.crop} setCrop={setCrop} />}
      {tab === "money" && <Money result={result} />}
      {tab === "compare" && <Compare result={result} />}
      {tab === "prices" && <Prices result={result} onReplan={build} busy={!!started} />}

      <p className="px-1 text-xs text-muted">
        Planned {new Date(result.createdAt).toLocaleString("en-NG", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} by {result.model}. Seed, fertilizer
        and yield figures follow IITA / NAERLS extension guides; they are planning estimates, not guarantees.
      </p>
    </div>
  );
}
