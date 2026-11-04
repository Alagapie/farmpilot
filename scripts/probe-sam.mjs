// Probe: segment farm fields on an Esri satellite tile with SAM 3.1.
import OpenAI from "openai";
import { parseImageStream, recordsOfKind, decodeMaskToRaster } from "@meta-sam/parser";

const client = new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.MODEL_API_KEY });
const [lat, lon, z] = [Number(process.argv[2] ?? 11.12), Number(process.argv[3] ?? 7.7), 17];
const n = 2 ** z;
const x = Math.floor(((lon + 180) / 360) * n);
const y = Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n);
const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
console.log("tile", url, buf.length, "bytes");

const stream = await client.responses.create({
  model: "sam-3.1",
  stream: true,
  metadata: { include_confidence: "true" },
  input: [{ role: "user", content: [
    { type: "input_text", text: process.argv[4] ?? "farm field" },
    { type: "input_image", image_url: `data:image/jpeg;base64,${buf.toString("base64")}` },
  ] }],
});
const result = await parseImageStream(stream).finalResult;
console.log("outcome", result.outcome, "diagnostics", result.diagnostics.length);
const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / n;
for (const r of recordsOfKind(result.records, "mask")) {
  const px = decodeMaskToRaster(r.mask).reduce((a, b) => a + b, 0);
  console.log(r.objectId, r.bounds, "pixels", px, "area ha", ((px * mpp * mpp) / 10000).toFixed(3));
}
console.log(result.rawOutput?.slice?.(0, 300));
