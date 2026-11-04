import { NextResponse } from "next/server";
import { meta, MODELS } from "@/lib/meta";
import { effectiveSoil, plainForecast, plainRain, plainSoil } from "@/lib/plain";
import type { Farm } from "@/lib/types";

export const runtime = "nodejs";

const SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    points: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["good", "warning", "tip", "weather"] },
          text: { type: "string" },
        },
        required: ["kind", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["headline", "points"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  const farm: Farm = await req.json();
  const { place, zone, climate, forecast } = farm.data;
  const soil = effectiveSoil(farm.data.soil, farm.labSoil);

  const facts = {
    location: place.label,
    zone,
    sizeHectares: farm.hectares,
    budgetNaira: farm.budgetNaira,
    experience: farm.experience,
    goal: farm.goal,
    cropsConsidered: farm.interests,
    today: new Date().toISOString().slice(0, 10),
    soil: soil
      ? plainSoil(soil).map(({ title, action, rating, confidence }) => ({ title, action, rating, confidence }))
      : "unknown",
    rain: climate ? plainRain(climate) : "unknown",
    next16Days: forecast.length ? plainForecast(forecast) : "unknown",
  };

  try {
    const res = await meta().chat.completions.create({
      model: MODELS.spark,
      reasoning_effort: "low",
      messages: [
        {
          role: "developer",
          content: `You are FarmPilot, a friendly farming adviser for smallholder farmers in Nigeria.
Write a short summary of this farm for the farmer, in very simple English (primary-school level).
Rules:
- Talk to the farmer as "you". Be warm and encouraging, but honest.
- No technical words: never say pH, CEC, organic carbon, millimetres or hectares. Say "sour soil", "plant food", "manure", "rain".
- Use only the facts given. Do not invent numbers, prices or crop yields.
- Do not recommend which crop to plant; the season plan does that next.
- Soil facts marked confidence "low" or "moderate" are satellite estimates, not lab tests. Do not state them as certain; if the lime decision is uncertain, suggest a soil test.
- Mention what time of year it is now relative to the rainy season and what the farmer should be doing now.
- headline: one sentence of at most 14 words.
- points: exactly 4 points, each at most 22 words. Use kind "good" for strengths, "warning" for problems, "tip" for actions, "weather" for weather.`,
        },
        { role: "user", content: JSON.stringify(facts) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "farm_summary", strict: true, schema: SCHEMA } },
    });
    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");
    return NextResponse.json(JSON.parse(content));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
