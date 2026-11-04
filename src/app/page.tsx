"use client";

import { useCallback, useEffect, useState } from "react";
import Dashboard from "@/components/Dashboard";
import Onboarding from "@/components/Onboarding";
import { clearFarm, loadFarm, saveFarm } from "@/lib/storage";
import type { Farm } from "@/lib/types";

export default function Home() {
  const [farm, setFarm] = useState<Farm | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFarm(loadFarm());
    setReady(true);
  }, []);

  const update = useCallback((f: Farm) => {
    saveFarm(f);
    setFarm(f);
  }, []);

  if (!ready) return null;

  if (!farm) {
    return (
      <Onboarding
        onDone={(f) => {
          saveFarm(f);
          setFarm(f);
        }}
      />
    );
  }

  return (
    <Dashboard
      farm={farm}
      onUpdate={update}
      onReset={() => {
        clearFarm();
        setFarm(null);
      }}
    />
  );
}
