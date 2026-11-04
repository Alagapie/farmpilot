import { NextResponse } from "next/server";
import { CROP_IDS } from "@/data/crops";
import { meta, MODELS } from "@/lib/meta";

export const runtime = "nodejs";

const SCHEMA = {
  type: "object",
  properties: {
    understood: { type: "boolean" },
    crop: { type: "string", enum: CROP_IDS },
    quantity: { type: "number" },
    unit: { type: "string", enum: ["crate", "basket", "bag", "tonne"] },
    readyFrom: { type: "string" },
    question: { type: "string" },
  },
  required: ["understood", "crop", "quantity", "unit", "readyFrom", "question"],
  additionalProperties: false,
};

// Muse Spark turns a farmer's sentence ("I have 100 crates of tomato ready
// Friday") into a structured listing, or asks for what's missing.
export async function POST(req: Request) {
  const { text } = (await req.json()) as { text: string };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" });
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Lagos" });
  try {
    const res = await meta().chat.completions.create({
      model: MODELS.spark,
      reasoning_effort: "low",
      messages: [
        {
          role: "developer",
          content: `Extract a produce listing from what a Nigerian farmer says. Today is ${weekday} ${today}.
crop: one of ${CROP_IDS.join(", ")} (map local words: "masara" = maize, "dawa" = sorghum, "shinkafa" = rice, "waken soya" = soybean, "rogo" = cassava, "tumatur" = tomato).
unit: crate, basket, bag or tonne (tomato usually crates or baskets; grain usually bags).
readyFrom: the date the produce is ready, YYYY-MM-DD; "now" or "today" = today; a weekday = its next date.
If crop or quantity is missing, set understood=false and write a short question asking for it; otherwise question is "".`,
        },
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: { name: "listing", strict: true, schema: SCHEMA } },
    });
    return NextResponse.json(JSON.parse(res.choices[0]?.message?.content ?? "{}"));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
