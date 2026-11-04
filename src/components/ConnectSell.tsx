"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Camera, Check, Loader2, Mic, Square, Truck, Users, Wand2 } from "lucide-react";
import { CROP_IDS, CROPS, type CropId } from "@/data/crops";
import type { Market, Unit } from "@/data/connect-seed";
import type { Grade, Listing, Trip } from "@/lib/connect-store";
import type { Deal } from "@/lib/pooling";
import { shortDay } from "@/lib/plain";
import type { Farm } from "@/lib/types";
import { useVoice } from "@/lib/useVoice";
import type { MapPoint } from "./RouteMap";
import { CROP_EMOJI } from "./SeasonPlan";

const RouteMap = dynamic(() => import("./RouteMap"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-canvas" /> });

export interface ConnectState {
  listings: Listing[];
  trips: Trip[];
  network: { markets: Market[]; vehicles: Deal["vehicle"][] };
}

const naira = (n: number) => `${n < 0 ? "−" : ""}₦${Math.abs(Math.round(n)).toLocaleString("en-NG")}`;
const UNITS: Unit[] = ["crate", "basket", "bag", "tonne"];
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });

const STEPS: Trip["status"][] = ["booked", "picked_up", "delivered", "paid"];
const STEP_LABEL: Record<Trip["status"], string> = { booked: "Truck booked", picked_up: "Picked up", delivered: "Delivered", paid: "You're paid" };

type GradeResult = Grade & { boxes?: { left: number; top: number; right: number; bottom: number; ripe: boolean }[]; size?: { width: number; height: number } };

