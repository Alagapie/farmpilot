"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CloudRain, History, Loader2, MapPin, Radio, RefreshCw, Sparkles, Sprout, Sun } from "lucide-react";
import SoilSection from "./SoilSection";
import { dayOfMonth, dayWeather, monthWeather, plainForecast, plainRain, shortDay, weekday } from "@/lib/plain";
import { toAcres } from "@/lib/geo";
import type { Farm, FarmSummary, ForecastDay } from "@/lib/types";

const POINT_ICON: Record<FarmSummary["points"][number]["kind"], string> = {
  good: "✅",
  warning: "⚠️",
  tip: "💡",
  weather: "🌦️",
};

const FORECAST_MAX_AGE_MS = 3 * 3_600_000;

function Card({ title, icon, badge, children, className = "" }: { title: string; icon: React.ReactNode; badge?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          {icon}
          {title}
        </h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Summary({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (farm.summary) return;
    let cancelled = false;
    setFailed(false);
    fetch("/api/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(farm) })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((summary: FarmSummary) => !cancelled && onUpdate({ ...farm, summary }))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [farm, onUpdate]);

  return (
    <section className="rounded-3xl bg-leaf-900 p-6 text-white sm:p-8 lg:col-span-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-leaf-100">
        <Sparkles className="h-4 w-4" /> Your farm in simple words · by Muse Spark
      </p>
      {farm.summary ? (
        <>
          <h1 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">{farm.summary.headline}</h1>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {farm.summary.points.map((p) => (
              <li key={p.text} className="flex gap-3 rounded-2xl bg-white/10 p-4 text-[15px] leading-relaxed">
                <span className="text-xl">{POINT_ICON[p.kind]}</span>
                {p.text}
              </li>
            ))}
          </ul>
        </>
      ) : failed ? (
        <p className="mt-3 text-leaf-100">The summary isn&apos;t available right now. Your farm details are below.</p>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-leaf-100">
          <Loader2 className="h-5 w-5 animate-spin" /> Reading your farm and writing a simple summary…
        </p>
      )}
    </section>
  );
}

function Badge({ icon, children, live = false }: { icon: React.ReactNode; children: React.ReactNode; live?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${live ? "bg-leaf-100 text-leaf-700" : "bg-canvas text-muted"}`}
    >
      {icon}
      {children}
    </span>
  );
}

const fetchedLabel = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  const time = d.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  return sameDay ? `today ${time}` : `${d.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} ${time}`;
};

export default function FarmReport({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const { place, zone, climate, forecastFetchedAt } = farm.data;
  const [showForecast, setShowForecast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Drop days that have already passed, so a saved farm never shows yesterday as "this week".
  const todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const forecast = farm.data.forecast.filter((d) => d.date >= todayIso);
  const rain = climate ? plainRain(climate) : null;
  const week = forecast.length ? plainForecast(forecast) : null;
  const thisMonth = new Date().toLocaleDateString("en-US", { month: "short" });
  const stale = !forecastFetchedAt || Date.now() - new Date(forecastFetchedAt).getTime() > FORECAST_MAX_AGE_MS;

  async function refreshForecast() {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/forecast?lat=${farm.lat}&lon=${farm.lon}`);
      if (!res.ok) return;
      const { days, fetchedAt } = (await res.json()) as { days: ForecastDay[]; fetchedAt: string };
      onUpdate({ ...farm, data: { ...farm.data, forecast: days, forecastFetchedAt: fetchedAt } });
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (stale) refreshForecast();
    // Only check when the farm loads; the refresh itself updates the timestamp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farm.id]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Summary farm={farm} onUpdate={onUpdate} />

      <Card title="Your farm" icon={<MapPin className="h-5 w-5 text-leaf-600" />}>
        <p className="text-4xl font-bold text-leaf-700">{toAcres(farm.hectares).toFixed(1)} acres</p>
        <p className="text-sm text-muted">{farm.hectares.toFixed(2)} hectares</p>
        <p className="mt-2 rounded-xl bg-canvas px-3 py-2 text-xs text-muted">
          {farm.hectaresSource === "sam"
            ? "Estimated from satellite imagery by Meta SAM 3.1. Field edges hidden by trees can make this off by 10–20%."
            : farm.hectaresSource === "walk"
              ? "Measured by GPS as you walked the corners. Accuracy depends on the GPS signal at each corner."
              : "Size entered by you."}
        </p>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-muted">Where</dt>
            <dd className="font-semibold">{place.label}</dd>
          </div>
          <div>
            <dt className="text-muted">Farming zone</dt>
            <dd className="font-semibold">{zone}</dd>
          </div>
          <div>
            <dt className="text-muted">Money to invest</dt>
            <dd className="font-semibold">₦{farm.budgetNaira.toLocaleString("en-NG")}</dd>
          </div>
        </dl>
      </Card>

      <Card
        title="When does it usually rain?"
        icon={<CloudRain className="h-5 w-5 text-sky-500" />}
        badge={climate && <Badge icon={<History className="h-3.5 w-3.5" />}>Historical average · {climate.period}</Badge>}
        className="lg:col-span-2"
      >
        {climate && rain ? (
          <>
            <p className="text-xl font-bold">{rain.headline}</p>
            <div className="mt-4 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
              {climate.months.map((m) => {
                const w = monthWeather(m.rainMm);
                const now = m.month === thisMonth;
                return (
                  <div
                    key={m.month}
                    title={`${m.month}: ${w.word}, ${m.rainMm}mm average`}
                    className={`flex flex-col items-center rounded-xl py-2 ${climate.rainyMonths.includes(m.month) ? "bg-sky-500/15" : "bg-canvas"} ${now ? "ring-2 ring-leaf-600" : ""}`}
                  >
                    <span className="text-xs font-semibold">{m.month}</span>
                    <span className="text-xl">{w.icon}</span>
                    <span className="text-[11px] font-semibold">{m.rainMm}mm</span>
                    <span className="text-[10px] leading-tight text-muted">{now ? "Now" : w.word}</span>
                  </div>
                );
              })}
            </div>
            <ul className="mt-4 space-y-2 text-[15px]">
              {rain.tips.map((t) => (
                <li key={t} className="flex gap-2">
                  <span>👉</span>
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Average of {climate.period} from NASA POWER (MERRA-2) for your location: {climate.annualRainMm.toLocaleString()}mm a year. This shows a
              typical year, not a forecast for this season.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">Rain records are unavailable right now.</p>
        )}
      </Card>

      <SoilSection farm={farm} onUpdate={onUpdate} />

      <Card
        title="Weather forecast"
        icon={<Sun className="h-5 w-5 text-sun-500" />}
        badge={
          forecastFetchedAt && (
            <Badge icon={<Radio className="h-3.5 w-3.5" />} live>
              Live forecast
            </Badge>
          )
        }
      >
        {week ? (
          <>
            <p className="text-xl font-bold">{week.headline}</p>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {forecast.slice(0, 7).map((d) => {
                const w = dayWeather(d);
                return (
                  <div key={d.date} className="flex flex-col items-center rounded-xl bg-canvas px-0.5 py-2" title={`${shortDay(d.date)}: ${w.word}`}>
                    <span className="text-[11px] font-semibold">{weekday(d.date)}</span>
                    <span className="text-[10px] text-muted">{dayOfMonth(d.date)}</span>
                    <span className="text-lg">{w.icon}</span>
                    <span className="text-[11px] font-semibold">{Math.round(d.tMax)}°</span>
                    <span className="text-[10px] text-sky-500">{d.rainMm >= 0.5 ? `${d.rainMm.toFixed(0)}mm` : "–"}</span>
                  </div>
                );
              })}
            </div>
            <ul className="mt-4 space-y-2 text-[15px]">
              {week.tips.map((t) => (
                <li key={t} className="flex gap-2">
                  <span>👉</span>
                  {t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => setShowForecast((v) => !v)}
              className="mt-4 flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink"
            >
              <ChevronDown className={`h-4 w-4 transition ${showForecast ? "rotate-180" : ""}`} />
              {showForecast ? "Hide" : "See"} all {forecast.length} days
            </button>
            {showForecast && (
              <ul className="mt-2 space-y-1 text-xs">
                {forecast.map((d) => (
                  <li key={d.date} className="flex justify-between gap-2 rounded-lg px-2 py-1 odd:bg-canvas">
                    <span className="whitespace-nowrap">{shortDay(d.date)}</span>
                    <span className="text-right">
                      {dayWeather(d).icon} {d.rainMm.toFixed(0)}mm ({d.rainChance}%) · {Math.round(d.tMin)}–{Math.round(d.tMax)}°C · {Math.round(d.windKmh)}km/h
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Forecast unavailable right now.</p>
        )}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
          <span>Open-Meteo forecast{forecastFetchedAt ? `, updated ${fetchedLabel(forecastFetchedAt)}` : ""}</span>
          <button onClick={refreshForecast} disabled={refreshing} className="flex items-center gap-1 font-semibold hover:text-ink disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </Card>

      <section className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-dashed border-leaf-500/40 bg-leaf-50 p-6 sm:flex-row sm:items-center lg:col-span-3">
        <div className="flex items-start gap-3">
          <Sprout className="mt-1 h-6 w-6 shrink-0 text-leaf-600" />
          <div>
            <p className="text-lg font-bold">Next: what should you plant?</p>
            <p className="text-sm text-muted">
              Muse Wonder will compare crops for your soil, rain, land and ₦{farm.budgetNaira.toLocaleString("en-NG")} budget: seed and fertilizer
              quantities, costs, expected earnings and risks.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm text-muted">Coming next</span>
      </section>
    </div>
  );
}
