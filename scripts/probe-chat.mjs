// Probe: build (or reuse) a demo farm with a plan, then ask the chat agent questions.
// Usage (dev server running): node scripts/probe-chat.mjs <farmCache.json> "question" ["question" ...]
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const [cachePath, ...questions] = process.argv.slice(2);
const api = (path, body) => fetch(`http://localhost:3000${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined).then((r) => r.json());

let farm;
if (existsSync(cachePath)) farm = JSON.parse(readFileSync(cachePath, "utf8"));
else {
  const lat = 11.1748, lon = 7.5903;
  const data = await api(`/api/farm-data?lat=${lat}&lon=${lon}`);
  farm = { id: "probe", createdAt: new Date().toISOString(), name: "Musa's farm", lat, lon, hectares: 0.8, hectaresSource: "sam", polygon: [], budgetNaira: 600000, experience: "some", goal: "sell", interests: [], data };
  farm.plan = await api("/api/plan", { farm, irrigation: false, labour: "family" });
  writeFileSync(cachePath, JSON.stringify(farm));
}
const messages = [];
for (const q of questions) {
  messages.push({ role: "user", content: q });
  const t = Date.now();
  const r = await api("/api/chat", { farm, messages });
  console.log(`\n> ${q}  (${((Date.now() - t) / 1000).toFixed(1)}s)\n${r.error ?? r.answer}\n  tools: ${r.tools?.join(", ")}${r.sources?.length ? `\n  sources: ${r.sources.map((s) => s.url).join(" ")}` : ""}`);
  messages.push({ role: "assistant", content: r.answer ?? "" });
}
