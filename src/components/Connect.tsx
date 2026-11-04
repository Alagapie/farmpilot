"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RotateCcw, Truck, Users, Warehouse, Wrench } from "lucide-react";
import type { Booking } from "@/lib/connect-store";
import type { Farm } from "@/lib/types";
import ConnectSell, { type ConnectState } from "./ConnectSell";
import { ConnectEquipment, ConnectStorage, type ShareState } from "./ConnectShare";

type View = "sell" | "storage" | "equipment";
type FullState = ConnectState & ShareState & { bookings: Booking[] };

const VIEWS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "sell", label: "Sell & share a truck", icon: <Truck className="h-4 w-4" /> },
  { id: "storage", label: "Shared storage", icon: <Warehouse className="h-4 w-4" /> },
  { id: "equipment", label: "Shared equipment", icon: <Wrench className="h-4 w-4" /> },
];

export default function Connect({ farm }: { farm: Farm }) {
  const [view, setView] = useState<View>("sell");
  const [state, setState] = useState<FullState | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/connect/state?farmerId=${encodeURIComponent(farm.id)}`, { cache: "no-store" });
    if (r.ok) setState(await r.json());
  }, [farm.id]);

  useEffect(() => {
    refresh();
    // Other farmers can join or book at any time; keep the view fresh.
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  async function reset() {
    if (!confirm("Clear your Connect listings and bookings, and restore the demo neighbours?")) return;
    await fetch("/api/connect/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farmerId: farm.id }) });
    await refresh();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-leaf-900 p-6 text-white sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-leaf-100">
          <Users className="h-4 w-4" /> FarmPilot Connect
        </p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">You know the better market. Let&apos;s get you there, together.</h1>
        <p className="mt-2 max-w-3xl text-leaf-100">
          Share a truck with nearby farmers and pay transport from the sale, not up front. Store produce when prices are low. Rent a pump or tractor by the hour.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold ${view === v.id ? "bg-leaf-600 text-white" : "border border-line bg-white hover:border-leaf-500"}`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </nav>
        <button onClick={reset} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo
        </button>
      </div>

      {!state ? (
        <p className="flex items-center gap-2 rounded-3xl border border-line bg-white p-6 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading farmers, trucks and storage near you…
        </p>
      ) : view === "sell" ? (
        <ConnectSell farm={farm} state={state} refresh={refresh} />
      ) : view === "storage" ? (
        <ConnectStorage farm={farm} state={state} refresh={refresh} />
      ) : (
        <ConnectEquipment farm={farm} state={state} refresh={refresh} />
      )}
    </div>
  );
}
