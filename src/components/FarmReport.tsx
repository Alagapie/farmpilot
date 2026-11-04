"use client";

import { CloudRain, Droplets, Layers, MapPin, Sprout, Sun, Thermometer, Wind } from "lucide-react";
import { soilInsights, type Level } from "@/lib/soil-insights";
import type { Farm } from "@/lib/types";

const LEVEL_STYLE: Record<Level, string> = {
  good: "bg-leaf-100 text-leaf-700",
  watch: "bg-sun-100 text-amber-800",
  act: "bg-red-100 text-red-700",
};
const LEVEL_TEXT: Record<Level, string> = { good: "Good", watch: "Watch", act: "Act" };

function Card({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-5 sm:p-6 ${className}`}>
      <h2 className="mb-4 flex items-center gap-2 font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function FarmReport({ farm }: { farm: Farm }) {
  const { place, zone, soil, climate, forecast } = farm.data;
  const maxRain = Math.max(...(climate?.months.map((m) => m.rainMm) ?? [1]), 1);
  const nextRain = forecast.find((d) => d.rainMm >= 5);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Your farm" icon={<MapPin className="h-5 w-5 text-leaf-600" />}>
        <p className="text-3xl font-bold text-leaf-700">{farm.hectares.toFixed(2)} ha</p>
        <p className="text-sm text-muted">
          {(farm.hectares * 2.471).toFixed(1)} acres · {farm.hectaresSource === "sam" ? "measured by SAM 3.1" : "entered by you"}
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Location</dt>
            <dd className="text-right font-medium">{place.label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Agro-ecological zone</dt>
            <dd className="text-right font-medium">{zone}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Budget</dt>
            <dd className="text-right font-medium">₦{farm.budgetNaira.toLocaleString("en-NG")}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Rainfall pattern" icon={<CloudRain className="h-5 w-5 text-sky-500" />} className="lg:col-span-2">
        {climate ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <p>
                <span className="text-3xl font-bold">{climate.annualRainMm.toLocaleString()}</span>
                <span className="ml-1 text-muted">mm / year</span>
              </p>
              <p className="text-sm text-muted">
                Rainy season:{" "}
                <span className="font-semibold text-ink">
                  {climate.onsetMonth && climate.cessationMonth ? `${climate.onsetMonth} – ${climate.cessationMonth}` : "no clear season"}
                </span>{" "}
                ({climate.rainyMonths.length} months)
              </p>
            </div>
            <div className="mt-5 flex h-36 items-end gap-1.5" role="img" aria-label="Average monthly rainfall">
              {climate.months.map((m) => {
                const rainy = climate.rainyMonths.includes(m.month);
                return (
                  <div key={m.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100">{m.rainMm}</span>
                    <div
                      className={`w-full rounded-t-md ${rainy ? "bg-sky-500" : "bg-sky-500/25"}`}
                      style={{ height: `${Math.max((m.rainMm / maxRain) * 100, 2)}%` }}
                      title={`${m.month}: ${m.rainMm}mm, ${m.tMin.toFixed(0)}–${m.tMax.toFixed(0)}°C`}
                    />
                    <span className="text-[11px] text-muted">{m.month[0]}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">20-year average from NASA POWER. Dark bars are months with at least 75mm of rain.</p>
          </>
        ) : (
          <p className="text-sm text-muted">Climate data is unavailable right now.</p>
        )}
      </Card>

      <Card title="Soil health" icon={<Layers className="h-5 w-5 text-soil-500" />} className="lg:col-span-2">
        {soil ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {soilInsights(soil).map((i) => (
              <li key={i.label} className="rounded-2xl border border-line p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted">{i.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL_STYLE[i.level]}`}>{LEVEL_TEXT[i.level]}</span>
                </div>
                <p className={`mt-1 text-lg font-bold ${i.label === "Texture" ? "capitalize" : ""}`}>{i.value}</p>
                <p className="mt-1 text-sm text-muted">{i.note}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Soil data is unavailable for this spot right now.</p>
        )}
        <p className="mt-3 text-xs text-muted">Topsoil (0–30cm) estimates from ISRIC SoilGrids. A lab soil test is always more accurate.</p>
      </Card>

      <Card title="Next 16 days" icon={<Sun className="h-5 w-5 text-sun-500" />}>
        {forecast.length ? (
          <>
            <p className="mb-3 text-sm">
              {nextRain ? (
                <>
                  Next good rain: <span className="font-semibold">{new Date(nextRain.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" })}</span>{" "}
                  ({nextRain.rainMm.toFixed(0)}mm)
                </>
              ) : (
                <>No significant rain expected in the next 16 days.</>
              )}
            </p>
            <ul className="max-h-72 space-y-1 overflow-y-auto pr-1 text-sm">
              {forecast.map((d) => (
                <li key={d.date} className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-canvas">
                  <span className="w-20 text-muted">
                    {new Date(d.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" })}
                  </span>
                  <span className="flex w-16 items-center gap-1">
                    <Droplets className={`h-3.5 w-3.5 ${d.rainMm >= 1 ? "text-sky-500" : "text-muted/40"}`} />
                    {d.rainMm.toFixed(0)}mm
                  </span>
                  <span className="flex w-20 items-center gap-1">
                    <Thermometer className="h-3.5 w-3.5 text-sun-500" />
                    {d.tMin.toFixed(0)}–{d.tMax.toFixed(0)}°
                  </span>
                  <span className="flex items-center gap-1 text-muted">
                    <Wind className="h-3.5 w-3.5" />
                    {d.windKmh.toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-muted">Forecast unavailable right now.</p>
        )}
      </Card>

      <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-leaf-900 p-6 text-white sm:flex-row sm:items-center lg:col-span-3">
        <div className="flex items-start gap-3">
          <Sprout className="mt-1 h-6 w-6 shrink-0 text-leaf-100" />
          <div>
            <p className="text-lg font-bold">Next: your season plan</p>
            <p className="text-sm text-leaf-100">
              Muse Wonder will weigh your soil, rainfall, land and budget to recommend what to plant, how much it costs and what you can earn.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-4 py-2 text-sm">Coming next</span>
      </section>
    </div>
  );
}
