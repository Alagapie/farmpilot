"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, LocateFixed, MapPin, MousePointerClick, Search, Sparkles } from "lucide-react";
import type { FlyTarget } from "./FieldMap";
import type { Field, FieldResult } from "@/lib/sam";
import type { Farm, FarmData } from "@/lib/types";

const FieldMap = dynamic(() => import("./FieldMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-leaf-900/80" />,
});

const DEMO = { lat: 11.175, lon: 7.59, label: "Shika, Giwa LGA, Kaduna" };
const CROPS = ["Maize", "Rice", "Soybean", "Cassava", "Tomato"];
const BUDGETS = [150_000, 300_000, 600_000, 1_000_000, 2_000_000];
const MIN_SCAN_ZOOM = 15;

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

function insidePolygon([lat, lon]: [number, number], poly: [number, number][]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function centroid(poly: [number, number][]): [number, number] {
  const n = poly.length || 1;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

type Step = "map" | "details" | "analysing";

export default function Onboarding({ onDone }: { onDone: (farm: Farm) => void }) {
  const [step, setStep] = useState<Step>("map");

  // Map step
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanPoint, setScanPoint] = useState<[number, number] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [mapMsg, setMapMsg] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [manualHa, setManualHa] = useState("");
  const [intro, setIntro] = useState(true);

  // Details step
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(600_000);
  const [experience, setExperience] = useState<Farm["experience"]>("some");
  const [goal, setGoal] = useState<Farm["goal"]>("sell");
  const [interests, setInterests] = useState<string[]>([]);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const picked = useMemo(() => fields.filter((f) => selected.has(f.id)), [fields, selected]);
  const samHa = picked.reduce((s, f) => s + f.hectares, 0);
  const hectares = manualHa ? Number(manualHa) : samHa;
  const anchor: [number, number] | null = picked.length ? centroid(picked[0].polygon) : scanPoint;

  const fly = (lat: number, lon: number, zoom = 17) => setFlyTo({ lat, lon, zoom, key: Date.now() });

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
    const rows = await res.json();
    setResults(rows);
    if (rows[0]) fly(rows[0].lat, rows[0].lon, 14);
  }

  function locate() {
    navigator.geolocation?.getCurrentPosition(
      (p) => fly(p.coords.latitude, p.coords.longitude, 17),
      () => setMapMsg("Couldn't get your location. Search for your village instead."),
    );
  }

  async function scan(lat: number, lon: number, zoom: number) {
    if (scanning) return;
    if (zoom < MIN_SCAN_ZOOM) {
      setMapMsg("Zoom in closer to your farm, then click the middle of your field.");
      fly(lat, lon, Math.min(zoom + 3, 17));
      return;
    }
    setScanning(true);
    setScanPoint([lat, lon]);
    setMapMsg(null);
    try {
      const res = await fetch("/api/segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
      });
      const data: FieldResult & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Field mapping failed");
      // Keep plots the farmer already chose; drop new detections that duplicate them.
      const kept = fields.filter((f) => selected.has(f.id));
      const fresh = data.fields.filter((f) => !kept.some((k) => insidePolygon(centroid(f.polygon), k.polygon)));
      setFields([...kept, ...fresh]);
      if (fresh.some((f) => f.id === data.pickedId)) setSelected(new Set([...selected, data.pickedId]));
      if (!data.clickedInside) setMapMsg("Your click wasn't inside a clear field, so we picked the nearest one. Tap the right field if it's wrong.");
    } catch (err) {
      setMapMsg((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function toggleField(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function analyse() {
    if (!anchor) return;
    setStep("analysing");
    setError(null);
    setAnalysisStage(0);
    const timer = setInterval(() => setAnalysisStage((s) => Math.min(s + 1, 3)), 1400);
    try {
      const res = await fetch(`/api/farm-data?lat=${anchor[0]}&lon=${anchor[1]}`);
      if (!res.ok) throw new Error("Couldn't load farm data");
      const data: FarmData = await res.json();
      onDone({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        name: name.trim() || "My farm",
        lat: anchor[0],
        lon: anchor[1],
        hectares: Math.round(hectares * 100) / 100,
        hectaresSource: manualHa ? "manual" : "sam",
        polygon: picked[0]?.polygon ?? [],
        budgetNaira: budget,
        experience,
        goal,
        interests,
        data,
      });
    } catch (err) {
      setError((err as Error).message);
      setStep("details");
    } finally {
      clearInterval(timer);
    }
  }

  if (step === "analysing") {
    const stages = [
      "Locating your farm and agro-ecological zone",
      "Reading your soil from SoilGrids (0–30cm)",
      "Analysing 20 years of NASA rainfall & temperature",
      "Pulling your 16-day weather forecast",
    ];
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-sm">
          <Sparkles className="mb-4 h-8 w-8 text-leaf-600" />
          <h2 className="text-2xl font-bold">Building your farm profile</h2>
          <ul className="mt-6 space-y-3">
            {stages.map((s, i) => (
              <li key={s} className={`flex items-center gap-3 text-sm ${i <= analysisStage ? "text-ink" : "text-muted/50"}`}>
                {i < analysisStage ? (
                  <Check className="h-4 w-4 text-leaf-600" />
                ) : i === analysisStage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-leaf-600" />
                ) : (
                  <span className="h-4 w-4 rounded-full border border-line" />
                )}
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (step === "details") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <button onClick={() => setStep("map")} className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to map
        </button>
        <p className="text-sm font-semibold uppercase tracking-wide text-leaf-600">Step 2 of 2</p>
        <h1 className="mt-1 text-3xl font-bold">Tell us about your farm</h1>
        <p className="mt-2 text-muted">
          {hectares.toFixed(2)} ha ({(hectares * 2.471).toFixed(1)} acres) mapped. A few more details and FarmPilot can plan your season.
        </p>

        <div className="mt-8 space-y-8 rounded-3xl border border-line bg-white p-6 sm:p-8">
          <label className="block">
            <span className="font-semibold">Farm name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Musa's farm"
              className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-leaf-500"
            />
          </label>

          <div>
            <span className="font-semibold">How much can you invest this season?</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {BUDGETS.map((b) => (
                <button
                  key={b}
                  onClick={() => setBudget(b)}
                  className={`rounded-full border px-4 py-2 text-sm ${budget === b ? "border-leaf-600 bg-leaf-600 text-white" : "border-line hover:border-leaf-500"}`}
                >
                  {naira(b)}
                </button>
              ))}
              <label className="flex items-center gap-1 rounded-full border border-line px-4 py-2 text-sm focus-within:border-leaf-500">
                <span className="text-muted">Other: ₦</span>
                <input
                  type="number"
                  min={10000}
                  step={10000}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="w-28 outline-none"
                  aria-label="Custom budget in naira"
                />
              </label>
            </div>
          </div>

          <div>
            <span className="font-semibold">Farming experience</span>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["new", "New to farming"],
                  ["some", "A few seasons"],
                  ["experienced", "Many years"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setExperience(v)}
                  className={`rounded-xl border px-4 py-3 text-sm ${experience === v ? "border-leaf-600 bg-leaf-50 font-semibold text-leaf-700" : "border-line hover:border-leaf-500"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-semibold">Main goal</span>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["sell", "Sell for profit"],
                  ["food", "Feed my family"],
                  ["both", "Both"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setGoal(v)}
                  className={`rounded-xl border px-4 py-3 text-sm ${goal === v ? "border-leaf-600 bg-leaf-50 font-semibold text-leaf-700" : "border-line hover:border-leaf-500"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="font-semibold">Crops you&apos;re considering</span>
            <span className="ml-2 text-sm text-muted">optional, or leave empty and let FarmPilot advise</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {CROPS.map((c) => {
                const on = interests.includes(c);
                return (
                  <button
                    key={c}
                    onClick={() => setInterests(on ? interests.filter((x) => x !== c) : [...interests, c])}
                    className={`rounded-full border px-4 py-2 text-sm ${on ? "border-leaf-600 bg-leaf-600 text-white" : "border-line hover:border-leaf-500"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button
            onClick={analyse}
            disabled={budget <= 0}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-6 py-4 font-semibold text-white hover:bg-leaf-700 disabled:opacity-50"
          >
            Analyse my farm <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <FieldMap
        fields={fields}
        selected={selected}
        scanPoint={scanPoint}
        flyTo={flyTo}
        onMapClick={scan}
        onFieldClick={toggleField}
      />

      {intro && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-leaf-900/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-leaf-600 text-2xl">🌱</span>
            <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">Your AI farming co-pilot</h1>
            <p className="mt-3 text-muted">
              FarmPilot maps your land, plans your season, warns you before the weather hurts your crops, and tells you the
              best time to sell.
            </p>
            <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
              {[
                ["🛰️", "Measures your farm from satellite"],
                ["🌦️", "Plans around your rainfall & soil"],
                ["📅", "Week-by-week season calendar"],
                ["📈", "Market prices & when to sell"],
              ].map(([icon, text]) => (
                <li key={text} className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2">
                  <span>{icon}</span>
                  {text}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setIntro(false)}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-5 py-3 font-semibold text-white hover:bg-leaf-700"
              >
                Find my farm <ArrowRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setIntro(false);
                  fly(DEMO.lat, DEMO.lon, 17);
                }}
                className="flex-1 rounded-2xl border border-line px-5 py-3 font-semibold hover:border-leaf-500"
              >
                Try a demo farm
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-muted">Powered by Meta Muse Spark, Muse Wonder, Muse Image &amp; SAM 3.1</p>
          </div>
        </div>
      )}

      {/* Top bar: brand + search */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 sm:p-4">
        <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 px-1 font-bold text-leaf-700">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf-600 text-white">🌱</span>
            FarmPilot
          </div>
          <form onSubmit={search} className="relative flex flex-1 items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your village or town…"
              className="w-full rounded-xl border border-line py-2 pl-9 pr-3 text-sm outline-none focus:border-leaf-500"
            />
            {results.length > 1 && (
              <ul className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-xl border border-line bg-white text-sm shadow-lg">
                {results.map((r) => (
                  <li key={`${r.lat},${r.lon}`}>
                    <button
                      type="button"
                      onClick={() => {
                        fly(r.lat, r.lon, 14);
                        setResults([]);
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-leaf-50"
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>
          <div className="flex gap-2">
            <button onClick={locate} className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm hover:border-leaf-500">
              <LocateFixed className="h-4 w-4" /> My location
            </button>
            <button
              onClick={() => fly(DEMO.lat, DEMO.lon, 17)}
              className="flex items-center gap-1 rounded-xl bg-sun-100 px-3 py-2 text-sm font-medium text-ink hover:bg-sun-500/30"
            >
              <MapPin className="h-4 w-4" /> Demo farm
            </button>
          </div>
        </div>
      </div>

      {/* Scanning overlay */}
      {scanning && (
        <div className="pointer-events-none absolute inset-0 z-[999] overflow-hidden">
          <div className="scan-line h-1/3 w-full bg-gradient-to-b from-transparent via-leaf-500/25 to-transparent" />
          <div className="absolute left-1/2 top-24 -translate-x-1/2 rounded-full bg-leaf-900/90 px-4 py-2 text-sm text-white shadow-lg">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            SAM 3.1 is mapping the fields around you…
          </div>
        </div>
      )}

      {/* Bottom panel */}
      <div className="absolute inset-x-0 bottom-0 z-[1000] p-3 sm:p-4">
        <div className="mx-auto max-w-3xl rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
          {mapMsg && <p className="mb-3 rounded-xl bg-sun-100 px-3 py-2 text-sm">{mapMsg}</p>}
          {!picked.length ? (
            <div className="flex items-start gap-3">
              <MousePointerClick className="mt-0.5 h-6 w-6 shrink-0 text-leaf-600" />
              <div>
                <p className="font-semibold">Step 1: find your farm and click the middle of your field</p>
                <p className="text-sm text-muted">
                  Meta&apos;s SAM 3.1 will outline every field nearby. Tap all the plots that are yours. No farm handy? Try the
                  demo farm.
                </p>
                {scanPoint && !scanning && (
                  <label className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                    Or enter your farm size:
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={manualHa}
                      onChange={(e) => setManualHa(e.target.value)}
                      className="w-20 rounded-lg border border-line px-2 py-1 text-ink outline-none focus:border-leaf-500"
                    />
                    ha
                    <button
                      onClick={() => setStep("details")}
                      disabled={!(Number(manualHa) > 0)}
                      className="rounded-lg bg-leaf-600 px-3 py-1 font-semibold text-white disabled:opacity-40"
                    >
                      Continue
                    </button>
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted">
                  {picked.length} plot{picked.length > 1 ? "s" : ""} selected · tap yellow fields to add more
                </p>
                <p className="text-3xl font-bold text-leaf-700">
                  {hectares.toFixed(2)} ha <span className="text-lg font-medium text-muted">({(hectares * 2.471).toFixed(1)} acres)</span>
                </p>
                <label className="mt-1 flex items-center gap-2 text-sm text-muted">
                  Not right? Enter size:
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    value={manualHa}
                    onChange={(e) => setManualHa(e.target.value)}
                    placeholder={samHa.toFixed(2)}
                    className="w-20 rounded-lg border border-line px-2 py-1 text-ink outline-none focus:border-leaf-500"
                  />
                  ha
                </label>
              </div>
              <button
                onClick={() => setStep("details")}
                disabled={!(hectares > 0)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-6 py-3 font-semibold text-white hover:bg-leaf-700 disabled:opacity-50"
              >
                This is my farm <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
