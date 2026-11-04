"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ExternalLink, Loader2, RefreshCw, ShoppingCart, Sparkles, Sprout } from "lucide-react";
import { CROPS, type CropId, type PriceKey } from "@/data/crops";
import type { CropEconomics, LabourMode } from "@/lib/economics";
import type { PlanResult } from "@/lib/plan";
import type { Price } from "@/lib/prices";
import { shortDay } from "@/lib/plain";
import type { Farm } from "@/lib/types";

export const CROP_EMOJI: Record<CropId, string> = { maize: "🌽", rice: "🍚", soybean: "🫘", sorghum: "🌾", cassava: "🥔", tomato: "🍅" };

const FIT = {
  best: { text: "Best fit", cls: "bg-leaf-600 text-white" },
  good: { text: "Good fit", cls: "bg-leaf-100 text-leaf-700" },
  possible: { text: "Possible", cls: "bg-sun-100 text-amber-800" },
  not_advised: { text: "Not advised", cls: "bg-red-100 text-red-700" },
} as const;

const CONF = { high: "text-leaf-700", medium: "text-amber-700", low: "text-red-700" } as const;

const naira = (n: number) => `${n < 0 ? "−" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
const qty = (n: number) => (Number.isInteger(n) ? n.toString() : n.toFixed(1));

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
  "Checking today's seed, fertilizer and crop prices (Muse Spark + web search)",
  "Comparing 6 crops for your soil, rain, land and budget (Muse Wonder)",
  "Working out your shopping list and money plan",
];

function Building({ started }: { started: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.floor((now - started) / 1000);
  const stage = secs < 12 ? 0 : secs < 45 ? 1 : 2;
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

function MoneyCard({ result }: { result: PlanResult }) {
  const { totals } = result;
  const usedPct = Math.min((totals.cost / totals.budget) * 100, 100);
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">💰 Your money plan</h2>
      <div className="mt-4">
        <div className="flex justify-between text-sm">
          <span>
            Cost: <b>{naira(totals.cost)}</b>
          </span>
          <span className="text-muted">Budget {naira(totals.budget)}</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-canvas">
          <div className={`h-full rounded-full ${totals.cost > totals.budget ? "bg-red-500" : "bg-leaf-500"}`} style={{ width: `${usedPct}%` }} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {totals.reserve >= 0 ? `${naira(totals.reserve)} left over for surprises` : `${naira(-totals.reserve)} over budget`}
        </p>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-canvas p-4">
          <dt className="text-xs text-muted">Expected sales</dt>
          <dd className="text-xl font-bold">{naira(totals.revenue.expected)}</dd>
          <dd className="text-xs text-muted">
            {naira(totals.revenue.low)} – {naira(totals.revenue.high)}
          </dd>
        </div>
        <div className={`rounded-2xl p-4 ${totals.profit.expected >= 0 ? "bg-leaf-50" : "bg-red-50"}`}>
          <dt className="text-xs text-muted">Expected profit</dt>
          <dd className={`text-xl font-bold ${totals.profit.expected >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(totals.profit.expected)}</dd>
          <dd className="text-xs text-muted">
            {naira(totals.profit.low)} to {naira(totals.profit.high)}
          </dd>
        </div>
      </dl>
      {totals.profit.low < 0 && (
        <p className="mt-3 text-sm text-muted">
          Be ready: in a bad year (poor rain and low prices) you could lose up to <b className="text-red-700">{naira(-totals.profit.low)}</b>.
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        {result.labour === "family" ? "Assumes family does most of the work (20% hired)." : result.labour === "mixed" ? "Assumes family plus some hired help (50% hired)." : "Assumes all work is hired."}{" "}
        Family labour isn&apos;t counted as cash.
      </p>
    </section>
  );
}

function CropPlanCard({ result, index }: { result: PlanResult; index: number }) {
  const a = result.plan.allocations[index];
  const e = result.economics[index];
  const crop = CROPS[a.crop];
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold">
            <span className="text-2xl">{CROP_EMOJI[a.crop]}</span> {crop.name}
            <span className="rounded-full bg-leaf-100 px-2.5 py-0.5 text-sm font-semibold text-leaf-700">{a.hectares} ha</span>
          </h3>
          <p className="mt-1 text-sm text-muted">
            Variety: <b className="text-ink">{a.variety}</b>
          </p>
        </div>
        <div className="rounded-2xl bg-sky-500/10 px-4 py-2 text-sm">
          <span className="block text-xs text-muted">Plant between</span>
          <b>
            {shortDay(a.plantFrom)} – {shortDay(a.plantTo)}
          </b>
        </div>
      </div>
      <p className="mt-3 text-[15px]">{a.why}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-canvas p-3">
          <p className="text-xs text-muted">Cost</p>
          <p className="font-bold">{naira(e.totalCost)}</p>
        </div>
        <div className="rounded-2xl bg-canvas p-3">
          <p className="text-xs text-muted">Expected harvest</p>
          <p className="font-bold">
            {e.harvest.expected} {e.harvest.unit}
          </p>
          <p className="text-xs text-muted">
            {e.harvest.low}–{e.harvest.high}
          </p>
        </div>
        <div className="rounded-2xl bg-canvas p-3">
          <p className="text-xs text-muted">Expected profit</p>
          <p className={`font-bold ${e.profit.expected >= 0 ? "text-leaf-700" : "text-red-700"}`}>{naira(e.profit.expected)}</p>
          <p className="text-xs text-muted">
            {naira(e.profit.low)} to {naira(e.profit.high)}
          </p>
        </div>
      </div>

      <h4 className="mb-2 mt-5 flex items-center gap-2 font-bold">
        <ShoppingCart className="h-4 w-4 text-leaf-600" /> Shopping list
      </h4>
      <ShoppingList lines={e} />
      <p className="mt-2 text-xs text-muted">Spacing: {crop.spacing} ({crop.plantsPerHa} plants per hectare).</p>
    </section>
  );
}

