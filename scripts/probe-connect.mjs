// Probe: list produce, compare deals, book the best one, and walk the shipment.
// Usage (dev server running): node scripts/probe-connect.mjs [crop] [quantity] [unit]
const [crop = "tomato", quantity = 100, unit = "crate"] = process.argv.slice(2);
const api = (path, body) => fetch(`http://localhost:3000/api/connect/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
const naira = (n) => `₦${Math.round(n).toLocaleString("en-NG")}`;

const farmerId = "probe-farmer";
await api("reset", { farmerId });
const ready = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
const listing = await api("listings", { farmerId, farmer: "Musa (probe)", crop, quantity: Number(quantity), unit, lat: 11.1748, lon: 7.5903, place: "Shika, Giwa", readyFrom: ready });
console.log("listed", listing.quantity, listing.unit, listing.crop, `(${listing.kg}kg) ready ${listing.readyFrom}`);

const t = Date.now();
const { deals, summary, price, error } = await api("deals", { listingId: listing.id, state: "Kaduna" });
if (error) { console.log(error); process.exit(1); }
console.log(`price base: ${naira(price.typical)} per ${price.unit} | ${deals.length} deals in ${((Date.now() - t) / 1000).toFixed(1)}s\n`);
for (const d of deals) {
  console.log(`${d.mode.padEnd(6)} ${d.marketName.padEnd(32)} ${d.vehicle.kind.padEnd(22)} farmers ${d.stops.length} trip ${d.tripKm}km ${naira(d.tripCost).padStart(10)} | your share ${naira(d.yourShare).padStart(9)} | sales ${naira(d.revenue).padStart(11)} loss ${Math.round(d.lossPct * 100)}% | keep ${naira(d.net).padStart(11)} (${d.vsBestSolo >= 0 ? "+" : ""}${naira(d.vsBestSolo)} vs best alone)`);
}
console.log("\nMuse Spark:", summary);

const best = deals[0];
const trip = await api("book", { listingId: listing.id, dealKey: best.key, state: "Kaduna" });
console.log("\nbooked", trip.id ?? trip.error, "| shares:", JSON.stringify(trip.shares));
for (let i = 0; i < 3 && trip.id; i++) console.log("advance →", (await api("advance", { tripId: trip.id })).status);
