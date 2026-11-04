import sharp from "sharp";
import {
  decodeMaskToRaster,
  decodeMaskToSVGPath,
  parseImageStream,
  recordsOfKind,
} from "@meta-sam/parser";
import { meta, MODELS } from "./meta";

const TILE = 256;
const ZOOM = 18; // SAM only separates smallholder fields when they appear large; z18 + 768px tested best
const VIEW = 768; // satellite window sent to SAM, centred on the farmer's click
const FIELD_PROMPT = process.env.SAM_FIELD_PROMPT ?? "crop field";
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile";

const worldSize = TILE * 2 ** ZOOM;

function toPixel(lat: number, lon: number) {
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * worldSize,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * worldSize,
  };
}

function toLatLon(x: number, y: number): [number, number] {
  const lon = (x / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  return [(180 / Math.PI) * Math.atan(Math.sinh(n)), lon];
}

/** Stitch Esri tiles into a VIEW×VIEW JPEG whose top-left is at world pixel (ox, oy). */
async function satelliteWindow(ox: number, oy: number) {
  const tx0 = Math.floor(ox / TILE);
  const ty0 = Math.floor(oy / TILE);
  const count = Math.ceil(VIEW / TILE) + 1;
  const tiles = await Promise.all(
    Array.from({ length: count * count }, async (_, i) => {
      const tx = tx0 + (i % count);
      const ty = ty0 + Math.floor(i / count);
      const res = await fetch(`${ESRI}/${ZOOM}/${ty}/${tx}`);
      if (!res.ok) throw new Error(`Satellite tile failed: ${res.status}`);
      return {
        input: Buffer.from(await res.arrayBuffer()),
        left: (i % count) * TILE,
        top: Math.floor(i / count) * TILE,
      };
    }),
  );
  const grid = await sharp({
    create: { width: count * TILE, height: count * TILE, channels: 3, background: "#000" },
  })
    .composite(tiles)
    .jpeg()
    .toBuffer();
  return sharp(grid)
    .extract({ left: ox - tx0 * TILE, top: oy - ty0 * TILE, width: VIEW, height: VIEW })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/** Keep the largest closed ring of an SVG path, thinned to at most `max` points. */
function largestRing(path: string, max = 200): [number, number][] {
  const rings = path
    .split(/(?=M)/)
    .map((sub) => {
      const nums = sub.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
      const pts: [number, number][] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
      return pts;
    })
    .filter((r) => r.length >= 3);
  if (!rings.length) return [];
  const ring = rings.reduce((a, b) => (b.length > a.length ? b : a));
  const step = Math.max(1, Math.ceil(ring.length / max));
  return ring.filter((_, i) => i % step === 0);
}

export interface FieldResult {
  hectares: number;
  polygon: [number, number][]; // [lat, lon]
  otherFields: [number, number][][]; // neighbouring fields SAM also found
  clickedInside: boolean; // false when we fell back to the nearest field
  confidence: number | null;
  image: string; // data URL of the satellite window SAM saw
}

export async function segmentField(lat: number, lon: number): Promise<FieldResult> {
  const click = toPixel(lat, lon);
  const ox = Math.round(click.x) - VIEW / 2;
  const oy = Math.round(click.y) - VIEW / 2;
  const jpeg = await satelliteWindow(ox, oy);

  // A single point prompt tends to latch onto trees or shadows, so segment every
  // field in view and keep the one under the farmer's click.
  const stream = await meta().responses.create({
    model: MODELS.sam,
    stream: true,
    metadata: { include_confidence: "true" },
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: FIELD_PROMPT },
          { type: "input_image", image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "auto" },
        ],
      },
    ],
  });

  const result = await parseImageStream(stream as AsyncIterable<never>).finalResult;
  const fields = recordsOfKind(result.records, "mask").map((record) => ({
    record,
    raster: decodeMaskToRaster(record.mask),
  }));
  if (!fields.length) throw new Error("SAM could not find any fields here. Try zooming to your farm and clicking again.");

  const c = VIEW / 2;
  const contains = ({ record: { bounds, mask }, raster }: (typeof fields)[number]) =>
    c >= bounds.left && c < bounds.right && c >= bounds.top && c < bounds.bottom &&
    raster[(c - bounds.top) * mask.width + (c - bounds.left)] === 1;
  const distance = ({ record: { bounds } }: (typeof fields)[number]) =>
    Math.hypot((bounds.left + bounds.right) / 2 - c, (bounds.top + bounds.bottom) / 2 - c);
  const picked = fields.find(contains) ?? fields.reduce((a, b) => (distance(b) < distance(a) ? b : a));
  const mask = picked.record;

  const pixels = picked.raster.reduce((sum, v) => sum + v, 0);
  const metresPerPixel = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** ZOOM;
  const hectares = (pixels * metresPerPixel ** 2) / 10_000;

  const polygon = largestRing(decodeMaskToSVGPath(mask.mask)).map(([x, y]) =>
    toLatLon(ox + mask.bounds.left + x, oy + mask.bounds.top + y),
  );

  const toGeo = (record: (typeof fields)[number]["record"]) =>
    largestRing(decodeMaskToSVGPath(record.mask), 60).map(([x, y]) =>
      toLatLon(ox + record.bounds.left + x, oy + record.bounds.top + y),
    );

  return {
    hectares: Math.round(hectares * 100) / 100,
    polygon,
    otherFields: fields.filter((f) => f !== picked).map((f) => toGeo(f.record)),
    clickedInside: contains(picked),
    confidence: mask.confidence ?? null,
    image: `data:image/jpeg;base64,${jpeg.toString("base64")}`,
  };
}
