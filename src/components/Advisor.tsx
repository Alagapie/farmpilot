"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CircleAlert, CirclePause, CircleCheck, Info, Loader2, Radio, Sparkles, Wand2 } from "lucide-react";
import { advise, activeTasks, type Alert, type Day } from "@/lib/advisor";
import { addDays, buildCalendar, daysBetween, seasonSpan } from "@/lib/calendar";
import { dayOfMonth, dayWeather, shortDay, weekday } from "@/lib/plain";
import { weatherFrom } from "@/lib/weather-sim";
import type { PlanResult } from "@/lib/plan";
import type { Farm } from "@/lib/types";
import { CROP_EMOJI } from "./SeasonPlan";

const LEVEL: Record<Alert["level"], { cls: string; icon: React.ReactNode; tag: string }> = {
  warn: { cls: "border-amber-300 bg-sun-100", icon: <CircleAlert className="h-5 w-5 text-amber-700" />, tag: "Watch out" },
  wait: { cls: "border-sky-500/40 bg-sky-500/10", icon: <CirclePause className="h-5 w-5 text-sky-500" />, tag: "Wait" },
  act: { cls: "border-leaf-500/50 bg-leaf-50", icon: <CircleCheck className="h-5 w-5 text-leaf-600" />, tag: "Do this" },
  info: { cls: "border-line bg-white", icon: <Info className="h-5 w-5 text-muted" />, tag: "Coming up" },
};

const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

