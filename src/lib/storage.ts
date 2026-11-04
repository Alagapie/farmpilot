import type { Farm } from "./types";

const KEY = "farmpilot.farm.v1";

export function loadFarm(): Farm | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Farm) : null;
  } catch {
    return null;
  }
}

export function saveFarm(farm: Farm) {
  try {
    localStorage.setItem(KEY, JSON.stringify(farm));
  } catch {
    // Storage can be full or blocked; the app still works for this session.
  }
}

export function clearFarm() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
