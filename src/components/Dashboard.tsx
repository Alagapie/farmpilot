"use client";

import { useState } from "react";
import { ClipboardList, Home, RotateCcw } from "lucide-react";
import FarmReport from "./FarmReport";
import SeasonPlan from "./SeasonPlan";
import type { Farm } from "@/lib/types";

type Tab = "farm" | "plan";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "farm", label: "My farm", icon: <Home className="h-4 w-4" /> },
  { id: "plan", label: "Season plan", icon: <ClipboardList className="h-4 w-4" /> },
];

export default function Dashboard({ farm, onReset, onUpdate }: { farm: Farm; onReset: () => void; onUpdate: (f: Farm) => void }) {
  const [tab, setTab] = useState<Tab>("farm");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-leaf-600 text-white">🌱</span>
            <div>
              <p className="font-bold leading-tight">{farm.name}</p>
              <p className="text-xs text-muted">{farm.data.place.label}</p>
            </div>
          </div>
          <button
            onClick={() => {
              if (confirm("Start over with a new farm? Your current farm will be cleared.")) onReset();
            }}
            className="flex items-center gap-1 rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-ink"
          >
            <RotateCcw className="h-4 w-4" /> <span className="hidden sm:inline">New farm</span>
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === t.id ? "border-leaf-600 text-leaf-700" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.icon}
              {t.label}
              {t.id === "plan" && !farm.plan && <span className="h-2 w-2 rounded-full bg-sun-500" />}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {tab === "farm" ? <FarmReport farm={farm} onUpdate={onUpdate} onOpenPlan={() => setTab("plan")} /> : <SeasonPlan farm={farm} onUpdate={onUpdate} />}
      </main>
    </div>
  );
}
