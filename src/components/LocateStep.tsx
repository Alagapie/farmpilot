"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Footprints, Loader2, LocateFixed, Map as MapIcon, Search, Undo2, X } from "lucide-react";
import type { FlyTarget, UserPos } from "./FieldMap";
import type { Field, FieldResult } from "@/lib/sam";
import { centroid, insidePolygon, polygonHectares, toAcres, type LatLon } from "@/lib/geo";

const FieldMap = dynamic(() => import("./FieldMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-leaf-900/80" />,
});

const DEMO: UserPos = { lat: 11.175, lon: 7.59, accuracy: 8 };
const MIN_SCAN_ZOOM = 15;
const GOOD_GPS_M = 25;

export interface LocatedFarm {
  lat: number;
  lon: number;
  hectares: number;
  source: "sam" | "walk" | "manual";
  polygon: LatLon[];
}

type Panel = "intro" | "browse" | "confirm" | "walk";

export default function LocateStep({ onConfirm }: { onConfirm: (farm: LocatedFarm) => void }) {
  const [panel, setPanel] = useState<Panel>("intro");
  const [fields, setFields] = useState<Field[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [userPos, setUserPos] = useState<UserPos | null>(null);
  const [lastPoint, setLastPoint] = useState<LatLon | null>(null);
  const [locating, setLocating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lon: number }[]>([]);
  const [manualHa, setManualHa] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [walkPoints, setWalkPoints] = useState<LatLon[]>([]);
  const watchId = useRef<number | null>(null);

  const picked = useMemo(() => fields.filter((f) => selected.has(f.id)), [fields, selected]);
  const samHa = picked.reduce((s, f) => s + f.hectares, 0);
  const walkHa = polygonHectares(walkPoints);

  const fly = (lat: number, lon: number, zoom = 18) => setFlyTo({ lat, lon, zoom, key: Date.now() });

  // Live GPS while walking the farm boundary.
  useEffect(() => {
    if (panel !== "walk" || !navigator.geolocation) return;
    watchId.current = navigator.geolocation.watchPosition(
      (p) => setUserPos({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => setMsg("GPS isn't available. You can tap the corners of your farm on the map instead."),
      { enableHighAccuracy: true, maximumAge: 0 },
    );
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [panel]);

  async function scan(lat: number, lon: number) {
    if (scanning) return;
    setScanning(true);
    setLastPoint([lat, lon]);
    setMsg(null);
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
      if (fresh.some((f) => f.id === data.pickedId)) {
        setSelected(new Set([...selected, data.pickedId]));
        setPanel("confirm");
        if (!data.clickedInside) setMsg("You seem to be just outside a field, so we chose the closest one. Is the green field yours?");
      } else {
        setPanel("browse");
      }
    } catch (err) {
      setMsg(`${(err as Error).message} You can also walk around your farm or enter its size.`);
      setPanel("browse");
    } finally {
      setScanning(false);
    }
  }

  function arriveAt(pos: UserPos, note: string | null) {
    setUserPos(pos);
    fly(pos.lat, pos.lon, 18);
    setMsg(note);
    // Give the map a moment to fly before the scan overlay appears.
    setTimeout(() => scan(pos.lat, pos.lon), 600);
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setMsg("This device can't share its location. Find your farm on the map instead.");
      setPanel("browse");
      return;
    }
    setPanel("browse");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        arriveAt({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy: p.coords.accuracy }, null);
      },
      () => {
        setLocating(false);
        setMsg("We couldn't get your location. Turn on Location (GPS), allow FarmPilot, and try again — or search for your village.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  function startDemo() {
    setPanel("browse");
    arriveAt(DEMO, "Demo: pretending you're standing on a farm near Zaria, Kaduna.");
  }

  function onMapClick(lat: number, lon: number, zoom: number) {
    if (panel === "intro") return;
    if (panel === "walk") {
      setWalkPoints((pts) => [...pts, [lat, lon]]);
      return;
    }
    if (zoom < MIN_SCAN_ZOOM) {
      setMsg("Zoom in closer to your farm first.");
      fly(lat, lon, Math.min(zoom + 3, 17));
      return;
    }
    scan(lat, lon);
  }

  function onFieldClick(id: string, lat: number, lon: number) {
    if (panel === "walk") {
      setWalkPoints((pts) => [...pts, [lat, lon]]);
      return;
    }
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    setPanel(next.size ? "confirm" : "browse");
    setMsg(null);
  }

  function rejectPick() {
    setSelected(new Set());
    setPanel("browse");
    setMsg("Tap your field on the map. Yellow outlines are fields we found. Tap one to choose it, or tap anywhere else to look there.");
  }

  function startWalk() {
    setWalkPoints([]);
    setSelected(new Set());
    setMsg(null);
    setPanel("walk");
  }

  function markCorner() {
    if (!userPos) return;
    setWalkPoints((pts) => [...pts, [userPos.lat, userPos.lon]]);
  }

  function confirmSam() {
    const [lat, lon] = centroid(picked[0].polygon);
    onConfirm({ lat, lon, hectares: samHa, source: "sam", polygon: picked[0].polygon });
  }

  function confirmWalk() {
    const [lat, lon] = centroid(walkPoints);
    onConfirm({ lat, lon, hectares: walkHa, source: "walk", polygon: walkPoints });
  }

  function confirmManual() {
    const at = lastPoint ?? (userPos ? ([userPos.lat, userPos.lon] as LatLon) : null);
    if (!at) return;
    onConfirm({ lat: at[0], lon: at[1], hectares: Number(manualHa), source: "manual", polygon: [] });
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    const rows = await (await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)).json();
    setResults(rows);
    if (rows[0]) fly(rows[0].lat, rows[0].lon, 15);
    if (!rows.length) setMsg("We couldn't find that place. Try the name of a nearby town.");
    setPanel("browse");
  }

  const gpsWeak = userPos != null && userPos.accuracy > GOOD_GPS_M;
  const manualAnchor = lastPoint ?? userPos;

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <FieldMap
        fields={fields}
        selected={selected}
        userPos={userPos}
        walkPoints={walkPoints}
        flyTo={flyTo}
        onMapClick={onMapClick}
        onFieldClick={onFieldClick}
      />

      {panel === "intro" && (
        <div className="absolute inset-0 z-[1100] flex items-center justify-center bg-leaf-900/55 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-leaf-600 text-2xl">🌱</span>
            <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">Your AI farming co-pilot</h1>
            <p className="mt-3 text-muted">
              FarmPilot measures your land, plans your season, warns you before the weather hurts your crops, and tells you the
              best time to sell.
            </p>
            <div className="mt-7 space-y-2">
              <button
                onClick={locateMe}
                className="flex w-full items-center gap-3 rounded-2xl bg-leaf-600 px-5 py-4 text-left text-white hover:bg-leaf-700"
              >
                <LocateFixed className="h-6 w-6 shrink-0" />
                <span>
                  <span className="block font-semibold">I&apos;m on my farm now</span>
                  <span className="block text-sm text-leaf-100">Use my location. We&apos;ll find your field automatically.</span>
                </span>
              </button>
              <button
                onClick={() => setPanel("browse")}
                className="flex w-full items-center gap-3 rounded-2xl border border-line px-5 py-4 text-left hover:border-leaf-500"
              >
                <MapIcon className="h-6 w-6 shrink-0 text-leaf-600" />
                <span>
                  <span className="block font-semibold">Find my farm on the map</span>
                  <span className="block text-sm text-muted">Search your village and tap your field</span>
                </span>
              </button>
              <button onClick={startDemo} className="w-full rounded-2xl px-5 py-3 text-sm font-semibold text-leaf-700 hover:bg-leaf-50">
                No farm nearby? Try a demo farm →
              </button>
            </div>
            <p className="mt-4 text-center text-xs text-muted">Powered by Meta Muse Spark, Muse Wonder, Muse Image &amp; SAM 3.1</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      {panel !== "intro" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] p-3 sm:p-4">
          <div className="pointer-events-auto mx-auto flex max-w-3xl items-center gap-2 rounded-2xl bg-white/95 p-2 shadow-lg backdrop-blur sm:p-3">
            <span className="hidden items-center gap-2 px-1 font-bold text-leaf-700 sm:flex">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-leaf-600 text-white">🌱</span>
              FarmPilot
            </span>
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
                          fly(r.lat, r.lon, 15);
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
            <button
              onClick={locateMe}
              title="Use my location"
              className="flex items-center gap-1 rounded-xl bg-leaf-600 px-3 py-2 text-sm font-semibold text-white hover:bg-leaf-700"
            >
              <LocateFixed className="h-4 w-4" /> <span className="hidden sm:inline">My location</span>
            </button>
          </div>
        </div>
      )}

      {(scanning || locating) && (
        <div className="pointer-events-none absolute inset-0 z-[999] overflow-hidden">
          {scanning && <div className="scan-line h-1/3 w-full bg-gradient-to-b from-transparent via-leaf-500/25 to-transparent" />}
          <div className="absolute left-1/2 top-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-leaf-900/90 px-4 py-2 text-sm text-white shadow-lg sm:top-24">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            {locating ? "Getting your location…" : "SAM 3.1 is finding your field…"}
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      {panel !== "intro" && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] p-3 sm:p-4">
          <div className="mx-auto max-w-3xl rounded-2xl bg-white/95 p-4 shadow-lg backdrop-blur sm:p-5">
            {msg && <p className="mb-3 rounded-xl bg-sun-100 px-3 py-2 text-sm">{msg}</p>}

            {panel === "confirm" && picked.length > 0 && (
              <>
                <p className="text-lg font-bold">Is the green field your farm?</p>
                <p className="text-3xl font-bold text-leaf-700">
                  {samHa.toFixed(2)} ha{" "}
                  <span className="text-base font-medium text-muted">
                    ≈ {toAcres(samHa).toFixed(1)} acres{picked.length > 1 ? ` · ${picked.length} plots` : ""}
                  </span>
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={confirmSam}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-leaf-600 px-5 py-3 font-semibold text-white hover:bg-leaf-700"
                  >
                    <Check className="h-5 w-5" /> Yes, this is my farm
                  </button>
                  <button
                    onClick={rejectPick}
                    className="flex items-center justify-center gap-2 rounded-2xl border border-line px-5 py-3 font-semibold hover:border-leaf-500"
                  >
                    <X className="h-5 w-5" /> No, choose another
                  </button>
                </div>
                <p className="mt-3 text-sm text-muted">
                  Have more than one plot? Tap the yellow fields to add them.{" "}
                  <button onClick={startWalk} className="font-semibold text-leaf-700 underline-offset-2 hover:underline">
                    Or walk around your farm to measure it
                  </button>
                </p>
              </>
            )}

            {panel === "browse" && !scanning && !locating && (
              <>
                <p className="font-semibold">Tap the middle of your field</p>
                <p className="text-sm text-muted">
                  Meta&apos;s SAM 3.1 will outline the fields around that spot. Search your village above, or use your location.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={startWalk}
                    className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:border-leaf-500"
                  >
                    <Footprints className="h-4 w-4 text-leaf-600" /> Walk around my farm
                  </button>
                  <button
                    onClick={() => setShowManual((v) => !v)}
                    className="rounded-xl border border-line px-3 py-2 text-sm font-semibold hover:border-leaf-500"
                  >
                    I know my farm size
                  </button>
                  <button onClick={startDemo} className="rounded-xl px-3 py-2 text-sm font-semibold text-leaf-700 hover:bg-leaf-50">
                    Try demo farm
                  </button>
                </div>
                {showManual && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={manualHa}
                      onChange={(e) => setManualHa(e.target.value)}
                      placeholder="e.g. 1.5"
                      className="w-24 rounded-lg border border-line px-3 py-2 outline-none focus:border-leaf-500"
                    />
                    <span className="text-muted">hectares {Number(manualHa) > 0 && `(≈ ${toAcres(Number(manualHa)).toFixed(1)} acres)`}</span>
                    <button
                      onClick={confirmManual}
                      disabled={!(Number(manualHa) > 0) || !manualAnchor}
                      className="rounded-lg bg-leaf-600 px-4 py-2 font-semibold text-white disabled:opacity-40"
                    >
                      Continue
                    </button>
                    {!manualAnchor && <span className="w-full text-xs text-muted">First tap your farm&apos;s location on the map or use your location.</span>}
                  </div>
                )}
              </>
            )}

            {panel === "walk" && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Walk around your farm</p>
                    <p className="text-sm text-muted">
                      Stand at a corner and tap <b>Mark this corner</b>. Walk to the next corner and repeat. On a computer, tap the
                      corners on the map.
                    </p>
                  </div>
                  <button onClick={() => { setWalkPoints([]); setPanel("browse"); }} className="text-sm text-muted hover:text-ink">
                    Cancel
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span>
                    Corners: <b>{walkPoints.length}</b>
                  </span>
                  {walkPoints.length >= 3 && (
                    <span className="text-lg font-bold text-leaf-700">
                      {walkHa.toFixed(2)} ha <span className="text-sm font-medium text-muted">≈ {toAcres(walkHa).toFixed(1)} acres</span>
                    </span>
                  )}
                  {userPos && (
                    <span className={gpsWeak ? "text-amber-700" : "text-leaf-700"}>
                      GPS ±{Math.round(userPos.accuracy)}m {gpsWeak ? "· weak, move to open sky" : "· good"}
                    </span>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
                  <button
                    onClick={markCorner}
                    disabled={!userPos}
                    className="rounded-2xl bg-sky-500 px-4 py-3 font-semibold text-white hover:bg-sky-600 disabled:opacity-40"
                  >
                    📍 Mark this corner
                  </button>
                  <button
                    onClick={() => setWalkPoints((pts) => pts.slice(0, -1))}
                    disabled={!walkPoints.length}
                    title="Undo last corner"
                    className="rounded-2xl border border-line px-4 py-3 disabled:opacity-40"
                  >
                    <Undo2 className="h-5 w-5" />
                  </button>
                  <button
                    onClick={confirmWalk}
                    disabled={walkPoints.length < 3}
                    className="flex items-center gap-1 rounded-2xl bg-leaf-600 px-4 py-3 font-semibold text-white hover:bg-leaf-700 disabled:opacity-40"
                  >
                    Done <ArrowRight className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
