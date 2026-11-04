// Probe: build a season plan for the demo farm and print the result.
// Usage (dev server running): node scripts/probe-plan.mjs [budget] [hectares] [experience] [irrigation]
const [budget = 600000, hectares = 0.8, experience = "some", irrigation = "no"] = process.argv.slice(2);
const lat = 11.1748, lon = 7.5903;
const data = await (await fetch(`http://localhost:3000/api/farm-data?lat=${lat}&lon=${lon}`)).json();
const farm = { id: "probe", createdAt: new Date().toISOString(), name: "Probe", lat, lon, hectares: Number(hectares), hectaresSource: "sam", polygon: [], budgetNaira: Number(budget), experience, goal: "sell", interests: [], data };
const t = Date.now();
const res = await fetch("http://localhost:3000/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ farm, irrigation: irrigation === "yes", labour: process.argv[6] ?? "mixed" }) });
const j = await res.json();
console.log(`${((Date.now() - t) / 1000).toFixed(1)}s`);
if (j.error) { console.log(j.error); process.exit(1); }
console.log(JSON.stringify(j.plan, null, 2));
for (const e of j.economics) console.log(e.crop, e.hectares, "ha cost", Math.round(e.totalCost), "profit", Object.values(e.profit).map(Math.round).join(" / "));
console.log("totals", JSON.stringify(j.totals), "\nwarnings", j.warnings);