function GradePhoto({ photo, grade }: { photo: string; grade: GradeResult }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="Your produce" className="block w-full" />
      {grade.size && (
        <svg viewBox={`0 0 ${grade.size.width} ${grade.size.height}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
          {grade.boxes?.map((b, i) => (
            <rect key={i} x={b.left} y={b.top} width={b.right - b.left} height={b.bottom - b.top} fill="none" stroke={b.ripe ? "#22c55e" : "#facc15"} strokeWidth={3} />
          ))}
        </svg>
      )}
    </div>
  );
}

export default function ConnectSell({ farm, state, refresh }: { farm: Farm; state: ConnectState; refresh: () => Promise<void> }) {
  const planCrop = (farm.plan as { details?: { allocation: { crop: CropId } }[] } | undefined)?.details?.[0]?.allocation.crop;
  const [text, setText] = useState("");
  const [crop, setCrop] = useState<CropId>(planCrop ?? "tomato");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<Unit>("crate");
  const [readyFrom, setReadyFrom] = useState(todayIso());
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [deals, setDeals] = useState<{ deals: Deal[]; summary: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mine = state.listings.filter((l) => l.farmerId === farm.id);
  const nearby = state.listings.filter((l) => l.farmerId !== farm.id && l.status === "open");
  const markets = new Map(state.network.markets.map((m) => [m.id, m]));
  const vehicles = new Map(state.network.vehicles.map((v) => [v.id, v]));

  async function parse(sentence: string) {
    setBusy("parse");
    setError(null);
    setNote(null);
    try {
      const r = await fetch("/api/connect/parse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: sentence }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      if (d.crop) setCrop(d.crop);
      if (d.quantity > 0) setQuantity(String(d.quantity));
      if (d.unit) setUnit(d.unit);
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.readyFrom)) setReadyFrom(d.readyFrom < todayIso() ? todayIso() : d.readyFrom);
      setNote(d.understood ? "Filled in from what you said. Check and correct anything below." : d.question);
    } catch (err) {
      setError((err as Error).message || "Couldn't understand that");
    } finally {
      setBusy(null);
    }
  }

  const voice = useVoice(
    (t) => {
      setText(t);
      parse(t);
    },
    setError,
  );

  async function gradePhoto(file: File) {
    setBusy("grade");
    setError(null);
    setPhoto(URL.createObjectURL(file));
    setGrade(null);
    try {
      const r = await fetch("/api/connect/grade", { method: "POST", body: file });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setGrade(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function loadDeals(listingId: string) {
    setActive(listingId);
    setDeals(null);
    setBusy("deals");
    setError(null);
    try {
      const r = await fetch("/api/connect/deals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, state: farm.data.place.state }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDeals(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function list() {
    setBusy("list");
    setError(null);
    try {
      const gradeSummary: Grade | null = grade ? { grade: grade.grade, count: grade.count, ripePct: grade.ripePct, uniformity: grade.uniformity, note: grade.note } : null;
      const r = await fetch("/api/connect/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmerId: farm.id, farmer: farm.name, crop, quantity: Number(quantity), unit, lat: farm.lat, lon: farm.lon, place: farm.data.place.label, readyFrom, grade: gradeSummary }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await refresh();
      setText("");
      setNote(null);
      setPhoto(null);
      setGrade(null);
      setQuantity("");
      await loadDeals(d.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy((b) => (b === "list" ? null : b));
    }
  }

  async function book(listingId: string, deal: Deal) {
    setBusy(`book:${deal.key}`);
    setError(null);
    try {
      const r = await fetch("/api/connect/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId, dealKey: deal.key, state: farm.data.place.state }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDeals(null);
      setActive(null);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function advance(tripId: string) {
    setBusy(`adv:${tripId}`);
    await fetch("/api/connect/advance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId }) });
    await refresh();
    setBusy(null);
  }

  const activeListing = mine.find((l) => l.id === active);
  const best = deals?.deals[0];
  const soloFor = (d: Deal) => deals?.deals.find((x) => x.marketId === d.marketId && x.mode === "solo");
  const bestPoints: MapPoint[] = best
    ? [
        ...best.stops.map((s) => ({ lat: s.lat, lon: s.lon, label: s.listingId === active ? "You" : s.farmer, kind: (s.listingId === active ? "you" : "farmer") as MapPoint["kind"] })),
        { lat: best.route.at(-1)![0], lon: best.route.at(-1)![1], label: best.marketName, kind: "market" },
        { lat: best.vehicle.baseLat, lon: best.vehicle.baseLon, label: `${best.vehicle.kind} base`, kind: "truck" },
      ]
    : [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="min-w-0 space-y-4 lg:col-span-2">
        {/* 1. List produce */}
        <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
          <h2 className="text-lg font-bold">What do you want to sell?</h2>
          <p className="text-sm text-muted">Say it or type it, like &quot;I have 100 crates of tomatoes ready on Friday&quot;.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) parse(text);
            }}
            className="mt-3 flex gap-2"
          >
            <button
              type="button"
              onClick={voice.recording ? voice.stop : voice.start}
              disabled={voice.transcribing || busy === "parse"}
              title={voice.recording ? "Stop" : "Say it"}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white disabled:opacity-50 ${voice.recording ? "animate-pulse bg-red-500" : "bg-sky-500"}`}
            >
              {voice.transcribing ? <Loader2 className="h-5 w-5 animate-spin" /> : voice.recording ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={voice.recording ? "Listening… tap red to finish" : "I have 100 crates of tomatoes ready on Friday"}
              className="min-w-0 flex-1 rounded-2xl border border-line px-4 py-3 outline-none focus:border-leaf-500"
            />
            <button type="submit" disabled={!text.trim() || busy === "parse"} className="flex items-center gap-1 rounded-2xl bg-leaf-600 px-4 font-semibold text-white disabled:opacity-40">
              {busy === "parse" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />} Fill in
            </button>
          </form>
          {note && <p className="mt-2 rounded-xl bg-leaf-50 px-3 py-2 text-sm">{note}</p>}

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="text-sm">
              Crop
              <select value={crop} onChange={(e) => setCrop(e.target.value as CropId)} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
                {CROP_IDS.map((c) => (
                  <option key={c} value={c}>
                    {CROPS[c].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              How many
              <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
            </label>
            <label className="text-sm">
              Unit
              <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)} className="mt-1 w-full rounded-xl border border-line px-3 py-2">
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}s
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Ready from
              <input type="date" min={todayIso()} value={readyFrom} onChange={(e) => setReadyFrom(e.target.value)} className="mt-1 w-full rounded-xl border border-line px-3 py-2" />
            </label>
          </div>

          {crop === "tomato" && (
            <div className="mt-4 rounded-2xl bg-canvas p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  <b>Grade your tomatoes with a photo</b> (Meta SAM 3.1). Graded produce gets better offers.
                </p>
                <button onClick={() => fileRef.current?.click()} disabled={busy === "grade"} className="flex items-center gap-1 rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50">
                  {busy === "grade" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {photo ? "Another photo" : "Take or upload photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && gradePhoto(e.target.files[0])} />
              </div>
              {photo && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {grade ? <GradePhoto photo={photo} grade={grade} /> : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="Your produce" className="w-full rounded-2xl border border-line opacity-60" />
                  )}
                  {grade ? (
                    <div>
                      <p className="text-4xl font-bold text-leaf-700">Grade {grade.grade}</p>
                      <ul className="mt-2 space-y-1 text-sm">
                        <li>
                          <b>{grade.count}</b> tomatoes counted
                        </li>
                        <li>
                          <b>{grade.ripePct}%</b> ripe <span className="text-muted">(green boxes; yellow = not ripe)</span>
                        </li>
                        <li>
                          <b>{grade.uniformity}%</b> even in size
                        </li>
                      </ul>
                      <p className="mt-2 text-sm">{grade.note}</p>
                    </div>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" /> SAM 3.1 is counting and checking each tomato…
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={list}
            disabled={!(Number(quantity) > 0) || busy === "list"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {busy === "list" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Truck className="h-5 w-5" />} Find me the best market and a truck
          </button>
        </section>

        {/* 2. Deals */}
        {(busy === "deals" || deals) && activeListing && (
          <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold">
              Best ways to sell your {activeListing.quantity} {activeListing.unit}s of {CROPS[activeListing.crop].name.toLowerCase()}
            </h2>
            {busy === "deals" ? (
              <p className="mt-3 flex items-center gap-2 text-muted">
                <Loader2 className="h-5 w-5 animate-spin" /> Checking markets, trucks and farmers near you…
              </p>
            ) : deals && deals.deals.length ? (
              <>
                {deals.summary && (
                  <p className="mt-3 rounded-2xl bg-leaf-900 p-4 text-[15px] text-white">
                    <span className="mb-1 block text-xs font-semibold text-leaf-100">Muse Spark</span>
                    {deals.summary}
                  </p>
                )}
                {best && (
                  <div className="mt-4 h-64 overflow-hidden rounded-2xl border border-line">
                    <RouteMap points={bestPoints} route={best.route} />
                  </div>
                )}
                <ul className="mt-4 space-y-3">
                  {deals.deals.slice(0, 5).map((d, i) => {
                    const solo = soloFor(d);
                    const others = d.stops.filter((s) => s.listingId !== active);
                    return (
                      <li key={d.key} className={`rounded-2xl border p-4 ${i === 0 ? "border-leaf-500 bg-leaf-50/60" : "border-line"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-bold">
                              {i === 0 && <span className="mr-2 rounded-full bg-leaf-600 px-2 py-0.5 text-xs text-white">Best</span>}
                              {d.marketName}
                            </p>
                            <p className="text-sm text-muted">
                              {d.mode === "shared" ? (
                                <>
                                  <Users className="mr-1 inline h-4 w-4" />
                                  Shared {d.vehicle.kind} with {others.map((s) => s.farmer).join(", ")}
                                </>
                              ) : (
                                <>
                                  <Truck className="mr-1 inline h-4 w-4" />
                                  {d.vehicle.kind}, just your produce
                                </>
                              )}{" "}
                              · {d.tripKm} km trip · {d.marketNote}
                            </p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-xs text-muted">You keep</p>
                            <p className="text-xl font-bold text-leaf-700">{naira(d.net)}</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                          <span>
                            Sales <b>{naira(d.revenue)}</b>
                            <span className="block text-xs text-muted">{naira(d.pricePerUnit)} per {activeListing.unit}</span>
                          </span>
                          <span>
                            Your transport <b>{naira(d.yourShare)}</b>
                            {d.mode === "shared" && solo && <span className="block text-xs text-leaf-700">alone: {naira(solo.yourShare)}</span>}
                          </span>
                          <span>
                            Lost on the road <b>{Math.round(d.lossPct * 100)}%</b>
                          </span>
                          <span>
                            vs best alone <b className={d.vsBestSolo >= 0 ? "text-leaf-700" : "text-red-700"}>{d.vsBestSolo >= 0 ? "+" : ""}{naira(d.vsBestSolo)}</b>
                          </span>
                        </div>
                        <button
                          onClick={() => book(activeListing.id, d)}
                          disabled={!!busy}
                          className="mt-3 flex items-center gap-2 rounded-xl bg-leaf-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                        >
                          {busy === `book:${d.key}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Book · pay transport from the sale
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-xs text-muted">
                  Shared costs are split by each farmer&apos;s load × distance. Market prices are estimates from today&apos;s {farm.data.place.state} price and each market&apos;s
                  size. Transporters and neighbouring farmers marked (demo) are sample listings.
                </p>
              </>
            ) : (
              <p className="mt-3 text-muted">No market prices for this crop yet.</p>
            )}
          </section>
        )}

        {/* 3. Shipments */}
        {state.trips.length > 0 && (
          <section className="rounded-3xl border border-line bg-white p-5 sm:p-6">
            <h2 className="text-lg font-bold">My shipments</h2>
            <ul className="mt-3 space-y-3">
              {state.trips.map((t) => {
                const mineOnTrip = t.listingIds.find((id) => mine.some((l) => l.id === id))!;
                const listing = mine.find((l) => l.id === mineOnTrip);
                const share = t.shares[mineOnTrip] ?? 0;
                const sale = t.revenue[mineOnTrip] ?? 0;
                const step = STEPS.indexOf(t.status);
                return (
                  <li key={t.id} className="rounded-2xl border border-line p-4">
                    <p className="font-bold">
                      {listing && `${CROP_EMOJI[listing.crop]} ${listing.quantity} ${listing.unit}s → `}
                      {markets.get(t.marketId)?.name}
                    </p>
                    <p className="text-sm text-muted">
                      {vehicles.get(t.vehicleId)?.kind} by {vehicles.get(t.vehicleId)?.owner} · pickup {shortDay(t.date)} · {t.listingIds.length} farmer{t.listingIds.length > 1 ? "s" : ""} on the truck
                    </p>
                    <ol className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
                      {STEPS.map((s, i) => (
                        <li key={s} className={`rounded-lg px-1 py-2 ${i <= step ? "bg-leaf-600 font-semibold text-white" : "bg-canvas text-muted"}`}>
                          {STEP_LABEL[s]}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 rounded-xl bg-canvas p-3 text-sm">
                      <p className="font-semibold">Pay from the sale: no money needed up front</p>
                      <p>
                        Buyer pays <b>{naira(sale)}</b> → transport <b>−{naira(share)}</b> goes to the driver → you receive <b className="text-leaf-700">{naira(sale - share)}</b>
                      </p>
                    </div>
                    {t.status !== "paid" && (
                      <button onClick={() => advance(t.id)} disabled={!!busy} className="mt-2 text-xs font-semibold text-muted underline-offset-2 hover:underline disabled:opacity-40">
                        {busy === `adv:${t.id}` ? "Updating…" : "Demo: move to the next step"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* Side: my produce + nearby */}
      <div className="min-w-0 space-y-4">
        <section className="rounded-3xl border border-line bg-white p-5">
          <h2 className="font-bold">My produce</h2>
          {mine.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {mine.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas p-3">
                  <span>
                    {CROP_EMOJI[l.crop]} <b>{l.quantity} {l.unit}s</b> {CROPS[l.crop].name.toLowerCase()}
                    {l.grade && <span className="ml-1 rounded bg-leaf-100 px-1.5 text-xs font-semibold text-leaf-700">Grade {l.grade.grade}</span>}
                    <span className="block text-xs text-muted">ready {shortDay(l.readyFrom)} · {l.status}</span>
                  </span>
                  {l.status === "open" && (
                    <button onClick={() => loadDeals(l.id)} className="shrink-0 rounded-lg bg-leaf-600 px-2.5 py-1 text-xs font-semibold text-white">
                      Deals
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">Nothing listed yet.</p>
          )}
        </section>
        <section className="rounded-3xl border border-line bg-white p-5">
          <h2 className="font-bold">Ready near you</h2>
          <p className="text-xs text-muted">Farmers who could share a truck with you.</p>
          <ul className="mt-3 space-y-2 text-sm">
            {nearby.map((l) => (
              <li key={l.id} className="rounded-xl bg-canvas p-3">
                {CROP_EMOJI[l.crop]} <b>{l.farmer}</b>: {l.quantity} {l.unit}s {CROPS[l.crop].name.toLowerCase()}
                {l.grade && <span className="ml-1 text-xs text-leaf-700">· Grade {l.grade.grade}</span>}
                <span className="block text-xs text-muted">ready {shortDay(l.readyFrom)}</span>
              </li>
            ))}
            {!nearby.length && <li className="text-muted">No one else has listed produce yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
