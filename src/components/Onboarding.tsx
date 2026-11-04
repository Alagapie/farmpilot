"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import LocateStep, { type LocatedFarm } from "./LocateStep";
import { toAcres } from "@/lib/geo";
import type { Farm, FarmData } from "@/lib/types";

const CROPS = ["Maize", "Rice", "Soybean", "Cassava", "Tomato"];
const BUDGETS = [150_000, 300_000, 600_000, 1_000_000, 2_000_000];

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

type Step = "locate" | "details" | "analysing";

export default function Onboarding({ onDone }: { onDone: (farm: Farm) => void }) {
  const [step, setStep] = useState<Step>("locate");
  const [located, setLocated] = useState<LocatedFarm | null>(null);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState(600_000);
  const [experience, setExperience] = useState<Farm["experience"]>("some");
  const [goal, setGoal] = useState<Farm["goal"]>("sell");
  const [interests, setInterests] = useState<string[]>([]);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function analyse() {
    if (!located) return;
    setStep("analysing");
    setError(null);
    setAnalysisStage(0);
    const timer = setInterval(() => setAnalysisStage((s) => Math.min(s + 1, 3)), 1400);
    try {
      const res = await fetch(`/api/farm-data?lat=${located.lat}&lon=${located.lon}`);
      if (!res.ok) throw new Error("Couldn't load farm data");
      const data: FarmData = await res.json();
      onDone({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        name: name.trim() || "My farm",
        lat: located.lat,
        lon: located.lon,
        hectares: Math.round(located.hectares * 100) / 100,
        hectaresSource: located.source,
        polygon: located.polygon,
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
      "Analysing 25 years of NASA rainfall & temperature",
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

  if (step === "details" && located) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <button onClick={() => setStep("locate")} className="mb-6 flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to map
        </button>
        <p className="text-sm font-semibold uppercase tracking-wide text-leaf-600">Step 2 of 2</p>
        <h1 className="mt-1 text-3xl font-bold">Tell us about your farm</h1>
        <p className="mt-2 text-muted">
          Your farm is {located.hectares.toFixed(2)} ha (≈ {toAcres(located.hectares).toFixed(1)} acres). A few more details and FarmPilot can plan your season.
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
    <LocateStep
      onConfirm={(farm) => {
        setLocated(farm);
        setStep("details");
      }}
    />
  );
}
