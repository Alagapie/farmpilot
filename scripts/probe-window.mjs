// Probe: how SAM 3.1 handles different satellite window sizes around one point.
import OpenAI from "openai";
import sharp from "sharp";
import { parseImageStream, recordsOfKind } from "@meta-sam/parser";

const client = new OpenAI({ baseURL: "https://api.meta.ai/v1", apiKey: process.env.MODEL_API_KEY });
const [lat, lon, z] = [Number(process.argv[2]), Number(process.argv[3]), Number(process.argv[4] ?? 17)];
const W = 256 * 2 ** z, s = Math.sin((lat * Math.PI) / 180);
const cx = Math.round(((lon + 180) / 360) * W), cy = Math.round((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * W);
for (const view of [256, 384, 512, 768]) {
  const ox = cx - view / 2, oy = cy - view / 2, tx0 = Math.floor(ox / 256), ty0 = Math.floor(oy / 256), n = Math.ceil(view / 256) + 1;
  const tiles = await Promise.all(Array.from({ length: n * n }, async (_, i) => ({
    input: Buffer.from(await (await fetch(`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty0 + Math.floor(i / n)}/${tx0 + (i % n)}`)).arrayBuffer()),
    left: (i % n) * 256, top: Math.floor(i / n) * 256 })));
  const grid = await sharp({ create: { width: n * 256, height: n * 256, channels: 3, background: "#000" } }).composite(tiles).jpeg().toBuffer();
  const jpg = await sharp(grid).extract({ left: ox - tx0 * 256, top: oy - ty0 * 256, width: view, height: view }).jpeg({ quality: 90 }).toBuffer();
  const stream = await client.responses.create({ model: "sam-3.1", stream: true, input: [{ role: "user", content: [
    { type: "input_text", text: "crop field" }, { type: "input_image", image_url: `data:image/jpeg;base64,${jpg.toString("base64")}` }] }] });
  const masks = recordsOfKind((await parseImageStream(stream).finalResult).records, "mask");
  const hit = masks.find((m) => m.bounds.left <= view / 2 && m.bounds.right > view / 2 && m.bounds.top <= view / 2 && m.bounds.bottom > view / 2);
  console.log(`z${z} view ${view}: ${masks.length} fields, centre box hit: ${hit ? JSON.stringify(hit.bounds) : "none"}`);
}
