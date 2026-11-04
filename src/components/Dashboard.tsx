"use client";

import { RotateCcw } from "lucide-react";
import FarmReport from "./FarmReport";
import type { Farm } from "@/lib/types";

export default function Dashboard({ farm, onReset }: { farm: Farm; onReset: () => void }) {
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
            <RotateCcw className="h-4 w-4" /> New farm
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <FarmReport farm={farm} />
      </main>
    </div>
  );
}
