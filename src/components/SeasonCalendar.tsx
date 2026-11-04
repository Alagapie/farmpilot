"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Download, ImageIcon, Loader2 } from "lucide-react";
import { CROPS } from "@/data/crops";
import type { TaskKind } from "@/data/tasks";
import { buildCalendar, type FarmTask } from "@/lib/calendar";
import { shortDay } from "@/lib/plain";
import type { PlanResult } from "@/lib/plan";
import type { Farm } from "@/lib/types";
import { CROP_EMOJI } from "./SeasonPlan";

const KIND_ICON: Record<TaskKind, string> = {
  buy: "🛒",
  prep: "🚜",
  nursery: "🌱",
  plant: "🌾",
  fertilize: "🧪",
  spray: "💨",
  weed: "🪓",
  scout: "🔍",
  water: "💧",
  harvest: "🧺",
  sell: "💰",
};

const monthKey = (iso: string) => iso.slice(0, 7);
const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString("en-NG", { month: "long", year: "numeric" });

/** A calendar file the farmer can add to their phone. */
function toIcs(tasks: FarmTask[], farmName: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const day = (iso: string) => iso.replace(/-/g, "");
  const next = (iso: string) => {
    const d = new Date(`${iso}T12:00:00`);
    d.setDate(d.getDate() + 1);
    return day(d.toISOString().slice(0, 10));
  };
  const esc = (s: string) => s.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const events = tasks.map((t) =>
    ["BEGIN:VEVENT", `UID:${t.id}-${t.start}@farmpilot`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${day(t.start)}`, `DTEND;VALUE=DATE:${next(t.end)}`, `SUMMARY:${esc(`${CROP_EMOJI[t.crop]} ${t.title}`)}`, `DESCRIPTION:${esc(t.detail)}`, "END:VEVENT"].join("\r\n"),
  );
  return ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//FarmPilot//${esc(farmName)}//EN`, ...events, "END:VCALENDAR"].join("\r\n");
}

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  a.click();
}

