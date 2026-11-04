"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Newspaper, TrendingUp, Warehouse } from "lucide-react";
import { CROPS, type CropId } from "@/data/crops";
import { MONTHS, type SellOrStore } from "@/lib/market";
import type { Price } from "@/lib/prices";
import type { PlanResult } from "@/lib/plan";
import type { Farm } from "@/lib/types";
import { CROP_EMOJI } from "./SeasonPlan";

interface MarketData {
  crops: { crop: CropId; analysis: SellOrStore | null; price: Price | null; bag: Price | null }[];
  data: { source: string; sourceUrl: string; period: string | null };
}

interface News {
  items: { crop: string; headline: string; text: string }[];
  sources: { title: string; url: string }[];
  fetchedAt: string;
}

const naira = (n: number) => `${n < 0 ? "−" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
const pctOf = (v: number) => `${v >= 1 ? "+" : "−"}${Math.abs(Math.round((v - 1) * 100))}%`;

function SeasonBars({ a }: { a: SellOrStore }) {
  const idx = a.season.index;
  const max = Math.max(...idx);
  const min = Math.min(...idx);
  return (
    <div>
      <div className="flex h-32 items-end gap-1" role="img" aria-label="Typical price through the year">
        {idx.map((v, m) => {
          const h = 15 + ((v - min) / Math.max(max - min, 0.001)) * 85;
          const isHarvest = m === a.harvestMonth;
          const isBest = a.best && m === a.best.month;
          return (
            <div key={m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${MONTHS[m]}: ${pctOf(v)} vs the yearly average`}>
              <span className={`text-[10px] font-semibold ${isBest ? "text-leaf-700" : isHarvest ? "text-red-700" : "text-muted"}`}>{pctOf(v)}</span>
              <div className={`w-full rounded-t-md ${isBest ? "bg-leaf-600" : isHarvest ? "bg-red-400" : "bg-sun-500/50"}`} style={{ height: `${h}%` }} />
              <span className={`text-[11px] ${m === a.todayMonth ? "font-bold text-ink" : "text-muted"}`}>{MONTHS[m][0]}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />
          Your harvest ({MONTHS[a.harvestMonth]})
        </span>
        {a.best && (
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-leaf-600" />
            Best month to sell ({MONTHS[a.best.month]})
          </span>
        )}
        <span>Bold letter = this month</span>
      </p>
    </div>
  );
}

