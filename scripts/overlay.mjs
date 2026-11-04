// Debug: run /api/segment for a point and draw SAM's fields over the satellite image.
// Usage (dev server running): node scripts/overlay.mjs <lat> <lon> <out.png>
import sharp from "sharp";

const [lat, lon, out] = [Number(process.argv[2]), Number(process.argv[3]), process.argv[4]];
const res = await fetch("http://localhost:3000/api/segment", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ lat, lon, debug: true }),
});
const j = await res.json();
if (j.error) { console.log(j.error); process.exit(1); }

const W = 256 * 2 ** 18;
const px = (la, lo) => { const s = Math.sin((la * Math.PI) / 180); return [((lo + 180) / 360) * W, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W]; };
const [cx, cy] = px(lat, lon), ox = Math.round(cx) - 384, oy = Math.round(cy) - 384;
const toPts = (poly) => poly.map(([a, b]) => { const [x, y] = px(a, b); return `${(x - ox).toFixed(1)},${(y - oy).toFixed(1)}`; }).join(" ");
const shapes = j.fields.map((f) => f.id === j.pickedId
  ? `<polygon points="${toPts(f.polygon)}" fill="rgba(0,255,100,0.3)" stroke="#0f0" stroke-width="3"/>`
  : `<polygon points="${toPts(f.polygon)}" fill="none" stroke="#ff0" stroke-width="1.5"/>`).join("");
const svg = `<svg width="768" height="768" xmlns="http://www.w3.org/2000/svg">${shapes}<circle cx="384" cy="384" r="7" fill="red"/></svg>`;
await sharp(Buffer.from(j.image.split(",")[1], "base64")).composite([{ input: Buffer.from(svg) }]).png().toFile(out);
const picked = j.fields.find((f) => f.id === j.pickedId);
console.log({ hectares: picked.hectares, confidence: picked.confidence, inside: j.clickedInside, fields: j.fields.length });
