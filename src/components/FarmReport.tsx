"use client";

import { useEffect, useState } from "react";
import { ChevronDown, CloudRain, Layers, Loader2, MapPin, Sparkles, Sprout, Sun } from "lucide-react";
import { dayWeather, monthWeather, plainForecast, plainRain, plainSoil, shortDay, type Level } from "@/lib/plain";
import { toAcres } from "@/lib/geo";
import type { Farm, FarmSummary } from "@/lib/types";

const LEVEL: Record<Level, { chip: string; text: string }> = {
  good: { chip: "bg-leaf-100 text-leaf-700", text: "Good" },
  watch: { chip: "bg-sun-100 text-amber-800", text: "Keep an eye" },
  act: { chip: "bg-red-100 text-red-700", text: "Needs action" },
};

const POINT_ICON: Record<FarmSummary["points"][number]["kind"], string> = {
  good: "✅",
  warning: "⚠️",
  tip: "💡",
  weather: "🌦️",
};

function Card({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Summary({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (farm.summary) return;
    let cancelled = false;
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

export default function FarmReport({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const { place, zone, soil, climate, forecast } = farm.data;
  const [showForecast, setShowForecast] = useState(false);
  const [showSoilNumbers, setShowSoilNumbers] = useState(false);
  const rain = climate ? plainRain(climate) : null;
  const week = forecast.length ? plainForecast(forecast) : null;
  const thisMonth = new Date().toLocaleDateString("en-US", { month: "short" });

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Summary farm={farm} onUpdate={onUpdate} />

      <Card title="Your farm" icon={<MapPin className="h-5 w-5 text-leaf-600" />}>
        <p className="text-4xl font-bold text-leaf-700">{toAcres(farm.hectares).toFixed(1)} acres</p>
        <p className="text-sm text-muted">
          {farm.hectares.toFixed(2)} hectares ·{" "}
          {farm.hectaresSource === "sam" ? "measured from satellite by SAM 3.1" : farm.hectaresSource === "walk" ? "measured by walking the edges" : "entered by you"}
        </p>
        <dl className="mt-5 space-y-3 text-sm">
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

      <Card title="When does it rain?" icon={<CloudRain className="h-5 w-5 text-sky-500" />} className="lg:col-span-2">
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
                    title={`${m.month}: ${w.word} (${m.rainMm}mm)`}
                    className={`flex flex-col items-center rounded-xl py-2 ${climate.rainyMonths.includes(m.month) ? "bg-sky-500/15" : "bg-canvas"} ${now ? "ring-2 ring-leaf-600" : ""}`}
                  >
                    <span className="text-xs font-semibold">{m.month}</span>
                    <span className="text-xl">{w.icon}</span>
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
            <p className="mt-3 text-xs text-muted">Based on 20 years of NASA weather records for your exact location.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Rain records are unavailable right now.</p>
        )}
      </Card>

      <Card title="Your soil" icon={<Layers className="h-5 w-5 text-soil-500" />} className="lg:col-span-2">
        {soil ? (
          <>
            <ul className="grid gap-3 sm:grid-cols-2">
              {plainSoil(soil).map((s) => (
                <li key={s.key} className="rounded-2xl border border-line p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-2 font-bold">
                      <span className="text-xl">{s.emoji}</span>
                      {s.title}
                    </p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[s.level].chip}`}>{LEVEL[s.level].text}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{s.meaning}</p>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold text-leaf-700">What to do: </span>
                    {s.action}
                  </p>
                  {showSoilNumbers && <p className="mt-2 text-xs text-muted">{s.technical}</p>}
                </li>
              ))}
            </ul>
            <button onClick={() => setShowSoilNumbers((v) => !v)} className="mt-3 text-xs font-semibold text-muted hover:text-ink">
              {showSoilNumbers ? "Hide" : "Show"} lab numbers
            </button>
            <p className="mt-1 text-xs text-muted">Estimated from ISRIC SoilGrids satellite soil maps. A soil test from your extension office is more exact.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Soil information is unavailable for this spot right now.</p>
        )}
      </Card>

      <Card title="Weather this week" icon={<Sun className="h-5 w-5 text-sun-500" />}>
        {week ? (
          <>
            <p className="text-xl font-bold">{week.headline}</p>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {forecast.slice(0, 7).map((d) => {
                const w = dayWeather(d);
                return (
                  <div key={d.date} className="flex flex-col items-center rounded-xl bg-canvas py-2" title={w.word}>
                    <span className="text-[11px] font-semibold">{new Date(d.date).toLocaleDateString("en-NG", { weekday: "short" })}</span>
                    <span className="text-lg">{w.icon}</span>
                    <span className="text-[11px] text-muted">{Math.round(d.tMax)}°</span>
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
              {showForecast ? "Hide" : "See"} 16-day details
            </button>
            {showForecast && (
              <ul className="mt-2 space-y-1 text-xs">
                {forecast.map((d) => (
                  <li key={d.date} className="flex justify-between rounded-lg px-2 py-1 odd:bg-canvas">
                    <span>{shortDay(d.date)}</span>
                    <span>
                      {dayWeather(d).icon} {d.rainMm.toFixed(0)}mm · {Math.round(d.tMin)}–{Math.round(d.tMax)}°C · wind {Math.round(d.windKmh)}km/h
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Forecast unavailable right now.</p>
        )}
      </Card>

      <section className="flex flex-col items-start justify-between gap-4 rounded-3xl border-2 border-dashed border-leaf-500/40 bg-leaf-50 p-6 sm:flex-row sm:items-center lg:col-span-3">
        <div className="flex items-start gap-3">
          <Sprout className="mt-1 h-6 w-6 shrink-0 text-leaf-600" />
          <div>
            <p className="text-lg font-bold">Next: what should you plant?</p>
            <p className="text-sm text-muted">
              Muse Wonder will compare crops for your soil, rain, land and budget: what it costs, what you can earn, and the risks.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-4 py-2 text-sm text-muted">Coming next</span>
      </section>
    </div>
  );
}
