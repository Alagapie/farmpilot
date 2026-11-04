import { NextResponse } from "next/server";
import sharp from "sharp";
import { decodeMaskToRaster, parseImageStream, recordsOfKind } from "@meta-sam/parser";
import { meta, MODELS } from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 60;

// Produce grading from a photo with SAM 3.1: segment every fruit, then measure
// ripeness (colour inside each mask) and size uniformity. Grading, not diagnosis.
export async function POST(req: Request) {
  const input = Buffer.from(await req.arrayBuffer());
  if (!input.length) return NextResponse.json({ error: "No photo" }, { status: 400 });
  try {
    const { data: rgb, info } = await sharp(input).rotate().resize(768, 768, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const jpeg = await sharp(rgb, { raw: { width: info.width, height: info.height, channels: 3 } }).jpeg({ quality: 88 }).toBuffer();

    const stream = await meta().responses.create({
      model: MODELS.sam,
      stream: true,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "tomato" },
            { type: "input_image", image_url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, detail: "auto" },
          ],
        },
      ],
    });
    const result = await parseImageStream(stream as AsyncIterable<never>).finalResult;
    const masks = recordsOfKind(result.records, "mask");
    if (!masks.length) return NextResponse.json({ error: "No tomatoes found in this photo. Take it from above, in daylight, with the crate filling the picture." }, { status: 422 });

    const fruits = masks.map((m) => {
      const raster = decodeMaskToRaster(m.mask);
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = 0; y < m.mask.height; y++) {
        for (let x = 0; x < m.mask.width; x++) {
          if (!raster[y * m.mask.width + x]) continue;
          const px = ((m.bounds.top + y) * info.width + (m.bounds.left + x)) * 3;
          r += rgb[px];
          g += rgb[px + 1];
          b += rgb[px + 2];
          n++;
        }
      }
      r /= n || 1;
      g /= n || 1;
      b /= n || 1;
      // Ripe tomatoes are clearly red: red well above green.
      return { area: n, ripe: r > g * 1.35 && r > b * 1.2, box: m.bounds };
    });
    const areas = fruits.map((f) => f.area).sort((a, b) => a - b);
    const median = areas[Math.floor(areas.length / 2)];
    // Ignore fragments (partly hidden fruit at the crate edge) for size statistics.
    const whole = fruits.filter((f) => f.area > median * 0.35);
    const mean = whole.reduce((s, f) => s + f.area, 0) / whole.length;
    const sd = Math.sqrt(whole.reduce((s, f) => s + (f.area - mean) ** 2, 0) / whole.length);
    const uniformity = Math.max(0, 1 - sd / mean);
    const ripePct = fruits.filter((f) => f.ripe).length / fruits.length;
    const grade = ripePct >= 0.75 && uniformity >= 0.65 ? "A" : ripePct >= 0.5 && uniformity >= 0.45 ? "B" : "C";
    const note =
      grade === "A"
        ? "Mostly ripe and even in size: top grade for buyers."
        : grade === "B"
          ? `${ripePct < 0.75 ? "Some fruit not fully ripe" : "Sizes are mixed"}: sort before selling to lift the price.`
          : "Many unripe or uneven fruit: sort into grades and sell ripe fruit first.";
    return NextResponse.json({
      grade,
      count: fruits.length,
      ripePct: Math.round(ripePct * 100),
      uniformity: Math.round(uniformity * 100),
      note,
      boxes: fruits.map((f) => ({ ...f.box, ripe: f.ripe })),
      size: { width: info.width, height: info.height },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