function ShoppingList({ lines: e }: { lines: CropEconomics }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Item</th>
            <th className="px-3 py-2 font-semibold">How much</th>
            <th className="px-3 py-2 font-semibold">Price</th>
            <th className="px-3 py-2 text-right font-semibold">Cost</th>
          </tr>
        </thead>
        <tbody>
          {e.lines.map((l) => (
            <tr key={l.item} className="border-t border-line align-top">
              <td className="px-3 py-2">
                <span className="font-medium">{l.label}</span>
                <span className="block text-xs text-muted">{l.when}</span>
              </td>
              <td className="px-3 py-2">
                {qty(l.quantity)} × {l.unit}
                {/bag/.test(l.unit) && !Number.isInteger(l.quantity) && <span className="block text-xs text-muted">= {Math.round(l.quantity * 50)} kg</span>}
              </td>
              <td className="px-3 py-2 text-muted">{naira(l.unitPrice)}</td>
              <td className="px-3 py-2 text-right font-semibold">{naira(l.cost)}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-canvas font-bold">
            <td className="px-3 py-2" colSpan={3}>
              Total
            </td>
            <td className="px-3 py-2 text-right">{naira(e.totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Comparison({ result }: { result: PlanResult }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">⚖️ How the crops compare</h2>
      <p className="text-sm text-muted">For one hectare on your farm, with your experience and today&apos;s prices.</p>
      <ul className="mt-4 space-y-3">
        {result.plan.ranking.map((r) => {
          const o = result.options.find((x) => x.crop === r.crop);
          const chosen = result.plan.allocations.some((a) => a.crop === r.crop);
          return (
            <li key={r.crop} className={`rounded-2xl border p-4 ${chosen ? "border-leaf-500 bg-leaf-50/60" : "border-line"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 font-bold">
                  <span className="text-xl">{CROP_EMOJI[r.crop]}</span>
                  {CROPS[r.crop].name}
                  {chosen && <span className="text-xs font-semibold text-leaf-700">· in your plan</span>}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${FIT[r.fit].cls}`}>{FIT[r.fit].text}</span>
              </div>
              <p className="mt-1 text-sm text-muted">{r.reason}</p>
              {CROPS[r.crop].growingDays[0] > 200 && (
                <p className="mt-1 text-xs font-semibold text-amber-700">12-month crop: these figures cover a full year on the land, not one season.</p>
              )}
              {o && (
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    Cost/ha <b>{naira(o.perHa.totalCost)}</b>
                  </span>
                  <span>
                    Profit/ha <b className={o.perHa.profit.expected >= 0 ? "text-leaf-700" : "text-red-700"}>{naira(o.perHa.profit.expected)}</b>{" "}
                    <span className="text-muted">
                      ({naira(o.perHa.profit.low)} to {naira(o.perHa.profit.high)})
                    </span>
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PricesUsed({ result, onReplan, busy }: { result: PlanResult; onReplan: (overrides: Partial<Record<PriceKey, number>>) => void; busy: boolean }) {
  const [edits, setEdits] = useState<Partial<Record<PriceKey, string>>>({});
  const relevant = new Set<PriceKey>(["ploughing", "labour_day"]);
  for (const e of result.economics) {
    for (const l of e.lines) relevant.add(l.item);
    relevant.add(`crop_${e.crop}` as PriceKey);
  }
  const rows = result.prices.prices.filter((p) => relevant.has(p.key));
  const changed = Object.entries(edits).filter(([, v]) => v && Number(v) > 0);

  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <h2 className="text-lg font-bold">🏷️ Prices used</h2>
      <p className="text-sm text-muted">
        Found by Muse Spark web search for {result.prices.state} on {new Date(result.prices.fetchedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}.
        Prices change fast. If your market is different, type your price and re-plan.
      </p>
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Item</th>
              <th className="px-3 py-2 font-semibold">Price used</th>
              <th className="px-3 py-2 font-semibold">Source</th>
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
                    </span>
                  )}
                </td>
                <td className="max-w-[220px] px-3 py-2 text-xs">
                  {p.sourceUrl ? (
                    <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-leaf-700 hover:underline">
                      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{p.sourceTitle || new URL(p.sourceUrl).hostname}</span>
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

export default function SeasonPlan({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const [irrigation, setIrrigation] = useState<"no" | "yes">(farm.plan?.irrigation ? "yes" : "no");
  const [labour, setLabour] = useState<LabourMode>(farm.plan?.labour ?? "mixed");
  const [started, setStarted] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const result = farm.plan;

  async function build(overrides: Partial<Record<PriceKey, number>> = {}) {
    setStarted(Date.now());
    setError(null);
    try {
      // Keep any prices the farmer typed before, and add the new ones.
      const kept = Object.fromEntries((result?.prices.prices ?? []).filter((p) => p.edited).map((p) => [p.key, p.typical]));
      const { plan: _old, ...farmOnly } = farm;
      void _old;
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
              <b>{CROPS[a.crop].name}</b> · {a.hectares} ha · plant {shortDay(a.plantFrom)}
            </span>
          ))}
        </div>
      </section>

      {result.warnings.map((w) => (
        <p key={w} className="flex items-start gap-2 rounded-2xl bg-sun-100 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> {w}
        </p>
      ))}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {plan.allocations.map((a, i) => (
            <CropPlanCard key={a.crop} result={result} index={i} />
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          <MoneyCard result={result} />
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
            <p className="mt-4 rounded-2xl bg-canvas p-3 text-sm text-muted">{plan.budgetNote}</p>
          </section>
        </div>
      </div>

      <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
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
