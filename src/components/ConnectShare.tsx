"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, Loader2, Snowflake, Warehouse, Wrench } from "lucide-react";
import { CROPS, type CropId } from "@/data/crops";
import type { Equipment, StorageSite } from "@/data/connect-seed";
import type { Booking } from "@/lib/connect-store";
import { buildCalendar } from "@/lib/calendar";
import { shortDay } from "@/lib/plain";
import type { PlanResult } from "@/lib/plan";
import { km } from "@/lib/pooling";
import type { Farm } from "@/lib/types";


export interface ShareState {
  bookings: Booking[];
  allBookings: Pick<Booking, "resourceId" | "from" | "to" | "quantity">[];
  network: { storage: StorageSite[]; equipment: Equipment[] };
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
const plus = (iso: string, d: number) => {
  const x = new Date(`${iso}T12:00:00`);
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
const daysIn = (from: string, to: string) => Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000) + 1;
const overlaps = (a: { from: string; to: string }, b: { from: string; to: string }) => a.from <= b.to && b.from <= a.to;

const KIND_ICON: Record<Equipment["kind"], string> = { "irrigation pump": "💧", tractor: "🚜", thresher: "🌾", sprayer: "💨" };

function useReserve(farm: Farm, refresh: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function reserve(kind: Booking["kind"], resourceId: string, quantity: number, from: string, to: string, label: string) {
    setBusy(resourceId);
    setMessage(null);
    try {
      const r = await fetch("/api/connect/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, resourceId, farmerId: farm.id, farmer: farm.name, quantity, from, to }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage({ ok: true, text: `Booked ${label} for ${naira(d.cost)}. The owner will confirm by phone.` });
      await refresh();
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(null);
    }
  }
  return { busy, message, reserve };
}

export function ConnectStorage({ farm, state, refresh }: { farm: Farm; state: ShareState; refresh: () => Promise<void> }) {
  const planCrop = (farm.plan as PlanResult | undefined)?.details?.[0]?.allocation.crop;
  const [crop, setCrop] = useState<CropId>(planCrop ?? "tomato");
  const [qty, setQty] = useState("50");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(plus(todayIso(), 13));
  const { busy, message, reserve } = useReserve(farm, refresh);

  const sites = state.network.storage
    .filter((s) => s.crops.includes(crop))
    .map((s) => {
      const used = state.allBookings.filter((b) => b.resourceId === s.id && overlaps(b, { from, to })).reduce((t, b) => t + b.quantity, 0);
      return { s, free: s.capacity - used, dist: Math.round(km([farm.lat, farm.lon], [s.lat, s.lon])) };
    })
    .sort((a, b) => a.dist - b.dist);
  const n = Number(qty) || 0;
  const nights = to >= from ? daysIn(from, to) : 0;
  const mine = state.bookings.filter((b) => b.kind === "storage" && b.status === "booked");

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Warehouse className="h-5 w-5 text-leaf-600" /> Shared storage near you
        </h2>
        <p className="text-sm text-muted">
          When the market is full and prices are low, store instead of selling cheap. Pay only for the space and days you use.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="text-sm">
            Crop
            <select value={crop} onChange={(e) => setCrop(e.target.value as CropId)} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
              {(["tomato", "maize", "sorghum", "soybean", "rice"] as CropId[]).map((c) => (
                <option key={c} value={c}>
                  {CROPS[c].name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            How many {crop === "tomato" ? "crates" : "bags"}
            <input value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
          </label>
          <label className="text-sm">
            From
            <input type="date" min={todayIso()} value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
          </label>
          <label className="text-sm">
            To
            <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
          </label>
        </div>

        <ul className="mt-4 space-y-3">
          {sites.map(({ s, free, dist }) => {
            const keeps = s.keepsDays[crop];
            const cost = n * nights * s.pricePerUnitDay;
            return (
              <li key={s.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {s.kind === "cold room" ? <Snowflake className="mr-1 inline h-4 w-4 text-sky-500" /> : <Warehouse className="mr-1 inline h-4 w-4 text-soil-500" />}
                      {s.name}
                    </p>
                    <p className="text-sm text-muted">
                      {dist} km away · {s.kind}
                      {s.tempC ? ` at ${s.tempC}` : ""} · {naira(s.pricePerUnitDay)} per {s.unit} per day
                    </p>
                    {keeps && (
                      <p className="mt-1 text-sm">
                        Keeps {CROPS[crop].name.toLowerCase()} about <b>{keeps.stored} days</b> instead of {keeps.open} days in the open.
                      </p>
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${free >= n ? "bg-leaf-100 text-leaf-700" : "bg-red-100 text-red-700"}`}>
                    {free} {s.unit}s free
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-sm">
                    {n} {s.unit}s × {nights} days = <b>{naira(cost)}</b>
                  </p>
                  <button
                    onClick={() => reserve("storage", s.id, n, from, to, `${n} ${s.unit}s at ${s.name}`)}
                    disabled={!n || !nights || free < n || !!busy}
                    className="flex items-center gap-1 rounded-xl bg-leaf-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Reserve space
                  </button>
                </div>
              </li>
            );
          })}
          {!sites.length && <li className="text-sm text-muted">No shared storage for {CROPS[crop].name.toLowerCase()} nearby yet.</li>}
        </ul>
        {message && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-leaf-50" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
      </section>
      <MyBookings bookings={mine} names={new Map(state.network.storage.map((s) => [s.id, s.name]))} farm={farm} refresh={refresh} />
    </div>
  );
}

export function ConnectEquipment({ farm, state, refresh }: { farm: Farm; state: ShareState; refresh: () => Promise<void> }) {
  const [kind, setKind] = useState<Equipment["kind"] | "all">("all");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [amount, setAmount] = useState<Record<string, string>>({});
  const { busy, message, reserve } = useReserve(farm, refresh);
  const plan = farm.plan as PlanResult | undefined;

  // Suggest equipment from the season calendar: ploughing → tractor, irrigation → pump, harvest → thresher.
  const suggestions = useMemo(() => {
    if (!plan?.details) return [];
    const tasks = buildCalendar(plan);
    const pick = (match: (t: (typeof tasks)[number]) => boolean, k: Equipment["kind"], why: string) => {
      const t = tasks.find((x) => match(x) && x.end >= todayIso());
      return t ? [{ kind: k, from: t.start, to: t.end, why: `${why} (${shortDay(t.start)} – ${shortDay(t.end)})` }] : [];
    };
    return [
      ...pick((t) => t.id.endsWith(":plough") || t.id.endsWith(":beds"), "tractor", "Your ploughing is due"),
      ...pick((t) => t.kind === "water", "irrigation pump", "Your irrigation starts"),
      ...pick((t) => t.kind === "harvest" && t.crop !== "tomato" && t.crop !== "cassava", "thresher", "Your harvest is due"),
    ];
  }, [plan]);

  const items = state.network.equipment
    .filter((e) => kind === "all" || e.kind === kind)
    .map((e) => ({ e, dist: Math.round(km([farm.lat, farm.lon], [e.lat, e.lon])), booked: state.allBookings.filter((b) => b.resourceId === e.id && b.to >= todayIso()) }))
    .sort((a, b) => a.dist - b.dist);
  const mine = state.bookings.filter((b) => b.kind === "equipment" && b.status === "booked");

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Wrench className="h-5 w-5 text-leaf-600" /> Share equipment
        </h2>
        <p className="text-sm text-muted">Rent a pump, tractor or thresher from a neighbour by the hour, hectare or day, instead of buying one.</p>

        {suggestions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.kind}
                onClick={() => {
                  setKind(s.kind);
                  setFrom(s.from);
                  setTo(s.from);
                }}
                className="rounded-2xl border border-leaf-500/50 bg-leaf-50 px-3 py-2 text-left text-sm"
              >
                <span className="mr-1">{KIND_ICON[s.kind]}</span>
                {s.why}: <b>find a {s.kind}</b>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as Equipment["kind"] | "all")} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
              <option value="all">All equipment</option>
              {(["irrigation pump", "tractor", "thresher", "sprayer"] as const).map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            From
            <input type="date" min={todayIso()} value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
          </label>
          <label className="text-sm">
            To
            <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
          </label>
        </div>

        <ul className="mt-4 space-y-3">
          {items.map(({ e, dist, booked }) => {
            const clash = booked.some((b) => overlaps(b, { from, to }));
            const q = Number(amount[e.id] ?? (e.per === "hectare" ? farm.hectares.toFixed(1) : e.per === "day" ? daysIn(from, to) : 8)) || 0;
            return (
              <li key={e.id} className="rounded-2xl border border-line p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">
                      {KIND_ICON[e.kind]} {e.name}
                    </p>
                    <p className="text-sm text-muted">
                      {e.owner} · {dist} km away · {naira(e.rate)} per {e.per} · {e.note}
                    </p>
                    {booked.length > 0 && <p className="mt-1 text-xs text-muted">Booked: {booked.map((b) => `${shortDay(b.from)}${b.to !== b.from ? `–${shortDay(b.to)}` : ""}`).join(", ")}</p>}
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${clash ? "bg-red-100 text-red-700" : "bg-leaf-100 text-leaf-700"}`}>{clash ? "Taken those days" : "Free those days"}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <input
                    value={amount[e.id] ?? String(q)}
                    onChange={(ev) => setAmount({ ...amount, [e.id]: ev.target.value.replace(/[^\d.]/g, "") })}
                    inputMode="decimal"
                    className="w-20 rounded-xl border border-line px-3 py-2"
                  />
                  <span>
                    {e.per}s × {naira(e.rate)} = <b>{naira(q * e.rate)}</b>
                  </span>
                  <button
                    onClick={() => reserve("equipment", e.id, q, from, to, e.name)}
                    disabled={!q || clash || !!busy || to < from}
                    className="flex items-center gap-1 rounded-xl bg-leaf-600 px-3 py-2 font-semibold text-white disabled:opacity-40"
                  >
                    {busy === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Book
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        {message && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${message.ok ? "bg-leaf-50" : "bg-red-50 text-red-700"}`}>{message.text}</p>}
      </section>
      <MyBookings bookings={mine} names={new Map(state.network.equipment.map((e) => [e.id, e.name]))} farm={farm} refresh={refresh} />
    </div>
  );
}

function MyBookings({ bookings, names, farm, refresh }: { bookings: Booking[]; names: Map<string, string>; farm: Farm; refresh: () => Promise<void> }) {
  if (!bookings.length) return null;
  return (
    <section className="rounded-3xl border border-line bg-white p-5">
      <h2 className="font-bold">My bookings</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {bookings.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas p-3">
            <span>
              <b>{names.get(b.resourceId)}</b> · {shortDay(b.from)}
              {b.to !== b.from && ` – ${shortDay(b.to)}`} · {naira(b.cost)}
            </span>
            <button
              onClick={async () => {
                await fetch("/api/connect/reserve", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: b.id, farmerId: farm.id }) });
                await refresh();
              }}
              className="text-xs font-semibold text-muted hover:text-red-700"
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