export default function Advisor({ farm, plan }: { farm: Farm; plan: PlanResult }) {
  const tasks = useMemo(() => buildCalendar(plan), [plan]);
  const span = seasonSpan(tasks);
  const realToday = todayIso();
  const maxOffset = Math.max(daysBetween(realToday, span.to) + 14, 30);
  const [offset, setOffset] = useState(0);
  const date = addDays(realToday, offset);

  const weather: Day[] = useMemo(
    () => weatherFrom(date, 14, farm.data.forecast, farm.data.climate, farm.data.place.label),
    [date, farm.data.forecast, farm.data.climate, farm.data.place.label],
  );
  const alerts = useMemo(() => advise(date, tasks, weather), [date, tasks, weather]);
  const simulated = weather.slice(0, 7).some((w) => w.simulated);
  const upcoming = tasks.filter((t) => t.start > addDays(date, 6)).slice(0, 5);
  const doing = activeTasks(date, tasks).length;

  // Jump points for the demo: the season's key moments.
  const jumps = [
    { label: "Today", iso: realToday },
    ...plan.details.flatMap((d) => {
      const a = d.allocation;
      const emoji = CROP_EMOJI[a.crop];
      const urea = tasks.find((t) => t.crop === a.crop && t.kind === "fertilize" && /urea|flowering/i.test(t.title));
      return [
        ...(a.nurseryStart ? [{ label: `${emoji} Nursery`, iso: a.nurseryStart }] : []),
        { label: `${emoji} Planting`, iso: a.plantFrom },
        ...(urea ? [{ label: `${emoji} Fertilizer`, iso: urea.start }] : []),
        { label: `${emoji} Harvest`, iso: d.harvestFrom },
      ];
    }),
  ].filter((j) => j.iso >= realToday);

  // Muse Spark briefing, cached per date and debounced while the slider moves.
  const [briefing, setBriefing] = useState<{ greeting: string; message: string } | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const cache = useRef(new Map<string, { greeting: string; message: string }>());
  useEffect(() => {
    const key = `${plan.createdAt}:${date}`;
    const hit = cache.current.get(key);
    if (hit) {
      setBriefing(hit);
      return;
    }
    setBriefing(null);
    setBriefingLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      const w = weather.slice(0, 7).map((d) => `${weekday(d.date)} ${dayWeather(d).word.toLowerCase()} ${Math.round(d.tMax)}°C ${d.rainMm.toFixed(0)}mm`).join(", ");
      fetch("/api/briefing", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmName: farm.name, place: farm.data.place.label, date, simulated, alerts: alerts.slice(0, 6), weather: w }),
      })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((b) => {
          cache.current.set(key, b);
          setBriefing(b);
        })
        .catch(() => {})
        .finally(() => setBriefingLoading(false));
    }, 700);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [date, alerts, weather, simulated, farm.name, farm.data.place.label, plan.createdAt]);

  return (
    <div className="space-y-4">
      {/* Date simulator */}
      <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="h-5 w-5 text-leaf-600" /> {offset === 0 ? "Today" : "Simulated date"}: {shortDay(date)}
          </h2>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)} className="rounded-xl border border-line px-3 py-1.5 text-sm font-semibold">
              Back to today
            </button>
          )}
        </div>
        <input
          type="range"
          min={0}
          max={maxOffset}
          value={offset}
          onChange={(e) => setOffset(Number(e.target.value))}
          className="mt-4 w-full accent-[#23803a]"
          aria-label="Simulate a date in the season"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>{dayOfMonth(realToday)}</span>
          <span>Move the slider to see how FarmPilot guides you through the season</span>
          <span>{dayOfMonth(addDays(realToday, maxOffset))}</span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {jumps.map((j) => (
            <button
              key={j.label + j.iso}
              onClick={() => setOffset(daysBetween(realToday, j.iso))}
              className={`rounded-full border px-3 py-1 text-sm ${date === j.iso ? "border-leaf-600 bg-leaf-600 text-white" : "border-line hover:border-leaf-500"}`}
            >
              {j.label} · {dayOfMonth(j.iso)}
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Briefing */}
          <section className="rounded-3xl bg-leaf-900 p-6 text-white">
            <p className="flex items-center gap-2 text-sm font-semibold text-leaf-100">
              <Sparkles className="h-4 w-4" /> Morning briefing · by Muse Spark
            </p>
            {briefing ? (
              <>
                <p className="mt-2 text-2xl font-bold">{briefing.greeting}</p>
                <p className="mt-2 text-[17px] leading-relaxed text-leaf-50">{briefing.message}</p>
              </>
            ) : briefingLoading ? (
              <p className="mt-3 flex items-center gap-2 text-leaf-100">
                <Loader2 className="h-5 w-5 animate-spin" /> Reading your tasks and the weather…
              </p>
            ) : (
              <p className="mt-3 text-leaf-100">Briefing unavailable; your alerts are below.</p>
            )}
            <p className="mt-3 text-xs text-leaf-100/80">
              {doing} task{doing === 1 ? "" : "s"} this week · {alerts.filter((a) => a.level !== "info").length} need attention
            </p>
          </section>

          {/* Alerts */}
          <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold">This week on your farm</h2>
            {alerts.length ? (
              <ul className="mt-3 space-y-3">
                {alerts.map((a) => (
                  <li key={a.id} className={`rounded-2xl border p-4 ${LEVEL[a.level].cls}`}>
                    <div className="flex items-start gap-3">
                      {LEVEL[a.level].icon}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          {LEVEL[a.level].tag}
                          {a.crop && ` · ${CROP_EMOJI[a.crop]}`}
                        </p>
                        <p className="font-bold">{a.title}</p>
                        <p className="mt-1 text-[15px]">{a.message}</p>
                        <p className="mt-1 text-xs text-muted">Why: {a.reason}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-muted">Nothing due this week. {upcoming[0] ? `Next: ${upcoming[0].title} from ${shortDay(upcoming[0].start)}.` : ""}</p>
            )}
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          {/* Weather */}
          <section className="rounded-3xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Weather</h2>
              {simulated ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-sun-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  <Wand2 className="h-3.5 w-3.5" /> Simulated from 25-year averages
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-leaf-100 px-2.5 py-1 text-xs font-semibold text-leaf-700">
                  <Radio className="h-3.5 w-3.5" /> Live forecast
                </span>
              )}
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {weather.slice(0, 7).map((w) => (
                <li key={w.date} className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-canvas">
                  <span className="w-24">
                    {weekday(w.date)} {dayOfMonth(w.date)}
                  </span>
                  <span className="text-lg">{dayWeather(w).icon}</span>
                  <span className="w-14 text-right text-sky-500">{w.rainMm >= 0.5 ? `${w.rainMm.toFixed(0)}mm` : "–"}</span>
                  <span className="w-12 text-right">{Math.round(w.tMax)}°</span>
                  {w.simulated && <span className="text-[10px] text-amber-700">sim</span>}
                </li>
              ))}
            </ul>
            {simulated && (
              <p className="mt-2 text-xs text-muted">The real forecast covers only the next 16 days. Later dates use demo weather built from this farm&apos;s 25-year monthly averages.</p>
            )}
          </section>

          {/* Coming up */}
          <section className="rounded-3xl border border-line bg-white p-5">
            <h2 className="font-bold">Coming up</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {upcoming.map((t) => (
                <li key={t.id} className="flex gap-2">
                  <span>{CROP_EMOJI[t.crop]}</span>
                  <span>
                    <b>{t.title}</b>
                    <span className="block text-xs text-muted">from {shortDay(t.start)}</span>
                  </span>
                </li>
              ))}
              {!upcoming.length && <li className="text-muted">The season is nearly done.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