/** Compose the Muse Image illustration with the plan's text into one shareable PNG. */
async function composePoster(image: string, farm: Farm, plan: PlanResult): Promise<string> {
  const img = new Image();
  img.src = image;
  await img.decode();
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // Cover-fit the illustration.
  const scale = Math.max(W / img.width, H / img.height);
  ctx.drawImage(img, (W - img.width * scale) / 2, (H - img.height * scale) / 2, img.width * scale, img.height * scale);
  const top = ctx.createLinearGradient(0, 0, 0, 420);
  top.addColorStop(0, "rgba(16,51,27,0.85)");
  top.addColorStop(1, "rgba(16,51,27,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 420);
  const bottom = ctx.createLinearGradient(0, H - 560, 0, H);
  bottom.addColorStop(0, "rgba(16,51,27,0)");
  bottom.addColorStop(0.35, "rgba(16,51,27,0.88)");
  bottom.addColorStop(1, "rgba(16,51,27,0.96)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H - 560, W, 560);

  const font = getComputedStyle(document.body).fontFamily;
  ctx.fillStyle = "#fff";
  ctx.font = `600 34px ${font}`;
  ctx.fillText("🌱 My season plan", 64, 96);
  ctx.font = `800 64px ${font}`;
  ctx.fillText(farm.name, 64, 176);
  ctx.font = `500 32px ${font}`;
  ctx.fillStyle = "#d6eed8";
  ctx.fillText(farm.data.place.label, 64, 226);

  let y = H - 380;
  for (const d of plan.details) {
    const a = d.allocation;
    ctx.fillStyle = "#fff";
    ctx.font = `800 44px ${font}`;
    ctx.fillText(`${CROP_EMOJI[a.crop]} ${CROPS[a.crop].name} · ${a.hectares} ha`, 64, y);
    ctx.font = `500 30px ${font}`;
    ctx.fillStyle = "#d6eed8";
    const plant = a.nurseryStart ? `Nursery ${shortDay(a.nurseryStart)} · transplant ${shortDay(a.plantFrom)}` : `Plant ${shortDay(a.plantFrom)} – ${shortDay(a.plantTo)}`;
    ctx.fillText(`${plant} · harvest from ${shortDay(d.harvestFrom)}`, 64, y + 46);
    y += 120;
  }
  ctx.font = `500 24px ${font}`;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillText("Planned with FarmPilot · Meta Muse Wonder · illustration by Muse Image", 64, H - 48);
  return canvas.toDataURL("image/png");
}

export default function SeasonCalendar({ farm, plan }: { farm: Farm; plan: PlanResult }) {
  const tasks = useMemo(() => buildCalendar(plan), [plan]);
  const months = useMemo(() => {
    const m = new Map<string, FarmTask[]>();
    for (const t of tasks) m.set(monthKey(t.start), [...(m.get(monthKey(t.start)) ?? []), t]);
    return [...m.entries()];
  }, [tasks]);
  const [poster, setPoster] = useState<string | null>(null);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);

  async function makePoster() {
    setPosterBusy(true);
    setPosterError(null);
    try {
      const res = await fetch("/api/poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crops: plan.details.map((d) => d.allocation.crop), zone: farm.data.zone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Poster failed");
      setPoster(await composePoster(data.image, farm, plan));
    } catch (err) {
      setPosterError((err as Error).message);
    } finally {
      setPosterBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="min-w-0 rounded-3xl border border-line bg-white p-5 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="h-5 w-5 text-leaf-600" /> Your season calendar
          </h2>
          <button
            onClick={() => download(`${farm.name.replace(/\W+/g, "-")}-season.ics`, `data:text/calendar;charset=utf-8,${encodeURIComponent(toIcs(tasks, farm.name))}`)}
            className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:border-leaf-500"
          >
            <Download className="h-4 w-4" /> Add to my phone calendar
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          {tasks.length} tasks from your season plan. Planting dates are estimates; the Today tab checks each task against the weather.
        </p>
        <div className="mt-5 space-y-6">
          {months.map(([key, list]) => (
            <div key={key}>
              <h3 className="sticky top-[104px] z-[1] bg-white/95 py-1 text-sm font-bold uppercase tracking-wide text-leaf-700">{monthLabel(key)}</h3>
              <ul className="mt-2 space-y-2">
                {list.map((t) => (
                  <li key={t.id} className="flex gap-3 rounded-2xl border border-line p-3">
                    <span className="text-xl">{KIND_ICON[t.kind]}</span>
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {CROP_EMOJI[t.crop]} {t.title}
                      </p>
                      <p className="text-xs font-semibold text-muted">{t.start === t.end ? shortDay(t.start) : `${shortDay(t.start)} – ${shortDay(t.end)}`}</p>
                      <p className="mt-1 text-sm text-muted">{t.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="min-w-0 self-start rounded-3xl border border-line bg-white p-5 sm:p-6 lg:sticky lg:top-28">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ImageIcon className="h-5 w-5 text-leaf-600" /> Season poster
        </h2>
        <p className="mt-1 text-sm text-muted">Muse Image paints your farm; FarmPilot adds your crops and dates. Print it or share it on WhatsApp.</p>
        {poster ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster} alt={`Season poster for ${farm.name}`} className="mt-4 w-full rounded-2xl border border-line" />
            <div className="mt-3 flex gap-2">
              <button onClick={() => download(`${farm.name.replace(/\W+/g, "-")}-poster.png`, poster)} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-leaf-600 px-3 py-2 text-sm font-semibold text-white">
                <Download className="h-4 w-4" /> Download
              </button>
              <button onClick={makePoster} disabled={posterBusy} className="rounded-xl border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50">
                {posterBusy ? "Painting…" : "New picture"}
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={makePoster}
            disabled={posterBusy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-4 py-6 font-semibold text-white disabled:opacity-60"
          >
            {posterBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Muse Image is painting your farm…
              </>
            ) : (
              <>
                <ImageIcon className="h-5 w-5" /> Create my season poster
              </>
            )}
          </button>
        )}
        {posterError && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{posterError}</p>}
      </section>
    </div>
  );
}
