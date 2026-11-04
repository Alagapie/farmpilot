"use client";

import { useState } from "react";
import { FlaskConical, Layers, Satellite } from "lucide-react";
import { effectiveSoil, plainSoil, type Level, type PlainSoil } from "@/lib/plain";
import type { Farm, LabSoil } from "@/lib/types";

const LEVEL: Record<Level, { chip: string; text: string }> = {
  good: { chip: "bg-leaf-100 text-leaf-700", text: "Good" },
  watch: { chip: "bg-sun-100 text-amber-800", text: "Keep an eye" },
  act: { chip: "bg-red-100 text-red-700", text: "Needs action" },
};

const CONFIDENCE: Record<PlainSoil["confidence"], { text: string; cls: string; tip: string }> = {
  high: { text: "High", cls: "text-leaf-700", tip: "The satellite model's likely range is narrow." },
  moderate: { text: "Moderate", cls: "text-amber-700", tip: "The likely range is fairly wide. A soil test would make this exact." },
  low: { text: "Low", cls: "text-red-700", tip: "The likely range is very wide. Treat this as a rough guide only." },
  lab: { text: "Lab test", cls: "text-sky-500", tip: "From your laboratory soil test." },
};

function SourceBadge({ lab }: { lab: boolean }) {
  return lab ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-500">
      <FlaskConical className="h-3.5 w-3.5" /> Includes your lab test
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">
      <Satellite className="h-3.5 w-3.5" /> Satellite estimate · not a lab test
    </span>
  );
}

function LabForm({ farm, onUpdate, onClose }: { farm: Farm; onUpdate: (f: Farm) => void; onClose: () => void }) {
  const [ph, setPh] = useState(farm.labSoil?.ph?.toString() ?? "");
  const [oc, setOc] = useState(farm.labSoil?.organicCarbonPct?.toString() ?? "");
  const [n, setN] = useState(farm.labSoil?.nitrogenPct?.toString() ?? "");
  const [date, setDate] = useState(farm.labSoil?.testedOn ?? "");

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
  const valid = [ph, oc, n].some((v) => v.trim() !== "") && [num(ph), num(oc), num(n)].every((v) => v === undefined || Number.isFinite(v));

  function save() {
    const labSoil: LabSoil = { ph: num(ph), organicCarbonPct: num(oc), nitrogenPct: num(n), testedOn: date || undefined };
    // The plain-words summary was written from the old soil numbers, so drop it to regenerate.
    onUpdate({ ...farm, labSoil, summary: undefined });
    onClose();
  }

  const input = "mt-1 w-full rounded-xl border border-line px-3 py-2 outline-none focus:border-leaf-500";
  return (
    <div className="mt-4 rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
      <p className="font-semibold">Enter your lab soil test results</p>
      <p className="text-sm text-muted">Copy the numbers from your soil test report. Leave a box empty if it isn&apos;t on the report.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-4">
        <label className="text-sm">
          pH (in water)
          <input value={ph} onChange={(e) => setPh(e.target.value)} inputMode="decimal" placeholder="e.g. 5.8" className={input} />
        </label>
        <label className="text-sm">
          Organic carbon (%)
          <input value={oc} onChange={(e) => setOc(e.target.value)} inputMode="decimal" placeholder="e.g. 0.9" className={input} />
        </label>
        <label className="text-sm">
          Total nitrogen (%)
          <input value={n} onChange={(e) => setN(e.target.value)} inputMode="decimal" placeholder="e.g. 0.07" className={input} />
        </label>
        <label className="text-sm">
          Date of test
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button onClick={save} disabled={!valid} className="rounded-xl bg-leaf-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">
          Use my lab results
        </button>
        {farm.labSoil && (
          <button
            onClick={() => {
              onUpdate({ ...farm, labSoil: undefined, summary: undefined });
              onClose();
            }}
            className="rounded-xl border border-line px-4 py-2 text-sm"
          >
            Remove lab results
          </button>
        )}
        <button onClick={onClose} className="px-3 py-2 text-sm text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function SoilSection({ farm, onUpdate }: { farm: Farm; onUpdate: (f: Farm) => void }) {
  const [labOpen, setLabOpen] = useState(false);
  const soil = effectiveSoil(farm.data.soil, farm.labSoil);
  const items = soil ? plainSoil(soil) : [];
  const hasLab = items.some((i) => i.confidence === "lab");

  return (
    <section className="rounded-3xl border border-line bg-white p-5 sm:p-6 lg:col-span-2">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Layers className="h-5 w-5 text-soil-500" /> Your soil
        </h2>
        <SourceBadge lab={hasLab} />
      </div>

      {!soil ? (
        <p className="text-sm text-muted">Soil information is unavailable for this spot right now. You can enter a lab test below.</p>
      ) : (
        <>
          {/* At a glance: the numbers behind the advice */}
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">Property</th>
                  <th className="px-3 py-2 font-semibold">Estimate</th>
                  <th className="hidden px-3 py-2 font-semibold sm:table-cell">Likely range (90%)</th>
                  <th className="px-3 py-2 font-semibold">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.key} className="border-t border-line align-top">
                    <td className="px-3 py-2.5 font-medium">{i.label}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-bold">{i.estimate}</span>
                      <span className="block text-xs text-muted">{i.rating}</span>
                      {i.range && <span className="block text-xs text-muted sm:hidden">{i.range}</span>}
                    </td>
                    <td className="hidden px-3 py-2.5 text-muted sm:table-cell">{i.range ?? "—"}</td>
                    <td className={`px-3 py-2.5 font-semibold ${CONFIDENCE[i.confidence].cls}`} title={CONFIDENCE[i.confidence].tip}>
                      {CONFIDENCE[i.confidence].text}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            Source: ISRIC SoilGrids 2.0 (250m satellite soil model, topsoil 0–30cm). Confidence comes from the width of the model&apos;s own 90%
            prediction range. Values from a lab test replace the estimates.
          </p>

          {/* What it means, in plain words */}
          <h3 className="mb-3 mt-6 font-bold">What this means for you</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map((s) => (
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
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-canvas p-4 text-sm">
        <FlaskConical className="h-5 w-5 shrink-0 text-sky-500" />
        <p className="flex-1">
          {farm.labSoil
            ? `Using your lab test${farm.labSoil.testedOn ? ` from ${farm.labSoil.testedOn}` : ""} for the values marked "Lab test".`
            : "Have a soil test from a lab or extension office? Enter it to replace the satellite estimates."}
        </p>
        {!labOpen && (
          <button onClick={() => setLabOpen(true)} className="rounded-xl border border-line bg-white px-3 py-2 font-semibold hover:border-leaf-500">
            {farm.labSoil ? "Edit lab results" : "Enter lab results"}
          </button>
        )}
      </div>
      {labOpen && <LabForm farm={farm} onUpdate={onUpdate} onClose={() => setLabOpen(false)} />}
    </section>
  );
}