function CropMarket({ crop, analysis: a, price, bag, period }: MarketData["crops"][number] & { period: string | null }) {
  const c = CROPS[crop];
  if (!a) {
    return (
      <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{CROP_EMOJI[crop]}</span> {c.name}
        </h3>
        <p className="mt-2 text-sm text-muted">Not enough market history for {c.name} to show a seasonal pattern yet.</p>
      </section>
    );
  }
  const verdict = !a.storage
    ? `${c.name} can't be stored for long. Sell within days of picking, spread your harvest over several weeks, and look for cold rooms or processors.`
    : a.best && a.best.gainVsHarvest > 0
      ? `Storing in ${a.storage.method} until ${MONTHS[a.best.month]} has usually paid: about ${naira(a.best.gainVsHarvest)} more than selling at harvest, after bags and losses.`
      : `Prices usually don't rise enough after harvest to pay for storage. Selling at harvest is fine.`;
  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="flex items-center gap-2 text-xl font-bold">
          <span className="text-2xl">{CROP_EMOJI[crop]}</span> {c.name}
        </h3>
        {price && (
          <div className="text-right text-sm">
            <p>
              Today: <b>{naira(a.todayPrice)}</b> <span className="text-muted">per {price.unit}</span>
            </p>
            <p className="text-xs text-muted">
              {price.edited ? "your price" : `${price.priceType} price · ${price.confidence} confidence · ${price.sourceDate}`}
            </p>
          </div>
        )}
      </div>

      <p className={`mt-3 rounded-2xl p-4 text-[15px] ${a.best && a.best.gainVsHarvest > 0 ? "bg-leaf-50" : "bg-canvas"}`}>
        <TrendingUp className="mr-2 inline h-4 w-4 text-leaf-600" />
        {verdict}
      </p>

      <h4 className="mb-2 mt-5 font-bold">How the price usually moves through the year</h4>
      <SeasonBars a={a} />

      {a.storage && (
        <>
          <h4 className="mb-2 mt-5 flex items-center gap-2 font-bold">
            <Warehouse className="h-4 w-4 text-leaf-600" /> Sell at harvest or store?
          </h4>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Sell in</th>
                  <th className="px-3 py-2 font-semibold">Typical price</th>
                  <th className="px-3 py-2 font-semibold">To sell</th>
                  <th className="px-3 py-2 text-right font-semibold">Storage</th>
                  <th className="px-3 py-2 text-right font-semibold">Net sales</th>
                  <th className="px-3 py-2 text-right font-semibold">vs harvest</th>
                </tr>
              </thead>
              <tbody>
                {a.options.map((o) => (
                  <tr key={o.monthsStored} className={`border-t border-line ${a.best?.monthsStored === o.monthsStored ? "bg-leaf-50 font-semibold" : ""}`}>
                    <td className="px-3 py-2">
                      {MONTHS[o.month]}
                      <span className="block text-xs font-normal text-muted">{o.monthsStored ? `${o.monthsStored} month${o.monthsStored > 1 ? "s" : ""} stored` : "at harvest"}</span>
                    </td>
                    <td className="px-3 py-2">{naira(o.price)}</td>
                    <td className="px-3 py-2">{o.sellable}</td>
                    <td className="px-3 py-2 text-right text-muted">{o.storageCost ? naira(o.storageCost) : "–"}</td>
                    <td className="px-3 py-2 text-right">{naira(o.net)}</td>
                    <td className={`px-3 py-2 text-right ${o.gainVsHarvest > 0 ? "text-leaf-700" : o.gainVsHarvest < 0 ? "text-red-700" : ""}`}>{o.monthsStored ? naira(o.gainVsHarvest) : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            For your expected {a.options[0].sellable} {a.unit}. Storage counts {bag ? `${naira(bag.typical)} per hermetic bag` : "hermetic bags"} and about{" "}
            {Math.round(a.storage.lossPerMonth * 1000) / 10}% loss a month. Prices are in today&apos;s naira: the pattern has inflation removed, so real prices will usually
            be higher. Only store dry grain (it should rattle), and don&apos;t store if you need the money for urgent costs.
          </p>
        </>
      )}
      <p className="mt-2 text-xs text-muted">
        Pattern from {a.season.markets} markets ({a.season.observations} monthly prices{period ? `, ${period}` : ""}). It shows what usually happens, not a forecast.
      </p>
    </section>
  );
}

export default function MarketPulse({ farm, plan }: { farm: Farm; plan: PlanResult }) {
  const [data, setData] = useState<MarketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [news, setNews] = useState<News | null>(null);
  const [newsState, setNewsState] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch("/api/market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farm }) })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Market data unavailable");
        if (!cancelled) setData(d);
      })
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
    // Re-run only when the plan changes, not on every farm update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.createdAt]);

  async function loadNews() {
    setNewsState("loading");
    try {
      const r = await fetch("/api/market-news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crops: plan.details.map((d) => CROPS[d.allocation.crop].name), state: farm.data.place.state ?? "Kaduna" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNews(d);
      setNewsState("idle");
    } catch {
      setNewsState("error");
    }
  }

  const noHistory = data && !data.data.period;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        <section className="rounded-3xl bg-leaf-900 p-6 text-white">
          <p className="flex items-center gap-2 text-sm font-semibold text-leaf-100">
            <TrendingUp className="h-4 w-4" /> Market Pulse
          </p>
          <h1 className="mt-2 text-2xl font-bold">When should you sell?</h1>
          <p className="mt-2 text-leaf-100">
            Many farmers sell everything at harvest, when prices are lowest. FarmPilot shows how prices usually move after harvest, and whether storing pays for your crops.
          </p>
        </section>
        {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {noHistory && (
          <p className="rounded-2xl bg-sun-100 px-4 py-3 text-sm">Market history hasn&apos;t been loaded yet, so seasonal patterns aren&apos;t available. The news on the right still works.</p>
        )}
        {!data && !error && (
          <p className="flex items-center gap-2 rounded-3xl border border-line bg-white p-6 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> Comparing today&apos;s prices with years of market history…
          </p>
        )}
        {data?.crops.map((c) => (
          <CropMarket key={c.crop} {...c} period={data.data.period} />
        ))}
        {data?.data.period && (
          <p className="px-1 text-xs text-muted">
            Seasonal patterns:{" "}
            <a href={data.data.sourceUrl} target="_blank" rel="noreferrer" className="text-leaf-700 hover:underline">
              {data.data.source}
            </a>
            , {data.data.period}. Today&apos;s prices: Muse Spark web search.
          </p>
        )}
      </div>

      <section className="min-w-0 self-start rounded-3xl border border-line bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Newspaper className="h-5 w-5 text-leaf-600" /> Market news
        </h2>
        <p className="mt-1 text-sm text-muted">This month&apos;s news for your crops, found by Muse Spark web search.</p>
        {news ? (
          <>
            <ul className="mt-4 space-y-3">
              {news.items.map((n) => (
                <li key={n.crop + n.headline} className="rounded-2xl bg-canvas p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{n.crop}</p>
                  <p className="font-semibold">{n.headline}</p>
                  <p className="mt-1 text-sm">{n.text}</p>
                </li>
              ))}
            </ul>
            {!!news.sources.length && (
              <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                {news.sources.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-leaf-700 hover:underline">
                    <ExternalLink className="h-3 w-3" /> {s.title}
                  </a>
                ))}
              </p>
            )}
          </>
        ) : (
          <button
            onClick={loadNews}
            disabled={newsState === "loading"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {newsState === "loading" ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Searching the news…
              </>
            ) : (
              "Get this month's market news"
            )}
          </button>
        )}
        {newsState === "error" && <p className="mt-2 text-sm text-red-700">Couldn&apos;t load the news. Please try again.</p>}
      </section>
    </div>
  );
}
