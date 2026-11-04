import { NextResponse } from "next/server";
import { meta, MODELS } from "@/lib/meta";

export const runtime = "nodejs";
export const maxDuration = 120;

const SCENE: Record<string, string> = {
  maize: "tall green maize plants with tassels",
  sorghum: "sorghum plants with reddish grain heads",
  soybean: "low bushy soybean plants",
  rice: "green rice paddy",
  cassava: "leafy cassava plants",
  tomato: "bushy rows of tomato plants with red fruit, a small irrigation channel",
};

// Muse Image paints the illustration only; the app overlays the farmer's text,
// because generated images garble writing.
export async function POST(req: Request) {
  const { crops, zone } = (await req.json()) as { crops: string[]; zone: string };
  const plants = crops.map((c) => SCENE[c] ?? c).join(" beside ");
  const prompt = `Warm, hopeful flat illustration for a farming season poster. A smallholder farm in the ${zone} of northern Nigeria: ${plants}, neat ridges, a farmer in a traditional cap working the field, acacia trees, soft golden morning light, a few rain clouds. Clean modern vector style with earthy greens and golds. Leave the top third as open sky for a title. Absolutely no text, letters, numbers or logos.`;
  try {
    const res = await meta().images.generate({ model: MODELS.image, prompt, n: 1 });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    const format = (res as { output_format?: string }).output_format ?? "webp";
    return NextResponse.json({ image: `data:image/${format};base64,${b64}` });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
